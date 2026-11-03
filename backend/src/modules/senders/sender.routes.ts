import { Router } from 'express';
import { SenderController } from './sender.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { createSenderSchema } from './sender.validation';

const router = Router();

router.use(requireAuth);

router.get('/', SenderController.list);
router.post('/', validateRequest({ body: createSenderSchema }), SenderController.create);

export const senderRouter = router;

