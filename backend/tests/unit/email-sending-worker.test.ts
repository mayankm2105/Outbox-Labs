import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailSendingWorker } from '../../src/workers/email-sending.worker';
import { prisma } from '../../src/config/database';
import { EmailStatus, CampaignStatus } from '@prisma/client';
import { SchedulerService } from '../../src/modules/scheduler/scheduler.service';

describe('EmailSendingWorker', () => {
  let mockProvider: any;
  let worker: EmailSendingWorker;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProvider = {
      sendEmail: vi.fn(),
    };
    worker = new EmailSendingWorker(mockProvider);
  });

  const baseEmailRecord = {
    id: 'email-1',
    campaignId: 'camp-1',
    userId: 'user-1',
    senderAccountId: 'sender-1',
    recipientEmail: 'recipient@example.com',
    subject: 'Update',
    body: 'Hello',
    sequenceNumber: 1,
    scheduledAt: new Date(),
    status: EmailStatus.SCHEDULED,
    retryCount: 0,
    maxRetries: 5,
    campaign: {
      id: 'camp-1',
      status: CampaignStatus.SCHEDULED,
    },
    senderAccount: {
      id: 'sender-1',
      email: 'sender@example.com',
      displayName: 'Sender Display',
      isActive: true,
      smtpHost: '',
      smtpPort: 587,
      smtpUsername: '',
      smtpPasswordEncrypted: '',
    },
  };

  it('delivers email successfully and marks status as SENT with previewUrl', async () => {
    vi.spyOn(prisma.emailRecord, 'findUnique').mockResolvedValue(baseEmailRecord as any);

    mockProvider.sendEmail.mockResolvedValue({
      messageId: '<msg-id-123>',
      previewUrl: 'https://ethereal.email/message/123',
    });

    const txRecords: any[] = [];
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        const mockTx = {
          emailRecord: {
            update: vi.fn().mockImplementation((args) => {
              txRecords.push(args);
              return { ...baseEmailRecord, ...args.data };
            }),
            findMany: vi.fn().mockResolvedValue([{ status: EmailStatus.SENT }]),
          },
          emailEvent: {
            create: vi.fn(),
          },
          emailCampaign: {
            update: vi.fn(),
          },
        };
        return callback(mockTx);
      }
      return [];
    });

    const mockJob = {
      id: 'job-1',
      data: {
        emailRecordId: 'email-1',
        campaignId: 'camp-1',
        userId: 'user-1',
        senderAccountId: 'sender-1',
        scheduledAt: new Date().toISOString(),
      },
    };

    await worker.processJob(mockJob as any);

    expect(mockProvider.sendEmail).toHaveBeenCalledTimes(1);
    expect(mockProvider.sendEmail).toHaveBeenCalledWith({
      from: '"Sender Display" <sender@example.com>',
      to: 'recipient@example.com',
      subject: 'Update',
      body: 'Hello',
    });

    const sentUpdate = txRecords.find((r) => r.data.status === EmailStatus.SENT);
    expect(sentUpdate).toBeDefined();
    expect(sentUpdate.data.providerMessageId).toBe('<msg-id-123>');
  });

  it('skips sending if email is already CANCELLED in DB', async () => {
    vi.spyOn(prisma.emailRecord, 'findUnique').mockResolvedValue({
      ...baseEmailRecord,
      status: EmailStatus.CANCELLED,
    } as any);

    const mockJob = {
      id: 'job-1',
      data: { emailRecordId: 'email-1', campaignId: 'camp-1' },
    };

    await worker.processJob(mockJob as any);

    expect(mockProvider.sendEmail).not.toHaveBeenCalled();
  });

  it('skips sending if email is already SENT in DB (duplicate BullMQ job prevention)', async () => {
    vi.spyOn(prisma.emailRecord, 'findUnique').mockResolvedValue({
      ...baseEmailRecord,
      status: EmailStatus.SENT,
    } as any);

    const mockJob = {
      id: 'job-1',
      data: { emailRecordId: 'email-1', campaignId: 'camp-1' },
    };

    await worker.processJob(mockJob as any);

    expect(mockProvider.sendEmail).not.toHaveBeenCalled();
  });

  it('handles transient errors by scheduling retry and re-enqueuing to BullMQ', async () => {
    vi.spyOn(prisma.emailRecord, 'findUnique').mockResolvedValue(baseEmailRecord as any);

    mockProvider.sendEmail.mockRejectedValue({
      code: 'ETIMEDOUT',
      message: 'Connection timed out',
    });

    let updatedRecordData: any = null;
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        const mockTx = {
          emailRecord: {
            update: vi.fn().mockImplementation((args) => {
              updatedRecordData = args.data;
              return { ...baseEmailRecord, ...args.data };
            }),
          },
          emailEvent: {
            create: vi.fn(),
          },
        };
        return callback(mockTx);
      }
      return [];
    });

    const enqueueSpy = vi.spyOn(SchedulerService, 'enqueueEmailJob').mockResolvedValue('job-retry');

    const mockJob = {
      id: 'job-1',
      data: {
        emailRecordId: 'email-1',
        campaignId: 'camp-1',
        userId: 'user-1',
        senderAccountId: 'sender-1',
        scheduledAt: new Date().toISOString(),
      },
    };

    await worker.processJob(mockJob as any);

    expect(updatedRecordData).toBeDefined();
    expect(updatedRecordData.status).toBe(EmailStatus.RETRY_SCHEDULED);
    expect(updatedRecordData.retryCount).toBe(1);
    expect(updatedRecordData.errorCode).toBe('ETIMEDOUT');
    expect(enqueueSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'email-1',
        retryCount: 1,
      }),
    );
  });

  it('handles permanent errors by marking email as FAILED without retry', async () => {
    vi.spyOn(prisma.emailRecord, 'findUnique').mockResolvedValue(baseEmailRecord as any);

    mockProvider.sendEmail.mockRejectedValue({
      responseCode: 550,
      message: '5.1.1 User mailbox unknown',
    });

    let updatedRecordData: any = null;
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      if (typeof callback === 'function') {
        const mockTx = {
          emailRecord: {
            update: vi.fn().mockImplementation((args) => {
              updatedRecordData = args.data;
              return { ...baseEmailRecord, ...args.data };
            }),
            findMany: vi.fn().mockResolvedValue([{ status: EmailStatus.FAILED }]),
          },
          emailEvent: {
            create: vi.fn(),
          },
          emailCampaign: {
            update: vi.fn(),
          },
        };
        return callback(mockTx);
      }
      return [];
    });

    const enqueueSpy = vi.spyOn(SchedulerService, 'enqueueEmailJob');

    const mockJob = {
      id: 'job-1',
      data: {
        emailRecordId: 'email-1',
        campaignId: 'camp-1',
        userId: 'user-1',
        senderAccountId: 'sender-1',
        scheduledAt: new Date().toISOString(),
      },
    };

    await worker.processJob(mockJob as any);

    expect(updatedRecordData).toBeDefined();
    expect(updatedRecordData.status).toBe(EmailStatus.FAILED);
    expect(updatedRecordData.errorCode).toBe('SMTP_550');
    expect(enqueueSpy).not.toHaveBeenCalled();
  });
});

