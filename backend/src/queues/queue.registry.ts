import { Queue } from 'bullmq';
import { QUEUE_NAMES } from './queue.constants';
import { createRedisConnection } from './queue.connection';
import { EmailJobPayload } from '../modules/scheduler/scheduler.types';
import { logger } from '../shared/utils/logger';

class QueueRegistry {
  private emailSendingQueue: Queue<EmailJobPayload> | null = null;
  private notificationQueue: Queue<any> | null = null;
  private reconciliationQueue: Queue<any> | null = null;

  getEmailSendingQueue(): Queue<EmailJobPayload> {
    if (!this.emailSendingQueue) {
      const connection = createRedisConnection(QUEUE_NAMES.EMAIL_SENDING);
      this.emailSendingQueue = new Queue<EmailJobPayload>(QUEUE_NAMES.EMAIL_SENDING, {
        connection,
      });
      logger.info({ queue: QUEUE_NAMES.EMAIL_SENDING }, 'BullMQ Queue initialized');
    }
    return this.emailSendingQueue;
  }

  getNotificationQueue(): Queue<any> {
    if (!this.notificationQueue) {
      const connection = createRedisConnection(QUEUE_NAMES.NOTIFICATION);
      this.notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, { connection });
      logger.info({ queue: QUEUE_NAMES.NOTIFICATION }, 'BullMQ Queue initialized');
    }
    return this.notificationQueue;
  }

  getReconciliationQueue(): Queue<any> {
    if (!this.reconciliationQueue) {
      const connection = createRedisConnection(QUEUE_NAMES.EMAIL_RECONCILIATION);
      this.reconciliationQueue = new Queue(QUEUE_NAMES.EMAIL_RECONCILIATION, { connection });
      logger.info({ queue: QUEUE_NAMES.EMAIL_RECONCILIATION }, 'BullMQ Queue initialized');
    }
    return this.reconciliationQueue;
  }

  async closeAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    if (this.emailSendingQueue) promises.push(this.emailSendingQueue.close());
    if (this.notificationQueue) promises.push(this.notificationQueue.close());
    if (this.reconciliationQueue) promises.push(this.reconciliationQueue.close());

    await Promise.all(promises);
    this.emailSendingQueue = null;
    this.notificationQueue = null;
    this.reconciliationQueue = null;
    logger.info('All BullMQ queues closed');
  }
}

export const queueRegistry = new QueueRegistry();

