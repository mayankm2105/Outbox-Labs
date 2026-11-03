import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { configureSession } from './config/session';
import { requestLogger } from './middleware/request-logger.middleware';
import { errorHandler } from './middleware/error.middleware';
import { checkDatabaseConnection } from './config/database';
import { checkRedisConnection } from './config/redis';
import { checkElasticsearchConnection } from './config/elasticsearch';
import { ApiError } from './shared/errors/api-error';
import { emailRouter } from './modules/emails/email.routes';
import { campaignRouter } from './modules/campaigns/campaign.routes';
import { senderRouter } from './modules/senders/sender.routes';
import { authRouter } from './modules/auth/auth.routes';
import { integrationRouter } from './modules/integrations/integration.routes';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);

  // Security & utility middlewares
  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'x-user-id'],
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(requestLogger);

  // Session
  app.use(configureSession());

  // Health check endpoint
  app.get('/health', async (_req: Request, res: Response) => {
    const healthStatus: Record<string, string> = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };

    let isHealthy = true;

    try {
      await checkDatabaseConnection();
      healthStatus.postgres = 'ok';
    } catch (err: any) {
      isHealthy = false;
      healthStatus.postgres = `error: ${err.message}`;
    }

    try {
      await checkRedisConnection();
      healthStatus.redis = 'ok';
    } catch (err: any) {
      isHealthy = false;
      healthStatus.redis = `error: ${err.message}`;
    }

    try {
      await checkElasticsearchConnection();
      healthStatus.elasticsearch = 'ok';
    } catch (err: any) {
      healthStatus.elasticsearch = `error: ${err.message}`;
    }

    if (!isHealthy) {
      healthStatus.status = 'degraded';
      res.status(503).json(healthStatus);
      return;
    }

    res.status(200).json(healthStatus);
  });

  // Auth routes (both root /auth and /api/v1/auth)
  app.use('/auth', authRouter);
  app.use('/api/v1/auth', authRouter);

  // API v1 Routes
  app.use('/api/v1/emails', emailRouter);
  app.use('/api/v1/campaigns', campaignRouter);
  app.use('/api/v1/senders', senderRouter);
  app.use('/api/v1/integrations', integrationRouter);

  // 404 handler
  app.use((req: Request, _res: Response, next) => {
    next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
  });

  // Central error handler
  app.use(errorHandler);

  return app;
}
