import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { body } from 'express-validator';
import { getMe, updateProfile, changePassword, uploadAvatar } from '../controllers/user.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { uploadMiddleware } from '../middleware/upload.middleware';
import { handleValidationErrors } from '../middleware/validate.middleware';

const router = Router();

router.get('/me', requireAuth, getMe);

router.patch(
  '/me',
  requireAuth,
  [
    body('username')
      .optional()
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be 3–30 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username may only contain letters, numbers, and underscores'),
    body('email')
      .optional()
      .trim()
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
  ],
  handleValidationErrors,
  updateProfile,
);

router.post('/me/password', requireAuth, changePassword);

router.post(
  '/me/avatar',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    uploadMiddleware.single('avatar')(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'File too large. Maximum size is 2 MB' });
        return;
      }
      if (err) {
        res.status(400).json({ error: 'File upload error' });
        return;
      }
      next();
    });
  },
  uploadAvatar,
);

export default router;
