import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware';
import { uploadLimiter } from '../middleware/rateLimiters';
import { createThread, deleteThread, getThreadById, getThreads } from '../controllers/threads.controller';
import { getComments, postComment, deleteComment } from '../controllers/comments.controller';
import { fileFilter, MAX_UPLOAD_BYTES } from '../utils/fileFilter';

const threadUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
  },
  fileFilter,
});

const router = Router();

router.get('/', requireAuth, getThreads);

router.post(
  '/',
  uploadLimiter,
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    threadUpload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'File too large. Maximum size is 10 MB' });
        return;
      }
      if (err) {
        res.status(400).json({ error: err.message ?? 'File upload error' });
        return;
      }
      next();
    });
  },
  createThread,
);

router.get('/:type/:id', requireAuth, getThreadById);
router.delete('/:type/:id', requireAuth, deleteThread);

router.get('/:type/:postId/comments', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  if (req.params.type !== 'message' && req.params.type !== 'file') {
    res.status(400).json({ error: 'Invalid thread type' });
    return;
  }
  req.params.postType = req.params.type;
  next();
}, getComments);

router.post('/:type/:postId/comments', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  if (req.params.type !== 'message' && req.params.type !== 'file') {
    res.status(400).json({ error: 'Invalid thread type' });
    return;
  }
  req.params.postType = req.params.type;
  next();
}, postComment);

router.delete('/:type/:postId/comments/:commentId', requireAuth, deleteComment);

export default router;
