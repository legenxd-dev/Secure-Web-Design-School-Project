import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getMessages, getMessageById, postMessage, deleteMessage } from '../controllers/messages.controller';
import { getComments, postComment, deleteComment } from '../controllers/comments.controller';

const router = Router();

router.get('/', requireAuth, getMessages);
router.post('/', requireAuth, postMessage);
router.get('/:id', requireAuth, getMessageById);
router.delete('/:id', requireAuth, deleteMessage);

router.get('/:postId/comments', requireAuth, (req, res, next) => {
  req.params.postType = 'message';
  next();
}, getComments);

router.post('/:postId/comments', requireAuth, (req, res, next) => {
  req.params.postType = 'message';
  next();
}, postComment);

router.delete('/:postId/comments/:commentId', requireAuth, deleteComment);

export default router;
