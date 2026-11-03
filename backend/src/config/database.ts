import { PrismaClient } from '@prisma/client';
import { env } from './env';

/**
 * Prisma client singleton.
 *
 * In development we reuse the instance across hot-reloads to avoid
 * exhausting the database connection pool.
 */

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
    errorFormat: 'minimal',
  });
}

export const prisma: PrismaClient =
  env.NODE_ENV === 'production'
    ? createPrismaClient()
    : (global.__prisma ??= createPrismaClient());

/**
 * Verify the database connection.
 * Called from the health-check endpoint and on startup.
 */
export async function checkDatabaseConnection(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

