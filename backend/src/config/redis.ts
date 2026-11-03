import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../shared/utils/logger';

/**
 * IORedis client singleton used by:
 *  - BullMQ (separate connection per queue — see queue.connection.ts)
 *  - Rate-limiter service
 *  - Session store (via connect-pg-simple — uses PG, not Redis)
 *  - Distributed locks (outbox publisher)
 *
 * BullMQ requires its own dedicated connection instances.
 * Do NOT share this client with BullMQ workers/queues.
 */

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (redisClient) return redisClient;

  if (env.REDIS_URL) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        logger.warn({ attempt: times, delayMs: delay }, 'Redis reconnect attempt');
        return delay;
      },
    });
  } else {
    redisClient = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null, // Required by BullMQ; safe for general use too
      enableReadyCheck: true,
      lazyConnect: false,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        logger.warn({ attempt: times, delayMs: delay }, 'Redis reconnect attempt');
        return delay;
      },
    });
  }

  redisClient.on('connect', () => {
    logger.info('Redis connected');
  });

  redisClient.on('ready', () => {
    logger.info('Redis ready');
  });

  redisClient.on('error', (err) => {
    logger.error({ err }, 'Redis error');
  });

  redisClient.on('close', () => {
    logger.warn('Redis connection closed');
  });

  redisClient.on('reconnecting', () => {
    logger.info('Redis reconnecting');
  });

  return redisClient;
}

/**
 * Verify the Redis connection.
 * Called from the health-check endpoint and on startup.
 */
export async function checkRedisConnection(): Promise<void> {
  const client = getRedisClient();
  const pong = await client.ping();
  if (pong !== 'PONG') {
    throw new Error(`Unexpected Redis PING response: ${pong}`);
  }
}

/**
 * Close the Redis connection gracefully.
 * Called during worker/server shutdown.
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed gracefully');
  }
}

