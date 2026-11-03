import { JobsOptions } from 'bullmq';
import { env } from '../../config/env';

export interface EmailJobPayload {
  emailRecordId: string;
  campaignId: string;
  userId: string;
  senderAccountId: string;
  scheduledAt: string;
}

/**
 * Deterministic generation-based BullMQ Job ID.
 * Prevents BullMQ duplicate job insertion for the same generation while allowing
 * rescheduled attempts (higher retryCount) to receive clean IDs.
 */
export function generateJobId(emailRecordId: string, retryCount = 0): string {
  return `email-${emailRecordId}-gen-${retryCount}`;
}

export function getDefaultJobOptions(delayMs = 0): JobsOptions {
  return {
    jobId: undefined, // provided when adding job
    delay: Math.max(0, delayMs),
    attempts: env.EMAIL_MAX_RETRIES,
    backoff: {
      type: 'exponential',
      delay: env.EMAIL_RETRY_BASE_DELAY_MS,
    },
    removeOnComplete: {
      age: 86400, // 24 hours
      count: 10000,
    },
    removeOnFail: false, // Keep failed jobs for inspection
  };
}

