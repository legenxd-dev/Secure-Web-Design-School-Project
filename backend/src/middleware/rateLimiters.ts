import rateLimit from 'express-rate-limit';

// Brute-force protection for login/register — strict by design
export const authLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please wait 2 minutes and try again.' },
});

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many upload requests. Please wait a moment and try again.' },
});

// General API limiter — skips /api/auth since authLimiter already covers those routes
export const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/auth'),
  message: { error: 'Too many requests. Please wait a moment and try again.' },
});
