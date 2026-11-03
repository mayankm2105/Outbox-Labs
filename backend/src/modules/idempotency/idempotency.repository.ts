import crypto from 'crypto';
import { prisma } from '../../config/database';

export class IdempotencyRepository {
  static hashPayload(payload: unknown): string {
    const serialized = JSON.stringify(payload ?? {});
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  static async find(userId: string, idempotencyKey: string) {
    return prisma.idempotencyKey.findUnique({
      where: {
        userId_idempotencyKey: {
          userId,
          idempotencyKey,
        },
      },
    });
  }

  static async create(params: {
    userId: string;
    idempotencyKey: string;
    requestHash: string;
    expiresAt: Date;
  }) {
    return prisma.idempotencyKey.create({
      data: {
        userId: params.userId,
        idempotencyKey: params.idempotencyKey,
        requestHash: params.requestHash,
        expiresAt: params.expiresAt,
      },
    });
  }

  static async updateResponse(params: {
    userId: string;
    idempotencyKey: string;
    responseStatus: number;
    responseBody: unknown;
  }) {
    return prisma.idempotencyKey.update({
      where: {
        userId_idempotencyKey: {
          userId: params.userId,
          idempotencyKey: params.idempotencyKey,
        },
      },
      data: {
        responseStatus: params.responseStatus,
        responseBody: params.responseBody as any,
      },
    });
  }
}

