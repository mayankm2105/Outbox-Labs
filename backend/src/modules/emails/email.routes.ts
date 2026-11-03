import { Router } from 'express';
import { EmailController } from './email.controller';
import { CampaignController } from '../campaigns/campaign.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { idempotencyMiddleware } from '../../middleware/idempotency.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { scheduleEmailSchema } from '../campaigns/campaign.validation';
import { listEmailsQuerySchema, emailIdParamSchema } from './email.validation';

const router = Router();

router.use(requireAuth);

router.post(
  '/schedule',
  idempotencyMiddleware(),
  validateRequest({ body: scheduleEmailSchema }),
  CampaignController.schedule,
);

router.get(
  '/scheduled',
  validateRequest({ query: listEmailsQuerySchema }),
  EmailController.listScheduled,
);

router.get(
  '/sent',
  validateRequest({ query: listEmailsQuerySchema }),
  EmailController.listSent,
);

router.get(
  '/failed',
  validateRequest({ query: listEmailsQuerySchema }),
  EmailController.listFailed,
);

router.get(
  '/:id',
  validateRequest({ params: emailIdParamSchema }),
  EmailController.getById,
);

export const emailRouter = router;

