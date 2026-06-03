import { Request } from 'express';

export function configuredOrigins(): string[] {
  return (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function requestOrigin(req: Request): string {
  const protocol = req.get('x-forwarded-proto') ?? req.protocol;
  return `${protocol}://${req.get('host')}`;
}

export function isAllowedOrigin(origin: string, req?: Request): boolean {
  if (configuredOrigins().includes(origin)) {
    return true;
  }

  return req ? origin === requestOrigin(req) : false;
}
