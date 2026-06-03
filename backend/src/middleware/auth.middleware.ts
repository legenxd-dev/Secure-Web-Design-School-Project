import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db/database';

const COOKIE_NAME = 'auth_token';

export interface JwtPayload {
  sub: number;
  username: string;
  pv?: number;
  role: 'user' | 'admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

function clearAuthCookie(res: Response): void {
  const isProduction = process.env.NODE_ENV === 'production';

  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'strict',
    path: '/',
  });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.auth_token;

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as unknown as JwtPayload;
  } catch {
    clearAuthCookie(res);
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  try {
    const result = await pool.query<{ password_version: number; role: 'user' | 'admin' | null }>(
      'SELECT password_version, role FROM users WHERE id = $1',
      [payload.sub],
    );
    const dbUser = result.rows[0];
    const dbPasswordVersion = Number(dbUser?.password_version ?? 0);
    const tokenPasswordVersion = Number(payload.pv ?? 0);
    if (!dbUser || dbPasswordVersion !== tokenPasswordVersion) {
      clearAuthCookie(res);
      res.status(401).json({ error: 'Session expired. Please log in again.' });
      return;
    }
    payload.role = dbUser.role === 'admin' ? 'admin' : 'user';
  } catch {
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  req.user = payload;
  next();
}

export function canModerate(req: Request, ownerId: number): boolean {
  return req.user?.role === 'admin' || ownerId === req.user?.sub;
}
