import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

export class EmailEventRepository {
  static async create(
    params: {
      emailRecordId: string;
      eventType: string;
      previousStatus?: string | null;
      newStatus?: string | null;
      metadata?: Prisma.InputJsonValue;
    },
    tx: Prisma.TransactionClient = prisma,
  ) {
    return tx.emailEvent.create({
      data: {
        emailRecordId: params.emailRecordId,
        eventType: params.eventType,
        previousStatus: params.previousStatus,
        newStatus: params.newStatus,
        metadata: params.metadata,
      },
    });
  }

  static async listByEmailRecord(emailRecordId: string) {
    return prisma.emailEvent.findMany({
      where: { emailRecordId },
      orderBy: { createdAt: 'asc' },
    });
  }
}

