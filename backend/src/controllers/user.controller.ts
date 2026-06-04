import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/database';
import { validateImageMagicBytes } from '../utils/fileValidation';
import { deleteCloudinaryAsset, requireCloudinary, uploadBufferToCloudinary } from '../utils/cloudinary';

interface UserRow {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin' | null;
  avatar: string | null;
  avatar_public_id?: string | null;
}

function publicUser(user: UserRow) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role === 'admin' ? 'admin' : 'user',
    avatar: user.avatar,
  };
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const result = await pool.query<UserRow>(
    'SELECT id, username, email, role, avatar, avatar_public_id FROM users WHERE id = $1',
    [req.user!.sub],
  );
  const user = result.rows[0];
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(publicUser(user));
}

export async function getUsers(req: Request, res: Response): Promise<void> {
  const result = await pool.query<Pick<UserRow, 'id' | 'username' | 'avatar'>>(
    `SELECT id, username, avatar
     FROM users
     WHERE id != $1
     ORDER BY username ASC
     LIMIT 100`,
    [req.user!.sub],
  );
  res.json(result.rows);
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const { username, email, role } = req.body as {
    username?: string;
    email?: string;
    role?: 'user' | 'admin';
  };

  if (!username && !email && !role) {
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
  if (role) {
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, req.user!.sub]);
  }

  const updated = await pool.query<UserRow>(
    'SELECT id, username, email, role, avatar, avatar_public_id FROM users WHERE id = $1',
    [req.user!.sub],
  );
  res.json(publicUser(updated.rows[0]));
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

  if (!validateImageMagicBytes(req.file.buffer)) {
    res.status(422).json({ error: 'File content does not match an allowed image format' });
    return;
  }

  try {
    requireCloudinary();
  } catch {
    res.status(503).json({ error: 'Cloudinary is not configured. Avatar uploads are disabled.' });
    return;
  }

  try {
    const uploaded = await uploadBufferToCloudinary(req.file.buffer, {
      folder: 'secdev/avatars',
      resourceType: 'image',
    });

    const currentResult = await pool.query<{ avatar_public_id: string | null }>(
      'SELECT avatar_public_id FROM users WHERE id = $1',
      [req.user!.sub],
    );
    await deleteCloudinaryAsset(currentResult.rows[0]?.avatar_public_id, 'image');

    await pool.query(
      'UPDATE users SET avatar = $1, avatar_public_id = $2 WHERE id = $3',
      [uploaded.url, uploaded.publicId, req.user!.sub],
    );
  } catch (err) {
    console.error('[users] Cloudinary avatar upload failed:', err instanceof Error ? err.message : err);
    res.status(502).json({ error: 'Avatar storage failed. Please try again.' });
    return;
  }

  const updated = await pool.query<UserRow>(
    'SELECT id, username, email, role, avatar, avatar_public_id FROM users WHERE id = $1',
    [req.user!.sub],
  );
  res.json(publicUser(updated.rows[0]));
}
