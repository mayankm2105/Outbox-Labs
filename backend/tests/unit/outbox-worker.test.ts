import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutboxWorker } from '../../src/workers/outbox.worker';
import { prisma } from '../../src/config/database';
import { SchedulerService } from '../../src/modules/scheduler/scheduler.service';

describe('OutboxWorker', () => {
  let worker: OutboxWorker;

  beforeEach(() => {
    vi.clearAllMocks();
    worker = new OutboxWorker();
  });

  it('processes unpublished outbox events and marks them published', async () => {
    const mockEvents = [
      {
        id: 'outbox-1',
        type: 'EMAIL_SCHEDULE',
        payload: {
          campaignId: 'camp-1',
          userId: 'user-1',
          emailRecordIds: ['rec-1', 'rec-2'],
        },
        publishedAt: null,
        createdAt: new Date(),
      },
    ];

    const mockRecords = [
      {
        id: 'rec-1',
        campaignId: 'camp-1',
        userId: 'user-1',
        senderAccountId: 'sender-1',
        scheduledAt: new Date(),
        retryCount: 0,
      },
      {
        id: 'rec-2',
        campaignId: 'camp-1',
        userId: 'user-1',
        senderAccountId: 'sender-1',
        scheduledAt: new Date(),
        retryCount: 0,
      },
    ];

    vi.spyOn(prisma.outboxEvent, 'findMany').mockResolvedValue(mockEvents as any);
    vi.spyOn(prisma.emailRecord, 'findMany').mockResolvedValue(mockRecords as any);
    const updateSpy = vi.spyOn(prisma.outboxEvent, 'update').mockResolvedValue({} as any);
    const enqueueSpy = vi.spyOn(SchedulerService, 'enqueueBulkEmailJobs').mockResolvedValue(['job-1', 'job-2']);

    const processed = await worker.processPendingEvents(10);

    expect(processed).toBe(1);
    expect(enqueueSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'outbox-1' },
        data: expect.objectContaining({ publishedAt: expect.any(Date) }),
      }),
    );
  });

  it('returns 0 when no unpublished events exist', async () => {
    vi.spyOn(prisma.outboxEvent, 'findMany').mockResolvedValue([]);
    const processed = await worker.processPendingEvents(10);
    expect(processed).toBe(0);
  });
});

