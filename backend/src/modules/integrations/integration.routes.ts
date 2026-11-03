import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';

export const integrationRouter = Router();

integrationRouter.get('/slack/status', requireAuth, (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      connected: false,
    },
  });
});

integrationRouter.post('/slack/test', requireAuth, (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      message: 'Test notification sent to Slack',
    },
  });
});

integrationRouter.delete('/slack', requireAuth, (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      message: 'Slack disconnected',
    },
  });
});

