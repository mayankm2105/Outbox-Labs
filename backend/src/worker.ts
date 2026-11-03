import { env } from './config/env';
import { logger } from './shared/utils/logger';
import { prisma } from './config/database';
import { closeRedisConnection } from './config/redis';
import { queueRegistry } from './queues/queue.registry';
import { OutboxWorker } from './workers/outbox.worker';
import { ReconciliationWorker } from './workers/reconciliation.worker';
import { EmailSendingWorker } from './workers/email-sending.worker';

logger.info(
  {
    env: env.NODE_ENV,
    concurrency: env.EMAIL_WORKER_CONCURRENCY,
  },
  '👷 ReachInbox Background Worker process initializing...',
);

const outboxWorker = new OutboxWorker();
const reconciliationWorker = new ReconciliationWorker();
const emailSendingWorker = new EmailSendingWorker();

// Start workers
outboxWorker.start();
reconciliationWorker.start();
emailSendingWorker.start();

let isShuttingDown = false;

async function handleWorkerShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, 'Worker graceful shutdown initiated');

  try {
    await emailSendingWorker.stop();
  } catch (err) {
    logger.error({ err }, 'Error stopping email sending worker');
  }

  try {
    await outboxWorker.stop();
  } catch (err) {
    logger.error({ err }, 'Error stopping outbox worker');
  }

  try {
    await reconciliationWorker.stop();
  } catch (err) {
    logger.error({ err }, 'Error stopping reconciliation worker');
  }

  try {
    await queueRegistry.closeAll();
  } catch (err) {
    logger.error({ err }, 'Error closing BullMQ queues');
  }

  try {
    await prisma.$disconnect();
    logger.info('Database connection disconnected');
  } catch (err) {
    logger.error({ err }, 'Error disconnecting database');
  }

  try {
    await closeRedisConnection();
  } catch (err) {
    logger.error({ err }, 'Error closing Redis connection');
  }

  logger.info('Worker shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => handleWorkerShutdown('SIGTERM'));
process.on('SIGINT', () => handleWorkerShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Worker Unhandled Promise Rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Worker Uncaught Exception thrown');
  process.exit(1);
});
