import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app';
import pool from '../src/db/database';

const FRONTEND_ORIGIN = 'http://localhost:5173';
const JWT_SECRET = 'test_secret_minimum_32_characters_long';

type QueryResult = { rows: unknown[] };
type QueryMock = (sql: string, params?: unknown[]) => Promise<QueryResult>;

const originalQuery = pool.query.bind(pool);
const originalEnv = { ...process.env };

function mockQuery(fn: QueryMock): void {
  pool.query = ((sql: string, params?: unknown[]) => fn(sql, params)) as typeof pool.query;
}

function authCookie(userId = 1, passwordVersion = 0): string {
  const token = jwt.sign(
    { sub: userId, username: 'alice', pv: passwordVersion },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
  return `auth_token=${token}`;
}

function legacyAuthCookie(userId = 1): string {
  const token = jwt.sign(
    { sub: userId, username: 'alice' },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
  return `auth_token=${token}`;
}

beforeEach(() => {
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.FRONTEND_ORIGIN = FRONTEND_ORIGIN;
  delete process.env.VIRUSTOTAL_API_KEY;
});

afterEach(() => {
  pool.query = originalQuery;
  process.env = { ...originalEnv };
});

describe('security behavior', () => {
  it('rejects unsafe cross-origin requests before route handlers run', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Origin', 'https://attacker.example');

    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'Untrusted request origin');
  });

  it('allows unsafe requests from the deployed same-origin host', async () => {
    process.env.FRONTEND_ORIGIN = 'https://stale-frontend.example';
    const calls: string[] = [];
    mockQuery(async (sql) => {
      calls.push(sql);
      if (sql.includes('SELECT id FROM users')) return { rows: [] };
      if (sql.includes('INSERT INTO users')) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    });

    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'https://secure-web-design-school-project.onrender.com')
      .set('Host', 'secure-web-design-school-project.onrender.com')
      .set('X-Forwarded-Proto', 'https')
      .send({
        username: 'same_origin_user',
        email: 'same_origin@example.com',
        password: 'averystrongpassword',
      });

    assert.equal(res.status, 201);
    assert.equal(calls.length, 2);
  });

  it('registers a valid user with parameterized database calls', async () => {
    const calls: string[] = [];
    mockQuery(async (sql) => {
      calls.push(sql);
      if (sql.includes('SELECT id FROM users')) return { rows: [] };
      if (sql.includes('INSERT INTO users')) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    });

    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', FRONTEND_ORIGIN)
      .send({
        username: 'alice_1',
        email: 'alice@example.com',
        password: 'averystrongpassword',
      });

    assert.equal(res.status, 201);
    assert.equal(calls.length, 2);
  });

  it('returns 401 for invalid login credentials', async () => {
    mockQuery(async () => ({ rows: [] }));

    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', FRONTEND_ORIGIN)
      .send({ email: 'alice@example.com', password: 'wrong-password' });

    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Invalid credentials');
  });

  it('returns the database-backed role after login', async () => {
    const passwordHash = await bcrypt.hash('averystrongpassword', 4);
    mockQuery(async () => ({
      rows: [{
        id: 1,
        username: 'alice',
        email: 'alice@example.com',
        password_hash: passwordHash,
        password_version: 0,
        role: 'admin',
        avatar: null,
      }],
    }));

    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', FRONTEND_ORIGIN)
      .send({ email: 'alice@example.com', password: 'averystrongpassword' });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'admin');
  });

  it('protects authenticated routes when no cookie is present', async () => {
    const res = await request(app).get('/api/users/me');

    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Authentication required');
  });

  it('rejects stale password-version sessions and clears the auth cookie', async () => {
    mockQuery(async () => ({ rows: [{ password_version: 1 }] }));

    const res = await request(app)
      .get('/api/users/me')
      .set('Cookie', authCookie(1, 0));
    const setCookie = res.headers['set-cookie'];
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join(';') : String(setCookie ?? '');

    assert.equal(res.status, 401);
    assert.match(cookieHeader, /auth_token=;/);
  });

  it('returns the database-backed role for the current user', async () => {
    const results = [
      { rows: [{ password_version: 0, role: 'admin' }] },
      {
        rows: [{
          id: 1,
          username: 'alice',
          email: 'alice@example.com',
          role: 'admin',
          avatar: null,
        }],
      },
    ];
    mockQuery(async () => results.shift() ?? { rows: [] });

    const res = await request(app)
      .get('/api/users/me')
      .set('Cookie', authCookie(1, 0));

    assert.equal(res.status, 200);
    assert.equal(res.body.role, 'admin');
  });

  it('intentionally allows profile role escalation for the security report demo', async () => {
    const calls: string[] = [];
    const results = [
      { rows: [{ password_version: 0, role: 'user' }] },
      { rows: [] },
      { rows: [] },
      {
        rows: [{
          id: 1,
          username: 'alice',
          email: 'alice@example.com',
          role: 'admin',
          avatar: null,
        }],
      },
    ];
    mockQuery(async (sql) => {
      calls.push(sql);
      return results.shift() ?? { rows: [] };
    });

    const res = await request(app)
      .patch('/api/users/me')
      .set('Origin', FRONTEND_ORIGIN)
      .set('Cookie', authCookie(1, 0))
      .send({ role: 'admin' });

    assert.equal(res.status, 200);
    assert.equal(res.body.role, 'admin');
    assert.ok(calls.some((sql) => sql.includes('UPDATE users SET role = $1 WHERE id = $2')));
  });

  it('prevents deleting another user message', async () => {
    const results = [
      { rows: [{ password_version: 0 }] },
      { rows: [{ user_id: 2 }] },
    ];
    mockQuery(async () => results.shift() ?? { rows: [] });

    const res = await request(app)
      .delete('/api/messages/10')
      .set('Origin', FRONTEND_ORIGIN)
      .set('Cookie', authCookie(1, 0));

    assert.equal(res.status, 403);
  });

  it('allows admins to delete another user message', async () => {
    const results = [
      { rows: [{ password_version: 0, role: 'admin' }] },
      { rows: [{ user_id: 2 }] },
      { rows: [] },
    ];
    mockQuery(async () => results.shift() ?? { rows: [] });

    const res = await request(app)
      .delete('/api/messages/10')
      .set('Origin', FRONTEND_ORIGIN)
      .set('Cookie', authCookie(1, 0));

    assert.equal(res.status, 204);
  });

  it('allows admins to delete another user comment', async () => {
    const results = [
      { rows: [{ password_version: 0, role: 'admin' }] },
      { rows: [{ user_id: 2 }] },
      { rows: [] },
    ];
    mockQuery(async () => results.shift() ?? { rows: [] });

    const res = await request(app)
      .delete('/api/messages/10/comments/5')
      .set('Origin', FRONTEND_ORIGIN)
      .set('Cookie', authCookie(1, 0));

    assert.equal(res.status, 204);
  });

  it('allows admins to delete another user file', async () => {
    const results = [
      { rows: [{ password_version: 0, role: 'admin' }] },
      { rows: [{ user_id: 2, filename: 'missing.pdf' }] },
      { rows: [] },
    ];
    mockQuery(async () => results.shift() ?? { rows: [] });

    const res = await request(app)
      .delete('/api/files/10')
      .set('Origin', FRONTEND_ORIGIN)
      .set('Cookie', authCookie(1, 0));

    assert.equal(res.status, 204);
  });

  it('fails file sharing closed when VirusTotal is not configured', async () => {
    mockQuery(async () => ({ rows: [{ password_version: 0 }] }));

    const res = await request(app)
      .post('/api/files')
      .set('Origin', FRONTEND_ORIGIN)
      .set('Cookie', authCookie(1, 0))
      .field('title', 'Sample file')
      .attach('file', Buffer.from('%PDF-1.4\n'), {
        filename: 'sample.pdf',
        contentType: 'application/pdf',
      });

    assert.equal(res.status, 503);
    assert.match(res.body.error, /VirusTotal API key/);
  });

  it('rejects blocked executable upload extensions before scanning', async () => {
    mockQuery(async () => ({ rows: [{ password_version: 0 }] }));

    const res = await request(app)
      .post('/api/files')
      .set('Origin', FRONTEND_ORIGIN)
      .set('Cookie', authCookie(1, 0))
      .field('title', 'Bad file')
      .attach('file', Buffer.from('echo bad'), {
        filename: 'bad.exe',
        contentType: 'application/octet-stream',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'File type not allowed');
  });

  it('accepts legacy zero-version sessions for avatar upload auth', async () => {
    mockQuery(async () => ({ rows: [{ password_version: 0 }] }));

    const res = await request(app)
      .post('/api/users/me/avatar')
      .set('Origin', FRONTEND_ORIGIN)
      .set('Cookie', legacyAuthCookie(1))
      .attach('avatar', Buffer.from('not-a-real-image'), {
        filename: 'avatar.png',
        contentType: 'image/png',
      });

    assert.equal(res.status, 422);
    assert.equal(res.body.error, 'File content does not match an allowed image format');
  });

  it('prevents reading a private message thread you do not participate in', async () => {
    const results = [
      { rows: [{ password_version: 0, role: 'user' }] },
      { rows: [] },
    ];
    mockQuery(async () => results.shift() ?? { rows: [] });

    const res = await request(app)
      .get('/api/dms/99/messages')
      .set('Cookie', authCookie(1, 0));

    assert.equal(res.status, 403);
  });

  it('prevents sending a private message to yourself', async () => {
    mockQuery(async () => ({ rows: [{ password_version: 0, role: 'user' }] }));

    const res = await request(app)
      .post('/api/dms')
      .set('Origin', FRONTEND_ORIGIN)
      .set('Cookie', authCookie(1, 0))
      .send({ receiver_id: 1, content: 'hello' });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'You cannot send a private message to yourself');
  });

  it('returns a clear error when a private message username does not exist', async () => {
    const results = [
      { rows: [{ password_version: 0, role: 'user' }] },
      { rows: [] },
    ];
    mockQuery(async () => results.shift() ?? { rows: [] });

    const res = await request(app)
      .post('/api/dms')
      .set('Origin', FRONTEND_ORIGIN)
      .set('Cookie', authCookie(1, 0))
      .send({ receiver_username: 'missing_user', content: 'hello' });

    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'No user found with that username');
  });
});
