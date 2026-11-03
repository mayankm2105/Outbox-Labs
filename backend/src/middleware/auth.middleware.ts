import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../shared/errors/api-error';
import { env } from '../config/env';
import { prisma } from '../config/database';

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  // Check if session or passport attached user
  if (req.user && req.user.id) {
    return next();
  }

  // Check session cookie userId
  if ((req.session as any)?.userId) {
    try {
      const user = await prisma.user.findUnique({ where: { id: (req.session as any).userId } });
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatarUrl,
        };
        return next();
      }
    } catch {
      // ignore
    }
  }

  // Check development / test bypass header
  if (env.NODE_ENV !== 'production' && req.headers['x-user-id']) {
    const userId = String(req.headers['x-user-id']);
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatarUrl,
        };
        return next();
      }
    } catch {
      // ignore and proceed to reject
    }
  }

  next(ApiError.unauthorized('Authentication required', 'UNAUTHORIZED'));
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'ADMIN') {
    return next(ApiError.forbidden('Admin access required', 'FORBIDDEN'));
  }
  next();
}

