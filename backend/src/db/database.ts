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
      role             TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      avatar           TEXT    DEFAULT NULL,
      avatar_public_id TEXT    DEFAULT NULL,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_version INTEGER NOT NULL DEFAULT 0
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT NULL
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar_public_id TEXT DEFAULT NULL
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  `);

  await pool.query(`
    DO $$
    BEGIN
      ALTER TABLE users
      ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'));
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
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
      storage_url    TEXT    DEFAULT NULL,
      storage_public_id TEXT DEFAULT NULL,
      storage_resource_type TEXT DEFAULT NULL,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE files
    ADD COLUMN IF NOT EXISTS storage_url TEXT DEFAULT NULL
  `);

  await pool.query(`
    ALTER TABLE files
    ADD COLUMN IF NOT EXISTS storage_public_id TEXT DEFAULT NULL
  `);

  await pool.query(`
    ALTER TABLE files
    ADD COLUMN IF NOT EXISTS storage_resource_type TEXT DEFAULT NULL
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dm_threads (
      id          SERIAL PRIMARY KEY,
      user_one_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_two_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW(),
      CHECK (user_one_id < user_two_id),
      UNIQUE (user_one_id, user_two_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dm_messages (
      id         SERIAL PRIMARY KEY,
      thread_id  INTEGER NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
      sender_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content    TEXT    NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_dm_threads_users ON dm_threads(user_one_id, user_two_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_dm_messages_thread_created ON dm_messages(thread_id, created_at)
  `);
}

export default pool;
