import { v4 as uuidv4 } from 'uuid';
import { EmailStatus, CampaignStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { SenderRepository } from '../senders/sender.repository';
import { CampaignRepository } from './campaign.repository';
import { EmailRepository } from '../emails/email.repository';
import {
  ScheduleEmailInput,
  validateAndProcessStartAt,
  deduplicateRecipients,
} from './campaign.validation';
import { ApiError } from '../../shared/errors/api-error';
import { logger } from '../../shared/utils/logger';

export class CampaignService {
  static async scheduleCampaign(userId: string, input: ScheduleEmailInput) {
    // 1. Verify sender account ownership
    const sender = await SenderRepository.findByIdAndUser(input.senderAccountId, userId);
    if (!sender) {
      throw ApiError.notFound('Sender account not found or does not belong to you', 'SENDER_NOT_FOUND');
    }

    if (!sender.isActive) {
      throw ApiError.badRequest('Sender account is inactive', 'SENDER_INACTIVE');
    }

    // 2. Process startAt with 60-second grace window check
    const { effectiveStartAt } = validateAndProcessStartAt(input.startAt);

    // 3. Deduplicate recipients silently
    const { uniqueRecipients, deduplicatedCount } = deduplicateRecipients(input.recipients);

    if (uniqueRecipients.length === 0) {
      throw ApiError.badRequest('No valid recipients found', 'INVALID_RECIPIENTS');
    }

    const delayMs = input.delaySeconds * 1000;

    // 4. Build records in a single database transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create campaign record
      const campaign = await CampaignRepository.create(
        {
          userId,
          senderAccountId: sender.id,
          subject: input.subject,
          body: input.body,
          startAt: effectiveStartAt,
          delaySeconds: input.delaySeconds,
          hourlyLimit: input.hourlyLimit,
          totalRecipients: uniqueRecipients.length,
          status: CampaignStatus.SCHEDULED,
        },
        tx,
      );

      // Prepare individual email records
      const emailRecords = uniqueRecipients.map((recipientEmail, index) => {
        const sequenceNumber = index + 1; // 1-indexed
        const scheduledTime = new Date(effectiveStartAt.getTime() + index * delayMs);
        const emailRecordId = uuidv4();

        return {
          id: emailRecordId,
          campaignId: campaign.id,
          userId,
          senderAccountId: sender.id,
          recipientEmail,
          subject: input.subject,
          body: input.body,
          sequenceNumber,
          scheduledAt: scheduledTime,
          status: EmailStatus.SCHEDULED,
          retryCount: 0,
          maxRetries: 5,
        };
      });

      // Insert all email records
      await EmailRepository.createMany(emailRecords, tx);

      // Create outbox event for queue scheduling (Phase 3 will process this)
      await tx.outboxEvent.create({
        data: {
          type: 'EMAIL_SCHEDULE',
          payload: {
            campaignId: campaign.id,
            userId,
            emailRecordIds: emailRecords.map((r) => r.id),
          },
        },
      });

      return {
        campaignId: campaign.id,
        totalRecipients: uniqueRecipients.length,
        deduplicatedCount,
        status: campaign.status,
        scheduledCount: emailRecords.length,
      };
    });

    logger.info(
      {
        campaignId: result.campaignId,
        userId,
        recipientsCount: result.totalRecipients,
        deduplicatedCount,
        effectiveStartAt,
      },
      'Campaign scheduled successfully',
    );

    return result;
  }

  static async getCampaign(campaignId: string, userId: string) {
    const campaign = await CampaignRepository.findByIdAndUser(campaignId, userId);
    if (!campaign) {
      throw ApiError.notFound('Campaign not found', 'CAMPAIGN_NOT_FOUND');
    }

    const stats = await CampaignRepository.getCampaignStats(campaignId);

    return {
      ...campaign,
      stats,
    };
  }

  static async listCampaigns(userId: string, params: { skip: number; limit: number }) {
    return CampaignRepository.listByUser(userId, params);
  }

  static async cancelCampaign(campaignId: string, userId: string) {
    const campaign = await CampaignRepository.findByIdAndUser(campaignId, userId);
    if (!campaign) {
      throw ApiError.notFound('Campaign not found', 'CAMPAIGN_NOT_FOUND');
    }

    const cancellable = await EmailRepository.findCancellableByCampaign(campaignId, userId);

    if (cancellable.length === 0) {
      throw ApiError.badRequest(
        'Campaign has no pending or cancellable emails',
        'NO_CANCELLABLE_EMAILS',
      );
    }

    const cancellableIds = cancellable.map((e) => e.id);

    await prisma.$transaction(async (tx) => {
      // Cancel emails
      await EmailRepository.cancelEmailsByIds(cancellableIds, tx);

      // Log cancellation events
      for (const email of cancellable) {
        await tx.emailEvent.create({
          data: {
            emailRecordId: email.id,
            eventType: 'EMAIL_CANCELLED',
            previousStatus: email.status,
            newStatus: EmailStatus.CANCELLED,
            metadata: { reason: 'Campaign cancelled by user' },
          },
        });
      }

      // Re-evaluate campaign status
      await CampaignRepository.updateStatus(campaignId, CampaignStatus.CANCELLED, tx);
    });

    logger.info({ campaignId, userId, cancelledCount: cancellableIds.length }, 'Campaign cancelled');

    return {
      campaignId,
      cancelledCount: cancellableIds.length,
      status: CampaignStatus.CANCELLED,
    };
  }
}
