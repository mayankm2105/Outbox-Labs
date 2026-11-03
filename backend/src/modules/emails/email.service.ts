import { EmailRepository } from './email.repository';
import { ApiError } from '../../shared/errors/api-error';
import { ListEmailsQuery } from './email.validation';

export class EmailService {
  static async getEmailById(emailId: string, userId: string) {
    const email = await EmailRepository.findByIdAndUser(emailId, userId);
    if (!email) {
      throw ApiError.notFound('Email record not found', 'EMAIL_NOT_FOUND');
    }
    return email;
  }

  static async listScheduled(
    userId: string,
    params: { skip: number; limit: number; query: ListEmailsQuery },
  ) {
    return EmailRepository.listScheduledByUser(userId, {
      skip: params.skip,
      limit: params.limit,
      search: params.query.search,
      campaignId: params.query.campaignId,
      status: params.query.status,
      sortBy: params.query.sortBy === 'createdAt' ? 'createdAt' : 'scheduledAt',
      sortOrder: params.query.sortOrder,
    });
  }

  static async listSent(
    userId: string,
    params: { skip: number; limit: number; query: ListEmailsQuery },
  ) {
    return EmailRepository.listSentByUser(userId, {
      skip: params.skip,
      limit: params.limit,
      search: params.query.search,
      campaignId: params.query.campaignId,
      startDate: params.query.startDate ? new Date(params.query.startDate) : undefined,
      endDate: params.query.endDate ? new Date(params.query.endDate) : undefined,
    });
  }

  static async listFailed(
    userId: string,
    params: { skip: number; limit: number; query: ListEmailsQuery },
  ) {
    return EmailRepository.listFailedByUser(userId, {
      skip: params.skip,
      limit: params.limit,
      search: params.query.search,
      campaignId: params.query.campaignId,
    });
  }

  static async listByCampaign(
    campaignId: string,
    userId: string,
    params: { skip: number; limit: number },
  ) {
    return EmailRepository.listByCampaign(campaignId, userId, params);
  }
}

