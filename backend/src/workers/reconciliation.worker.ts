import { v4 as uuidv4 } from 'uuid';
import { EmailStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { queueRegistry } from '../queues/queue.registry';
import { generateJobId } from '../modules/scheduler/scheduler.types';
import { SchedulerService } from '../modules/scheduler/scheduler.service';
import { env } from '../config/env';
import { logger } from '../shared/utils/logger';

export class ReconciliationWorker {
  private workerId = uuidv4();
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private isRunning = false;

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info(
      { intervalMs: env.RECONCILIATION_POLL_INTERVAL_MS, workerId: this.workerId },
      'Reconciliation Worker started',
    );

    this.timer = setInterval(() => {
      this.reconcileJobsSafe().catch((err) => {
        logger.error({ err }, 'Error in reconciliation interval');
      });
    }, env.RECONCILIATION_POLL_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info('Reconciliation Worker stopped');
  }

  async reconcileJobsSafe(): Promise<number> {
    if (!this.isRunning || this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      return await this.reconcileMissingJobs();
    } catch (err) {
      logger.error({ err }, 'Error during reconciliation process');
      return 0;
    } finally {
      this.isProcessing = false;
    }
  }

  async reconcileMissingJobs(batchSize = 100): Promise<number> {
    const queue = queueRegistry.getEmailSendingQueue();

    // Find email records that are SCHEDULED or RETRY_SCHEDULED
    const records = await prisma.emailRecord.findMany({
      where: {
        status: { in: [EmailStatus.SCHEDULED, EmailStatus.RETRY_SCHEDULED] },
      },
      take: batchSize,
      orderBy: { scheduledAt: 'asc' },
    });

    if (records.length === 0) return 0;

    let repairedCount = 0;

    for (const record of records) {
      const jobId = generateJobId(record.id, record.retryCount);
      const existingJob = await queue.getJob(jobId);

      if (!existingJob) {
        logger.warn(
          { emailRecordId: record.id, jobId, status: record.status },
          'Reconciliation: missing BullMQ job detected, re-enqueueing',
        );

        await SchedulerService.enqueueEmailJob({
          id: record.id,
          campaignId: record.campaignId,
          userId: record.userId,
          senderAccountId: record.senderAccountId,
          scheduledAt: record.scheduledAt,
          retryCount: record.retryCount,
        });

        repairedCount++;
      }
    }

    if (repairedCount > 0) {
      logger.info({ repairedCount }, 'Reconciliation finished repairing missing jobs');
    }

    return repairedCount;
  }
}

