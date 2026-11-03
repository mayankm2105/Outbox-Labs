import Redis, { RedisOptions } from 'ioredis';
import { env } from '../config/env';
import { logger } from '../shared/utils/logger';

export function createRedisConnection(connectionName = 'bullmq'): Redis {
  const options: RedisOptions = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    retryStrategy(times) {
      const delay = Math.min(times * 100, 3000);
      logger.warn({ connectionName, attempt: times, delayMs: delay }, 'BullMQ Redis reconnecting');
      return delay;
    },
  };

  const client = new Redis(options);

  client.on('error', (err) => {
    logger.error({ connectionName, err }, 'BullMQ Redis connection error');
  });

  return client;
}

