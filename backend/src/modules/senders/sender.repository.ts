import { prisma } from '../../config/database';

export class SenderRepository {
  static async findByIdAndUser(id: string, userId: string) {
    return prisma.senderAccount.findFirst({
      where: {
        id,
        userId,
      },
    });
  }

  static async listByUser(userId: string) {
    return prisma.senderAccount.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        id: true,
        userId: true,
        email: true,
        displayName: true,
        smtpHost: true,
        smtpPort: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  static async create(data: {
    userId: string;
    email: string;
    displayName?: string;
    smtpHost: string;
    smtpPort: number;
    smtpUsername: string;
    smtpPasswordEncrypted: string;
  }) {
    return prisma.senderAccount.create({
      data,
    });
  }
}

