import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';

import { uploadLimiter, apiLimiter } from './middleware/rateLimiters';
import { requireTrustedOrigin } from './middleware/originGuard.middleware';
import { isAllowedOrigin } from './utils/origin';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import scanRoutes from './routes/scan.routes';
import messagesRoutes from './routes/messages.routes';
import filesRoutes from './routes/files.routes';

const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  }),
);

app.use(cors((req, callback) => {
  const origin = req.get('origin');
  callback(null, {
    origin: !origin || isAllowedOrigin(origin, req),
    credentials: true,
  });
}));

app.use(cookieParser());
app.use(express.json({ limit: '50kb' }));

app.use('/api', requireTrustedOrigin);
app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/scan', uploadLimiter, scanRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/files', filesRoutes);

app.use(
  '/uploads/avatars',
  express.static(path.join(process.cwd(), 'uploads', 'avatars'), {
    index: false,
    dotfiles: 'deny',
  }),
);

app.use(
  '/uploads/files',
  express.static(path.join(process.cwd(), 'uploads', 'files'), {
    index: false,
    dotfiles: 'deny',
  }),
);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

export default app;
