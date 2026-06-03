import { Router, Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { requireAuth } from '../middleware/auth.middleware';
import { uploadLimiter } from '../middleware/rateLimiters';
import { getFiles, getFileById, uploadFile, viewFile, downloadFile, deleteFile, checkFileScanStatus } from '../controllers/files.controller';
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

const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter,
});

const router = Router();

router.get('/', requireAuth, getFiles);

router.post(
  '/',
  uploadLimiter,
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    fileUpload.single('file')(req, res, (err) => {
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
  uploadFile,
);

router.get('/:id', requireAuth, getFileById);
router.delete('/:id', requireAuth, deleteFile);
router.get('/:id/view', requireAuth, viewFile);
router.get('/:id/download', requireAuth, downloadFile);
router.get('/:id/scan-status', requireAuth, checkFileScanStatus);

router.get('/:postId/comments', requireAuth, (req: Request, _res: Response, next: NextFunction) => {
  req.params.postType = 'file';
  next();
}, getComments);

router.post('/:postId/comments', requireAuth, (req: Request, _res: Response, next: NextFunction) => {
  req.params.postType = 'file';
  next();
}, postComment);

router.delete('/:postId/comments/:commentId', requireAuth, deleteComment);

export default router;
