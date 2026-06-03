import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body } from 'express-validator';
import pool from '../db/database';

interface UserRow {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  password_version: number | null;
  role: 'user' | 'admin' | null;
  avatar: string | null;
}

const COOKIE_NAME = 'auth_token';

function isHttpsRequest(req: Request): boolean {
  return req.secure || req.get('x-forwarded-proto') === 'https';
}

function cookieOptions(req: Request) {
  const isHttps = isHttpsRequest(req);

  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' as const : 'strict' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

export const registerValidators = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be 3–30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username may only contain letters, numbers, and underscores'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 12 })
    .withMessage('Password must be at least 12 characters'),
];

export const loginValidators = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

export async function register(req: Request, res: Response): Promise<void> {
  const { username, email, password } = req.body as {
    username: string;
    email: string;
    password: string;
  };

  const existing = await pool.query(
    'SELECT id FROM users WHERE email = $1 OR username = $2',
    [email, username],
  );
  if (existing.rows.length > 0) {
    res.status(409).json({ error: 'Email or username already in use' });
    return;
  }

  const password_hash = await bcrypt.hash(password, 12);
  await pool.query(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)',
    [username, email, password_hash],
  );

  res.status(201).json({ message: 'Account created successfully' });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };

  const result = await pool.query<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];

  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign(
    {
      sub: user.id,
      username: user.username,
      pv: Number(user.password_version ?? 0),
      role: user.role === 'admin' ? 'admin' : 'user',
    },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' },
  );

  res.cookie(COOKIE_NAME, token, cookieOptions(req));
  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role === 'admin' ? 'admin' : 'user',
      avatar: user.avatar,
    },
  });
}

export function logout(req: Request, res: Response): void {
  const isHttps = isHttpsRequest(req);

  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'strict',
    path: '/',
  });
  res.json({ message: 'Logged out successfully' });
}
