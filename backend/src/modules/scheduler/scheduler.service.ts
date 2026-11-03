import { queueRegistry } from '../../queues/queue.registry';
import {
  EmailJobPayload,
  generateJobId,
  getDefaultJobOptions,
} from './scheduler.types';
import { logger } from '../../shared/utils/logger';

export interface EnqueueEmailRecordParam {
  id: string;
  campaignId: string;
  userId: string;
  senderAccountId: string;
  scheduledAt: Date;
  retryCount?: number;
}

export class SchedulerService {
  /**
   * Enqueues a single email record into the BullMQ email-sending queue as a delayed job.
   */
  static async enqueueEmailJob(record: EnqueueEmailRecordParam): Promise<string> {
    const queue = queueRegistry.getEmailSendingQueue();
    const retryCount = record.retryCount ?? 0;
    const jobId = generateJobId(record.id, retryCount);

    const delayMs = Math.max(0, record.scheduledAt.getTime() - Date.now());
    const jobOptions = {
      ...getDefaultJobOptions(delayMs),
      jobId,
    };

    const payload: EmailJobPayload = {
      emailRecordId: record.id,
      campaignId: record.campaignId,
      userId: record.userId,
      senderAccountId: record.senderAccountId,
      scheduledAt: record.scheduledAt.toISOString(),
    };

    await queue.add('send-email', payload, jobOptions);

    logger.debug(
      {
        jobId,
        emailRecordId: record.id,
        delayMs,
        scheduledAt: record.scheduledAt,
      },
      'Enqueued delayed email job to BullMQ',
    );

    return jobId;
  }

  /**
   * Bulk enqueues multiple email records into BullMQ.
   */
  static async enqueueBulkEmailJobs(records: EnqueueEmailRecordParam[]): Promise<string[]> {
    const queue = queueRegistry.getEmailSendingQueue();

    const jobs = records.map((record) => {
      const retryCount = record.retryCount ?? 0;
      const jobId = generateJobId(record.id, retryCount);
      const delayMs = Math.max(0, record.scheduledAt.getTime() - Date.now());

      const payload: EmailJobPayload = {
        emailRecordId: record.id,
        campaignId: record.campaignId,
        userId: record.userId,
        senderAccountId: record.senderAccountId,
        scheduledAt: record.scheduledAt.toISOString(),
      };

      return {
        name: 'send-email',
        data: payload,
        opts: {
          ...getDefaultJobOptions(delayMs),
          jobId,
        },
      };
    });

    if (jobs.length > 0) {
      await queue.addBulk(jobs);
    }

    logger.info({ count: jobs.length }, 'Bulk enqueued email jobs to BullMQ');
    return jobs.map((j) => j.opts.jobId!);
  }

  /**
   * Attempts to remove a pending delayed job from BullMQ.
   */
  static async removePendingJob(emailRecordId: string, retryCount = 0): Promise<boolean> {
    try {
      const queue = queueRegistry.getEmailSendingQueue();
      const jobId = generateJobId(emailRecordId, retryCount);
      const job = await queue.getJob(jobId);

      if (job) {
        const state = await job.getState();
        if (state === 'delayed' || state === 'waiting') {
          await job.remove();
          logger.info({ jobId }, 'Removed pending BullMQ job');
          return true;
        }
      }
      return false;
    } catch (err) {
      logger.warn({ err, emailRecordId }, 'Could not remove BullMQ job');
      return false;
    }
  }
}

