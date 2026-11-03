import { Prisma, EmailStatus } from '@prisma/client';
import { prisma } from '../../config/database';

export class EmailRepository {
  static async createMany(
    records: Prisma.EmailRecordCreateManyInput[],
    tx: Prisma.TransactionClient = prisma,
  ) {
    return tx.emailRecord.createMany({
      data: records,
    });
  }

  static async findByIdAndUser(id: string, userId: string) {
    return prisma.emailRecord.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        campaign: {
          select: {
            id: true,
            subject: true,
            status: true,
            startAt: true,
            delaySeconds: true,
            hourlyLimit: true,
          },
        },
        senderAccount: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  static async listScheduledByUser(
    userId: string,
    params: {
      skip: number;
      limit: number;
      search?: string;
      campaignId?: string;
      status?: EmailStatus;
      sortBy?: 'scheduledAt' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    const where: Prisma.EmailRecordWhereInput = {
      userId,
      status: params.status ?? {
        in: [EmailStatus.SCHEDULED, EmailStatus.RETRY_SCHEDULED, EmailStatus.CREATED],
      },
    };

    if (params.campaignId) {
      where.campaignId = params.campaignId;
    }

    if (params.search) {
      where.OR = [
        { recipientEmail: { contains: params.search, mode: 'insensitive' } },
        { subject: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const orderBy = {
      [params.sortBy ?? 'scheduledAt']: params.sortOrder ?? 'asc',
    };

    const [items, total] = await Promise.all([
      prisma.emailRecord.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy,
        select: {
          id: true,
          campaignId: true,
          recipientEmail: true,
          subject: true,
          scheduledAt: true,
          status: true,
          retryCount: true,
          sequenceNumber: true,
          createdAt: true,
        },
      }),
      prisma.emailRecord.count({ where }),
    ]);

    return { items, total };
  }

  static async listSentByUser(
    userId: string,
    params: {
      skip: number;
      limit: number;
      search?: string;
      campaignId?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    const where: Prisma.EmailRecordWhereInput = {
      userId,
      status: EmailStatus.SENT,
    };

    if (params.campaignId) {
      where.campaignId = params.campaignId;
    }

    if (params.search) {
      where.OR = [
        { recipientEmail: { contains: params.search, mode: 'insensitive' } },
        { subject: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.startDate || params.endDate) {
      where.sentAt = {};
      if (params.startDate) where.sentAt.gte = params.startDate;
      if (params.endDate) where.sentAt.lte = params.endDate;
    }

    const [items, total] = await Promise.all([
      prisma.emailRecord.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy: { sentAt: 'desc' },
        select: {
          id: true,
          campaignId: true,
          recipientEmail: true,
          subject: true,
          sentAt: true,
          status: true,
          providerMessageId: true,
          sequenceNumber: true,
        },
      }),
      prisma.emailRecord.count({ where }),
    ]);

    return { items, total };
  }

  static async listFailedByUser(
    userId: string,
    params: {
      skip: number;
      limit: number;
      search?: string;
      campaignId?: string;
    },
  ) {
    const where: Prisma.EmailRecordWhereInput = {
      userId,
      status: EmailStatus.FAILED,
    };

    if (params.campaignId) {
      where.campaignId = params.campaignId;
    }

    if (params.search) {
      where.OR = [
        { recipientEmail: { contains: params.search, mode: 'insensitive' } },
        { subject: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.emailRecord.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          campaignId: true,
          recipientEmail: true,
          subject: true,
          scheduledAt: true,
          status: true,
          retryCount: true,
          errorCode: true,
          errorMessage: true,
          updatedAt: true,
        },
      }),
      prisma.emailRecord.count({ where }),
    ]);

    return { items, total };
  }

  static async listByCampaign(
    campaignId: string,
    userId: string,
    params: { skip: number; limit: number },
  ) {
    const where: Prisma.EmailRecordWhereInput = {
      campaignId,
      userId,
    };

    const [items, total] = await Promise.all([
      prisma.emailRecord.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy: { sequenceNumber: 'asc' },
        select: {
          id: true,
          recipientEmail: true,
          subject: true,
          sequenceNumber: true,
          scheduledAt: true,
          sentAt: true,
          status: true,
          retryCount: true,
          errorCode: true,
          errorMessage: true,
        },
      }),
      prisma.emailRecord.count({ where }),
    ]);

    return { items, total };
  }

  static async findCancellableByCampaign(campaignId: string, userId: string) {
    return prisma.emailRecord.findMany({
      where: {
        campaignId,
        userId,
        status: {
          in: [EmailStatus.CREATED, EmailStatus.SCHEDULED, EmailStatus.RETRY_SCHEDULED],
        },
      },
    });
  }

  static async cancelEmailsByIds(
    ids: string[],
    tx: Prisma.TransactionClient = prisma,
  ) {
    return tx.emailRecord.updateMany({
      where: {
        id: { in: ids },
        status: {
          in: [EmailStatus.CREATED, EmailStatus.SCHEDULED, EmailStatus.RETRY_SCHEDULED],
        },
      },
      data: {
        status: EmailStatus.CANCELLED,
      },
    });
  }
}

