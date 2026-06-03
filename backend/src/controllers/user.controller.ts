import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import pool from '../db/database';
import { validateImageMagicBytes } from '../utils/fileValidation';

interface UserRow {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  avatar: string | null;
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const result = await pool.query<UserRow>(
    'SELECT id, username, email, avatar FROM users WHERE id = $1',
    [req.user!.sub],
  );
  const user = result.rows[0];
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(user);
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const { username, email } = req.body as { username?: string; email?: string };

  if (!username && !email) {
    res.status(400).json({ error: 'Nothing to update' });
    return;
  }

  const conflict = await pool.query(
    'SELECT id FROM users WHERE (username = $1 OR email = $2) AND id != $3',
    [username ?? '', email ?? '', req.user!.sub],
  );
  if (conflict.rows.length > 0) {
    res.status(409).json({ error: 'Username or email already in use' });
    return;
  }

  if (username) {
    await pool.query('UPDATE users SET username = $1 WHERE id = $2', [username, req.user!.sub]);
  }
  if (email) {
    await pool.query('UPDATE users SET email = $1 WHERE id = $2', [email, req.user!.sub]);
  }

  const updated = await pool.query<UserRow>(
    'SELECT id, username, email, avatar FROM users WHERE id = $1',
    [req.user!.sub],
  );
  res.json(updated.rows[0]);
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const { current_password, new_password } = req.body as {
    current_password: string;
    new_password: string;
  };

  if (!current_password || !new_password) {
    res.status(400).json({ error: 'current_password and new_password are required' });
    return;
  }

  if (new_password.length < 12) {
    res.status(400).json({ error: 'New password must be at least 12 characters' });
    return;
  }

  const result = await pool.query<{ password_hash: string }>(
    'SELECT password_hash FROM users WHERE id = $1',
    [req.user!.sub],
  );
  const user = result.rows[0];
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const match = await bcrypt.compare(current_password, user.password_hash);
  if (!match) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }

  const newHash = await bcrypt.hash(new_password, 12);
  await pool.query(
    'UPDATE users SET password_hash = $1, password_version = password_version + 1 WHERE id = $2',
    [newHash, req.user!.sub],
  );

  res.json({ message: 'Password updated successfully' });
}

export async function uploadAvatar(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    const reason = req.fileRejectionReason ?? 'No file uploaded';
    res.status(400).json({ error: reason });
    return;
  }

  const tempPath = req.file.path;

  if (!validateImageMagicBytes(tempPath)) {
    fs.unlink(tempPath, () => undefined);
    res.status(422).json({ error: 'File content does not match an allowed image format' });
    return;
  }

  const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
  const safeFilename = `${uuidv4()}${ext}`;
  const finalPath = path.join(process.cwd(), 'uploads', 'avatars', safeFilename);

  try {
    fs.renameSync(tempPath, finalPath);
  } catch {
    fs.unlink(tempPath, () => undefined);
    res.status(500).json({ error: 'Failed to save file' });
    return;
  }

  const currentResult = await pool.query<{ avatar: string | null }>(
    'SELECT avatar FROM users WHERE id = $1',
    [req.user!.sub],
  );
  const currentAvatar = currentResult.rows[0]?.avatar;
  if (currentAvatar) {
    fs.unlink(path.join(process.cwd(), 'uploads', 'avatars', currentAvatar), () => undefined);
  }

  await pool.query('UPDATE users SET avatar = $1 WHERE id = $2', [safeFilename, req.user!.sub]);

  const updated = await pool.query<UserRow>(
    'SELECT id, username, email, avatar FROM users WHERE id = $1',
    [req.user!.sub],
  );
  res.json(updated.rows[0]);
}
