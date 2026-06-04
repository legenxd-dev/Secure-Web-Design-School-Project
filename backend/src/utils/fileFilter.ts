import { Request } from 'express';
import { FileFilterCallback } from 'multer';
import path from 'path';

export const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib',
  '.sh', '.bash', '.zsh',
  '.bat', '.cmd', '.ps1', '.psm1', '.vbs', '.vbe', '.wsf',
  '.php', '.php3', '.php4', '.php5', '.phtml',
  '.asp', '.aspx', '.jsp',
  '.jar', '.war',
]);

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  const ext = path.extname(file.originalname).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) {
    cb(new Error('File type not allowed'));
    return;
  }
  cb(null, true);
}
