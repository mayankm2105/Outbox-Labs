import { Prisma, CampaignStatus } from '@prisma/client';
import { prisma } from '../../config/database';

export class CampaignRepository {
  static async create(
    data: {
      userId: string;
      senderAccountId: string;
      subject: string;
      body: string;
      startAt: Date;
      delaySeconds: number;
      hourlyLimit: number;
      totalRecipients: number;
      status?: CampaignStatus;
    },
    tx: Prisma.TransactionClient = prisma,
  ) {
    return tx.emailCampaign.create({
      data: {
        ...data,
        status: data.status ?? CampaignStatus.SCHEDULED,
      },
    });
  }

  static async findByIdAndUser(id: string, userId: string) {
    return prisma.emailCampaign.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        senderAccount: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });
  }

  static async listByUser(
    userId: string,
    params: { skip: number; limit: number },
  ) {
    const [items, total] = await Promise.all([
      prisma.emailCampaign.findMany({
        where: { userId },
        skip: params.skip,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          senderAccount: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      }),
      prisma.emailCampaign.count({ where: { userId } }),
    ]);

    return { items, total };
  }

  static async updateStatus(
    id: string,
    status: CampaignStatus,
    tx: Prisma.TransactionClient = prisma,
  ) {
    return tx.emailCampaign.update({
      where: { id },
      data: { status },
    });
  }

  static async getCampaignStats(campaignId: string) {
    const counts = await prisma.emailRecord.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: {
        _all: true,
      },
    });

    const stats: Record<string, number> = {
      total: 0,
      SCHEDULED: 0,
      PROCESSING: 0,
      SENT: 0,
      FAILED: 0,
      CANCELLED: 0,
      RETRY_SCHEDULED: 0,
      DELIVERY_UNKNOWN: 0,
    };

    for (const group of counts) {
      stats[group.status] = group._count._all;
      stats.total += group._count._all;
    }

    return stats;
  }
}

