import { Request, Response, NextFunction } from 'express';
import { isAllowedOrigin } from '../utils/origin';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function requireTrustedOrigin(req: Request, res: Response, next: NextFunction): void {
  if (!UNSAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin = req.get('origin');

  if (!origin && process.env.NODE_ENV !== 'production') {
    next();
    return;
  }

  if (!origin || !isAllowedOrigin(origin, req)) {
    res.status(403).json({ error: 'Untrusted request origin' });
    return;
  }

  next();
}
