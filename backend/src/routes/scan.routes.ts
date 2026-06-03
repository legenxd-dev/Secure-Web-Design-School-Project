import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware';
import { scanFile, checkAnalysis } from '../controllers/scan.controller';

const router = Router();

const scanUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 32 * 1024 * 1024,
    files: 1,
  },
});

router.post(
  '/file',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    scanUpload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'File too large. Maximum size is 32 MB' });
        return;
      }
      if (err) {
        res.status(400).json({ error: 'File upload error' });
        return;
      }
      next();
    });
  },
  scanFile,
);

router.get('/analysis/:id', requireAuth, checkAnalysis);

export default router;
