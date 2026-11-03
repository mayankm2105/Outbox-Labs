import { Router } from 'express';
import { CampaignController } from './campaign.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { campaignIdParamSchema } from '../emails/email.validation';

const router = Router();

router.use(requireAuth);

router.get('/', CampaignController.list);
router.get('/:id', validateRequest({ params: campaignIdParamSchema }), CampaignController.getById);
router.get(
  '/:id/emails',
  validateRequest({ params: campaignIdParamSchema }),
  CampaignController.listEmails,
);
router.post(
  '/:id/cancel',
  validateRequest({ params: campaignIdParamSchema }),
  CampaignController.cancel,
);

export const campaignRouter = router;

