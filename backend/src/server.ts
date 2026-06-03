import fs from 'fs';
import path from 'path';
import app from './app';
import { initDb } from './db/database';

const PORT = Number(process.env.PORT) || 4000;

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Ensure upload directories exist (ephemeral on Render free tier — files survive until next deploy)
for (const dir of ['uploads/avatars', 'uploads/files']) {
  fs.mkdirSync(path.join(process.cwd(), dir), { recursive: true });
}

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend running on port ${PORT}`);
    });
  })
  .catch((err: unknown) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
