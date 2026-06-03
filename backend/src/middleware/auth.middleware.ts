import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db/database';

export interface JwtPayload {
  sub: number;
  username: string;
  pv: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
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
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  try {
    const result = await pool.query<{ password_version: number }>(
      'SELECT password_version FROM users WHERE id = $1',
      [payload.sub],
    );
    const dbUser = result.rows[0];
    if (!dbUser || dbUser.password_version !== payload.pv) {
      res.status(401).json({ error: 'Session expired. Please log in again.' });
      return;
    }
  } catch {
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  req.user = payload;
  next();
}
