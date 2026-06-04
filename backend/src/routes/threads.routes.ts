import { Router, Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { requireAuth } from '../middleware/auth.middleware';
import { uploadLimiter } from '../middleware/rateLimiters';
import { createThread, deleteThread, getThreadById, getThreads } from '../controllers/threads.controller';
import { getComments, postComment, deleteComment } from '../controllers/comments.controller';

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib',
  '.sh', '.bash', '.zsh',
  '.bat', '.cmd', '.ps1', '.psm1', '.vbs', '.vbe', '.wsf',
  '.php', '.php3', '.php4', '.php5', '.phtml',
  '.asp', '.aspx', '.jsp',
  '.jar', '.war',
]);

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  const ext = path.extname(file.originalname).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) {
    cb(new Error('File type not allowed'));
    return;
  }
  cb(null, true);
}

const threadUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
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
