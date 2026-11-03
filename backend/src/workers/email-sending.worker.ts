import { Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { EmailStatus, CampaignStatus } from '@prisma/client';
import { QUEUE_NAMES } from '../queues/queue.constants';
import { createRedisConnection } from '../queues/queue.connection';
import { EmailJobPayload } from '../modules/scheduler/scheduler.types';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../shared/utils/logger';
import { CryptoUtil } from '../shared/utils/crypto.util';
import { classifySmtpError } from '../shared/utils/smtp-error-classifier';
import { EtherealEmailProvider } from '../providers/email/ethereal.provider';
import { EmailProvider } from '../providers/email/email-provider.interface';
import { calculateCampaignStatus } from '../modules/emails/email-status';
import { SchedulerService } from '../modules/scheduler/scheduler.service';

export class EmailSendingWorker {
  private worker: Worker<EmailJobPayload> | null = null;
  private defaultProvider: EmailProvider;

  constructor(customProvider?: EmailProvider) {
    this.defaultProvider = customProvider ?? new EtherealEmailProvider();
  }

  start(): void {
    if (this.worker) return;

    const connection = createRedisConnection('worker-email-sending');

    this.worker = new Worker<EmailJobPayload>(
      QUEUE_NAMES.EMAIL_SENDING,
      async (job: Job<EmailJobPayload>) => {
        return this.processJob(job);
      },
      {
        connection,
        concurrency: env.EMAIL_WORKER_CONCURRENCY,
      },
    );

    this.worker.on('ready', () => {
      logger.info(
        { concurrency: env.EMAIL_WORKER_CONCURRENCY },
        'Email Sending Worker is ready and listening',
      );
    });

    this.worker.on('failed', (job, err) => {
      logger.error(
        { jobId: job?.id, emailRecordId: job?.data?.emailRecordId, err },
        'BullMQ email job failed',
      );
    });

    this.worker.on('error', (err) => {
      logger.error({ err }, 'Email Sending Worker internal error');
    });
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      logger.info('Email Sending Worker stopped gracefully');
    }
  }

  async processJob(job: Job<EmailJobPayload>): Promise<void> {
    const { emailRecordId, campaignId } = job.data;
    logger.info({ jobId: job.id, emailRecordId }, 'Processing email sending job');

    // 1. Fetch latest state from PostgreSQL (DB is source of truth)
    const email = await prisma.emailRecord.findUnique({
      where: { id: emailRecordId },
      include: {
        campaign: true,
        senderAccount: true,
      },
    });

    if (!email) {
      logger.warn({ emailRecordId }, 'Email record not found in DB; aborting job cleanly');
      return;
    }

    // 2. Check if email was already cancelled or sent
    if (email.status === EmailStatus.CANCELLED) {
      logger.info({ emailRecordId }, 'Email was cancelled; skipping send');
      return;
    }

    if (email.status === EmailStatus.SENT) {
      logger.info({ emailRecordId }, 'Email already sent; skipping duplicate send');
      return;
    }

    // 3. Check if parent campaign was cancelled
    if (email.campaign.status === CampaignStatus.CANCELLED) {
      logger.info({ campaignId, emailRecordId }, 'Campaign cancelled; marking email cancelled');
      await prisma.$transaction([
        prisma.emailRecord.update({
          where: { id: email.id },
          data: { status: EmailStatus.CANCELLED },
        }),
        prisma.emailEvent.create({
          data: {
            emailRecordId: email.id,
            eventType: 'EMAIL_CANCELLED',
            previousStatus: email.status,
            newStatus: EmailStatus.CANCELLED,
            metadata: { reason: 'Parent campaign cancelled' },
          },
        }),
      ]);
      return;
    }

    // 4. Check sender account validity
    if (!email.senderAccount || !email.senderAccount.isActive) {
      const errorMsg = 'Sender account is invalid or inactive';
      logger.error({ emailRecordId, senderId: email.senderAccountId }, errorMsg);
      await this.handlePermanentFailure(email.id, 'SENDER_INACTIVE', errorMsg, email.campaignId);
      return;
    }

    // 5. Transition to PROCESSING
    await prisma.$transaction([
      prisma.emailRecord.update({
        where: { id: email.id },
        data: { status: EmailStatus.PROCESSING },
      }),
      prisma.emailEvent.create({
        data: {
          emailRecordId: email.id,
          eventType: 'EMAIL_PROCESSING',
          previousStatus: email.status,
          newStatus: EmailStatus.PROCESSING,
        },
      }),
    ]);

    // 6. Build SMTP provider
    let provider = this.defaultProvider;
    try {
      if (
        email.senderAccount.smtpHost &&
        email.senderAccount.smtpUsername &&
        email.senderAccount.smtpPasswordEncrypted
      ) {
        const password = CryptoUtil.decrypt(email.senderAccount.smtpPasswordEncrypted);
        const transporter = nodemailer.createTransport({
          host: email.senderAccount.smtpHost,
          port: email.senderAccount.smtpPort,
          secure: email.senderAccount.smtpPort === 465,
          auth: {
            user: email.senderAccount.smtpUsername,
            pass: password,
          },
        });
        provider = new EtherealEmailProvider(transporter);
      }
    } catch (err) {
      logger.warn({ err, senderId: email.senderAccountId }, 'Fallback to default email provider');
    }

    // 7. Execute delivery via SMTP
    let sendResult;
    try {
      sendResult = await provider.sendEmail({
        from: `"${email.senderAccount.displayName || 'ReachInbox'}" <${email.senderAccount.email}>`,
        to: email.recipientEmail,
        subject: email.subject,
        body: email.body,
      });
    } catch (sendErr: any) {
      await this.handleSendError(email, sendErr);
      return;
    }

    // 8. Update DB to SENT after SMTP accepted the message
    try {
      await prisma.$transaction(async (tx) => {
        await tx.emailRecord.update({
          where: { id: email.id },
          data: {
            status: EmailStatus.SENT,
            sentAt: new Date(),
            providerMessageId: sendResult.messageId,
          },
        });

        await tx.emailEvent.create({
          data: {
            emailRecordId: email.id,
            eventType: 'EMAIL_SENT',
            previousStatus: EmailStatus.PROCESSING,
            newStatus: EmailStatus.SENT,
            metadata: {
              messageId: sendResult.messageId,
              previewUrl: sendResult.previewUrl,
            },
          },
        });

        // Update campaign aggregate status
        await this.syncCampaignStatus(email.campaignId, tx);
      });

      logger.info(
        {
          emailRecordId: email.id,
          to: email.recipientEmail,
          messageId: sendResult.messageId,
          previewUrl: sendResult.previewUrl,
        },
        '✅ Email successfully delivered and recorded as SENT',
      );
    } catch (dbErr: any) {
      // Critical caveat: SMTP accepted, but DB failed to update
      logger.error(
        {
          err: dbErr,
          emailRecordId: email.id,
          messageId: sendResult.messageId,
        },
        'CRITICAL: SMTP accepted email, but DB update failed. Marking DELIVERY_UNKNOWN',
      );

      try {
        await prisma.emailRecord.update({
          where: { id: email.id },
          data: {
            status: EmailStatus.DELIVERY_UNKNOWN,
            providerMessageId: sendResult.messageId,
            errorMessage: 'DB commit failed after SMTP acceptance',
          },
        });
      } catch {
        // preserve failure log
      }
    }
  }

  private async handleSendError(email: any, err: any): Promise<void> {
    const classified = classifySmtpError(err);
    logger.warn(
      {
        emailRecordId: email.id,
        isTransient: classified.isTransient,
        errorCode: classified.errorCode,
        message: classified.message,
      },
      'Email send failed',
    );

    const nextRetryCount = email.retryCount + 1;

    if (classified.isTransient && nextRetryCount <= email.maxRetries) {
      // Exponential backoff with jitter
      const baseDelay = env.EMAIL_RETRY_BASE_DELAY_MS;
      const exponentialDelay = Math.min(300000, baseDelay * Math.pow(2, nextRetryCount - 1));
      const jitter = Math.floor(Math.random() * 1000);
      const totalDelayMs = exponentialDelay + jitter;
      const nextRetryAt = new Date(Date.now() + totalDelayMs);

      await prisma.$transaction(async (tx) => {
        await tx.emailRecord.update({
          where: { id: email.id },
          data: {
            status: EmailStatus.RETRY_SCHEDULED,
            retryCount: nextRetryCount,
            nextRetryAt,
            errorCode: classified.errorCode,
            errorMessage: classified.message,
          },
        });

        await tx.emailEvent.create({
          data: {
            emailRecordId: email.id,
            eventType: 'EMAIL_RETRY_SCHEDULED',
            previousStatus: EmailStatus.PROCESSING,
            newStatus: EmailStatus.RETRY_SCHEDULED,
            metadata: {
              attempt: nextRetryCount,
              delayMs: totalDelayMs,
              nextRetryAt: nextRetryAt.toISOString(),
              error: classified.message,
            },
          },
        });
      });

      // Re-enqueue job to BullMQ with new generation ID
      await SchedulerService.enqueueEmailJob({
        id: email.id,
        campaignId: email.campaignId,
        userId: email.userId,
        senderAccountId: email.senderAccountId,
        scheduledAt: nextRetryAt,
        retryCount: nextRetryCount,
      });

      logger.info(
        { emailRecordId: email.id, attempt: nextRetryCount, nextRetryAt },
        'Retry scheduled in BullMQ',
      );
    } else {
      // Permanent failure or retry limit exhausted
      await this.handlePermanentFailure(
        email.id,
        classified.errorCode,
        classified.message,
        email.campaignId,
      );
    }
  }

  private async handlePermanentFailure(
    emailRecordId: string,
    errorCode: string,
    errorMessage: string,
    campaignId: string,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.emailRecord.update({
        where: { id: emailRecordId },
        data: {
          status: EmailStatus.FAILED,
          errorCode,
          errorMessage,
        },
      });

      await tx.emailEvent.create({
        data: {
          emailRecordId,
          eventType: 'EMAIL_FAILED',
          previousStatus: EmailStatus.PROCESSING,
          newStatus: EmailStatus.FAILED,
          metadata: { errorCode, errorMessage },
        },
      });

      await this.syncCampaignStatus(campaignId, tx);
    });

    logger.error({ emailRecordId, errorCode, errorMessage }, 'Email marked as FAILED');
  }

  private async syncCampaignStatus(campaignId: string, tx: any = prisma): Promise<void> {
    const records = await tx.emailRecord.findMany({
      where: { campaignId },
      select: { status: true },
    });

    const newStatus = calculateCampaignStatus(records.map((r: any) => r.status));

    await tx.emailCampaign.update({
      where: { id: campaignId },
      data: { status: newStatus },
    });
  }
}

