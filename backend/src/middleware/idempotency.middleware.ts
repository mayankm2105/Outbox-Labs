import { Request, Response, NextFunction } from 'express';
import { IdempotencyRepository } from '../modules/idempotency/idempotency.repository';
import { ApiError } from '../shared/errors/api-error';
import { logger } from '../shared/utils/logger';

export function idempotencyMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const idempotencyKey = req.header('Idempotency-Key')?.trim();

    if (!idempotencyKey) {
      return next();
    }

    const userId = req.user?.id;
    if (!userId) {
      // If user is not yet authenticated, defer until auth middleware runs or proceed
      return next();
    }

    req.idempotencyKey = idempotencyKey;
    const requestHash = IdempotencyRepository.hashPayload(req.body);

    try {
      const existing = await IdempotencyRepository.find(userId, idempotencyKey);

      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw new ApiError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key reused with a different request payload.',
          );
        }

        if (existing.responseStatus) {
          logger.info(
            { userId, idempotencyKey, status: existing.responseStatus },
            'Returning cached idempotent response',
          );
          res.status(existing.responseStatus).json(existing.responseBody);
          return;
        }

        // Currently in flight
        throw new ApiError(
          409,
          'CONCURRENT_IDEMPOTENT_REQUEST',
          'A request with this idempotency key is currently being processed.',
        );
      }

      // Record key creation (24-hour expiration)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await IdempotencyRepository.create({
        userId,
        idempotencyKey,
        requestHash,
        expiresAt,
      });

      // Intercept response to save status and body
      const originalJson = res.json.bind(res);
      res.json = (body: any): Response => {
        // Save response in background
        IdempotencyRepository.updateResponse({
          userId,
          idempotencyKey,
          responseStatus: res.statusCode,
          responseBody: body,
        }).catch((err) => {
          logger.error({ err, idempotencyKey }, 'Failed to persist idempotent response');
        });

        return originalJson(body);
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}

