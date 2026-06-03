import { Request } from 'express';

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'https://secure-web-design-school-project.onrender.com',
  'https://secure-web-design-school-project.vercel.app',
];

export function configuredOrigins(): string[] {
  const configured = (process.env.FRONTEND_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([...DEFAULT_ORIGINS, ...configured])];
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
