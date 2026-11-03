import { createApp } from './app';
import { env } from './config/env';
import { logger } from './shared/utils/logger';
import { prisma } from './config/database';
import { closeRedisConnection } from './config/redis';
import { closeElasticsearchConnection } from './config/elasticsearch';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      env: env.NODE_ENV,
      apiUrl: env.API_BASE_URL,
    },
    '🚀 ReachInbox API server started',
  );
});

// Graceful shutdown handling
let isShuttingDown = false;

async function handleShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, 'Graceful shutdown initiated');

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      await prisma.$disconnect();
      logger.info('Database connection closed');
    } catch (err) {
      logger.error({ err }, 'Error disconnecting database');
    }

    try {
      await closeRedisConnection();
    } catch (err) {
      logger.error({ err }, 'Error closing Redis connection');
    }

    try {
      await closeElasticsearchConnection();
    } catch (err) {
      logger.error({ err }, 'Error closing Elasticsearch connection');
    }

    logger.info('Server shutdown complete');
    process.exit(0);
  });

  // Force shutdown after timeout
  setTimeout(() => {
    logger.error('Shutdown timed out, force exiting');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled Promise Rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception thrown');
  process.exit(1);
});

