import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CampaignService } from '../../src/modules/campaigns/campaign.service';
import { SenderRepository } from '../../src/modules/senders/sender.repository';
import { prisma } from '../../src/config/database';
import { CampaignStatus, EmailStatus } from '@prisma/client';

describe('CampaignService.scheduleCampaign', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  const senderId = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully schedules a campaign with deduplicated recipients and sequential delays', async () => {
    vi.spyOn(SenderRepository, 'findByIdAndUser').mockResolvedValue({
      id: senderId,
      userId,
      email: 'sender@reachinbox.com',
      displayName: 'ReachInbox Sender',
      smtpHost: 'smtp.ethereal.email',
      smtpPort: 587,
      smtpUsername: 'ethereal_user',
      smtpPasswordEncrypted: 'encrypted',
      isActive: true,
      createdAt: new Date(),
    });

    const mockCreatedCampaign = {
      id: 'campaign-uuid-1',
      userId,
      senderAccountId: senderId,
      subject: 'Welcome to ReachInbox',
      body: 'Hello World',
      startAt: new Date(Date.now() + 60000),
      delaySeconds: 10,
      hourlyLimit: 50,
      totalRecipients: 2,
      status: CampaignStatus.SCHEDULED,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let insertedRecords: any[] = [];
    let outboxEvents: any[] = [];

    // Mock prisma transaction
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      const mockTx = {
        emailCampaign: {
          create: vi.fn().mockResolvedValue(mockCreatedCampaign),
        },
        emailRecord: {
          createMany: vi.fn().mockImplementation((args: any) => {
            insertedRecords = args.data;
            return { count: args.data.length };
          }),
        },
        outboxEvent: {
          create: vi.fn().mockImplementation((args: any) => {
            outboxEvents.push(args.data);
            return { id: 'outbox-uuid', ...args.data };
          }),
        },
      };
      return callback(mockTx);
    });

    const result = await CampaignService.scheduleCampaign(userId, {
      senderAccountId: senderId,
      subject: 'Welcome to ReachInbox',
      body: 'Hello World',
      recipients: [
        'alice@example.com',
        'bob@example.com',
        'ALICE@example.com', // Duplicate
      ],
      startAt: new Date(Date.now() + 60000).toISOString(),
      delaySeconds: 10,
      hourlyLimit: 50,
    });

    expect(result.totalRecipients).toBe(2);
    expect(result.deduplicatedCount).toBe(1);
    expect(result.status).toBe(CampaignStatus.SCHEDULED);
    expect(result.scheduledCount).toBe(2);

    expect(insertedRecords).toHaveLength(2);
    expect(insertedRecords[0].sequenceNumber).toBe(1);
    expect(insertedRecords[1].sequenceNumber).toBe(2);
    expect(insertedRecords[0].status).toBe(EmailStatus.SCHEDULED);

    // 10 second delay between sequence 1 and sequence 2
    const timeDiffMs =
      insertedRecords[1].scheduledAt.getTime() - insertedRecords[0].scheduledAt.getTime();
    expect(timeDiffMs).toBe(10000);

    // Outbox event was created in same transaction
    expect(outboxEvents).toHaveLength(1);
    expect(outboxEvents[0].type).toBe('EMAIL_SCHEDULE');
    expect(outboxEvents[0].payload.campaignId).toBe(mockCreatedCampaign.id);
  });

  it('throws not found when sender account does not belong to user', async () => {
    vi.spyOn(SenderRepository, 'findByIdAndUser').mockResolvedValue(null);

    await expect(
      CampaignService.scheduleCampaign(userId, {
        senderAccountId: senderId,
        subject: 'Welcome',
        body: 'Body',
        recipients: ['alice@example.com'],
        startAt: new Date(Date.now() + 60000).toISOString(),
        delaySeconds: 0,
        hourlyLimit: 100,
      }),
    ).rejects.toThrow('Sender account not found or does not belong to you');
  });
});

