import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware';
import { uploadLimiter } from '../middleware/rateLimiters';
import { getFiles, getFileById, uploadFile, viewFile, downloadFile, deleteFile, checkFileScanStatus } from '../controllers/files.controller';
import { getComments, postComment, deleteComment } from '../controllers/comments.controller';
import { fileFilter, MAX_UPLOAD_BYTES } from '../utils/fileFilter';

const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
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
