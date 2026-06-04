import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { createDm, getDmMessages, getDmThreads, postDmMessage } from '../controllers/dms.controller';

const router = Router();

router.get('/', requireAuth, getDmThreads);
router.post('/', requireAuth, createDm);
router.get('/:id/messages', requireAuth, getDmMessages);
router.post('/:id/messages', requireAuth, postDmMessage);

export default router;
