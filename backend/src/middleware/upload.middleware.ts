import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { Request } from 'express';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.php', '.js', '.ts', '.html', '.htm',
  '.svg', '.sh', '.bat', '.py', '.rb', '.pl', '.cgi',
]);

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'avatars');

// Rejection reason is stored on req so the controller can return a clear message
// without relying on multer error propagation (which conflicts with Node domains)
declare global {
  namespace Express {
    interface Request {
      fileRejectionReason?: string;
    }
  }
}

function fileFilter(req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  const ext = path.extname(file.originalname).toLowerCase();

  if (BLOCKED_EXTENSIONS.has(ext)) {
    req.fileRejectionReason = 'File type not allowed';
    cb(null, false);
    return;
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    req.fileRejectionReason = 'Only JPEG, PNG, and WebP images are allowed';
    cb(null, false);
    return;
  }

  cb(null, true);
}

export const uploadMiddleware = multer({
  dest: UPLOAD_DIR,
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
  },
  fileFilter,
});
