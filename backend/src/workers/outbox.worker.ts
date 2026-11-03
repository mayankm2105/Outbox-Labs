import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database';
import { getRedisClient } from '../config/redis';
import { env } from '../config/env';
import { SchedulerService } from '../modules/scheduler/scheduler.service';
import { logger } from '../shared/utils/logger';

const LOCK_KEY = 'lock:outbox-publisher';
const LOCK_TTL_MS = 10000;

export class OutboxWorker {
  private workerId = uuidv4();
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private isRunning = false;

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info(
      { intervalMs: env.OUTBOX_POLL_INTERVAL_MS, workerId: this.workerId },
      'Outbox Publisher Worker started',
    );

    // Initial immediate tick, then recurring interval
    this.processOutboxSafe().catch((err) => {
      logger.error({ err }, 'Error in initial outbox tick');
    });

    this.timer = setInterval(() => {
      this.processOutboxSafe().catch((err) => {
        logger.error({ err }, 'Error in outbox poll interval');
      });
    }, env.OUTBOX_POLL_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info('Outbox Publisher Worker stopped');
  }

  private async acquireLock(): Promise<boolean> {
    try {
      const redis = getRedisClient();
      const res = await redis.set(LOCK_KEY, this.workerId, 'PX', LOCK_TTL_MS, 'NX');
      return res === 'OK';
    } catch (err) {
      logger.error({ err }, 'Failed to acquire outbox distributed lock');
      return false;
    }
  }

  private async releaseLock(): Promise<void> {
    try {
      const redis = getRedisClient();
      // Lua script to safely release lock only if owned by this worker
      const lua = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await redis.eval(lua, 1, LOCK_KEY, this.workerId);
    } catch (err) {
      logger.error({ err }, 'Failed to release outbox distributed lock');
    }
  }

  /**
   * Safe execution wrapper preventing overlapping polls
   */
  async processOutboxSafe(): Promise<void> {
    if (!this.isRunning || this.isProcessing) return;

    this.isProcessing = true;
    const lockAcquired = await this.acquireLock();

    if (!lockAcquired) {
      this.isProcessing = false;
      return;
    }

    try {
      await this.processPendingEvents();
    } catch (err) {
      logger.error({ err }, 'Error processing outbox events');
    } finally {
      await this.releaseLock();
      this.isProcessing = false;
    }
  }

  /**
   * Processes a batch of unpublished outbox events
   */
  async processPendingEvents(batchSize = 50): Promise<number> {
    const events = await prisma.outboxEvent.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });

    if (events.length === 0) return 0;

    logger.debug({ count: events.length }, 'Processing unpublished outbox events');

    for (const event of events) {
      try {
        if (event.type === 'EMAIL_SCHEDULE') {
          const payload = event.payload as {
            campaignId: string;
            userId: string;
            emailRecordIds: string[];
          };

          const records = await prisma.emailRecord.findMany({
            where: {
              id: { in: payload.emailRecordIds },
            },
          });

          if (records.length > 0) {
            await SchedulerService.enqueueBulkEmailJobs(
              records.map((r) => ({
                id: r.id,
                campaignId: r.campaignId,
                userId: r.userId,
                senderAccountId: r.senderAccountId,
                scheduledAt: r.scheduledAt,
                retryCount: r.retryCount,
              })),
            );
          }
        }

        // Mark event as published
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: { publishedAt: new Date() },
        });

        logger.info({ eventId: event.id, type: event.type }, 'Outbox event published to queue');
      } catch (err) {
        logger.error({ err, eventId: event.id }, 'Failed to publish outbox event; will retry');
      }
    }

    return events.length;
  }
}

