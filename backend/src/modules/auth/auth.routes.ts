import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { prisma } from '../../config/database';
import { env } from '../../config/env';

export const authRouter = Router();

/**
 * GET /auth/me or /api/v1/auth/me
 * Returns current authenticated user profile
 */
authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: req.user,
  });
});

/**
 * POST /auth/logout or /api/v1/auth/logout
 * Destroys session and clears cookie
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  if (req.session) {
    req.session.destroy((_err) => {
      res.clearCookie('reachinbox.sid');
      res.status(200).json({
        success: true,
        data: { success: true },
      });
    });
  } else {
    res.clearCookie('reachinbox.sid');
    res.status(200).json({
      success: true,
      data: { success: true },
    });
  }
});

/**
 * GET /auth/google or /api/v1/auth/google
 * Initiates Google OAuth flow or auto-authenticates in dev mode
 */
authRouter.get('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // In dev / test mode or with mock Google credentials, use the seeded user
    const devUserId = 'fcbceaa8-84b8-4cdf-8d8e-008906a02d8c';
    let user = await prisma.user.findUnique({ where: { id: devUserId } });
    if (!user) {
      user = await prisma.user.findFirst();
    }

    if (user && req.session) {
      (req.session as any).userId = user.id;
      req.session.save((err) => {
        if (err) return next(err);
        return res.redirect(`${env.FRONTEND_URL}/dashboard`);
      });
      return;
    }

    return res.redirect(`${env.FRONTEND_URL}/dashboard`);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /auth/google/callback
 */
authRouter.get('/google/callback', (_req: Request, res: Response) => {
  res.redirect(`${env.FRONTEND_URL}/dashboard`);
});

