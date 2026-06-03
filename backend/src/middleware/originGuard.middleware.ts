import { Request, Response, NextFunction } from 'express';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function requireTrustedOrigin(req: Request, res: Response, next: NextFunction): void {
  if (!UNSAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const expectedOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';
  const origin = req.get('origin');

  if (!origin && process.env.NODE_ENV !== 'production') {
    next();
    return;
  }

  if (origin !== expectedOrigin) {
    res.status(403).json({ error: 'Untrusted request origin' });
    return;
  }

  next();
}
