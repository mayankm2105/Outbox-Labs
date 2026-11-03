import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SchedulerService } from '../../src/modules/scheduler/scheduler.service';
import { queueRegistry } from '../../src/queues/queue.registry';

describe('SchedulerService', () => {
  const mockQueue = {
    add: vi.fn(),
    addBulk: vi.fn(),
    getJob: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(queueRegistry, 'getEmailSendingQueue').mockReturnValue(mockQueue as any);
  });

  it('enqueues delayed job with generation-based job ID', async () => {
    mockQueue.add.mockResolvedValue({ id: 'job-1' });

    const scheduledAt = new Date(Date.now() + 10000);
    const jobId = await SchedulerService.enqueueEmailJob({
      id: 'rec-1',
      campaignId: 'camp-1',
      userId: 'user-1',
      senderAccountId: 'sender-1',
      scheduledAt,
      retryCount: 0,
    });

    expect(jobId).toBe('email-rec-1-gen-0');
    expect(mockQueue.add).toHaveBeenCalledTimes(1);

    const [jobName, payload, options] = mockQueue.add.mock.calls[0];
    expect(jobName).toBe('send-email');
    expect(payload.emailRecordId).toBe('rec-1');
    expect(payload.campaignId).toBe('camp-1');
    expect(options.jobId).toBe('email-rec-1-gen-0');
    expect(options.delay).toBeGreaterThanOrEqual(9000);
  });

  it('bulk enqueues jobs efficiently using addBulk', async () => {
    mockQueue.addBulk.mockResolvedValue([]);

    const records = [
      {
        id: 'rec-1',
        campaignId: 'camp-1',
        userId: 'user-1',
        senderAccountId: 'sender-1',
        scheduledAt: new Date(Date.now() + 5000),
        retryCount: 0,
      },
      {
        id: 'rec-2',
        campaignId: 'camp-1',
        userId: 'user-1',
        senderAccountId: 'sender-1',
        scheduledAt: new Date(Date.now() + 15000),
        retryCount: 1,
      },
    ];

    const jobIds = await SchedulerService.enqueueBulkEmailJobs(records);

    expect(jobIds).toEqual(['email-rec-1-gen-0', 'email-rec-2-gen-1']);
    expect(mockQueue.addBulk).toHaveBeenCalledTimes(1);

    const bulkArg = mockQueue.addBulk.mock.calls[0][0];
    expect(bulkArg).toHaveLength(2);
    expect(bulkArg[0].opts.jobId).toBe('email-rec-1-gen-0');
    expect(bulkArg[1].opts.jobId).toBe('email-rec-2-gen-1');
  });

  it('removes pending delayed job if job is in delayed state', async () => {
    const mockJob = {
      getState: vi.fn().mockResolvedValue('delayed'),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    mockQueue.getJob.mockResolvedValue(mockJob);

    const removed = await SchedulerService.removePendingJob('rec-1', 0);
    expect(removed).toBe(true);
    expect(mockJob.remove).toHaveBeenCalled();
  });

  it('does not remove job if already active or completed', async () => {
    const mockJob = {
      getState: vi.fn().mockResolvedValue('active'),
      remove: vi.fn(),
    };
    mockQueue.getJob.mockResolvedValue(mockJob);

    const removed = await SchedulerService.removePendingJob('rec-1', 0);
    expect(removed).toBe(false);
    expect(mockJob.remove).not.toHaveBeenCalled();
  });
});

