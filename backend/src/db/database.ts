import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') || process.env.NODE_ENV === 'production'
    ? true
    : undefined,
});

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id               SERIAL PRIMARY KEY,
      username         TEXT    NOT NULL UNIQUE,
      email            TEXT    NOT NULL UNIQUE,
      password_hash    TEXT    NOT NULL,
      password_version INTEGER NOT NULL DEFAULT 0,
      avatar           TEXT    DEFAULT NULL,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title      TEXT    NOT NULL DEFAULT 'Untitled',
      content    TEXT    NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS files (
      id             SERIAL PRIMARY KEY,
      user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title          TEXT    NOT NULL DEFAULT 'Untitled',
      description    TEXT    NOT NULL DEFAULT '',
      filename       TEXT    NOT NULL,
      original_name  TEXT    NOT NULL,
      mime_type      TEXT    NOT NULL,
      size           INTEGER NOT NULL,
      scan_status    TEXT    NOT NULL DEFAULT 'clean'
                              CHECK(scan_status IN ('clean', 'pending', 'rejected')),
      vt_analysis_id TEXT    DEFAULT NULL,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id         SERIAL PRIMARY KEY,
      post_type  TEXT    NOT NULL CHECK(post_type IN ('message', 'file')),
      post_id    INTEGER NOT NULL,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content    TEXT    NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_type, post_id)
  `);
}

export default pool;
