import { Request, Response } from 'express';
import pool from '../db/database';
import { cleanText } from '../utils/text';

interface DmThreadRow {
  id: number;
  other_user_id: number;
  other_username: string;
  other_avatar: string | null;
  last_message: string | null;
  last_sender_id: number | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DmMessageRow {
  id: number;
  thread_id: number;
  sender_id: number;
  sender_username: string;
  sender_avatar: string | null;
  content: string;
  created_at: string;
}

function orderedPair(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a];
}

async function isParticipant(threadId: number, userId: number): Promise<boolean> {
  const result = await pool.query(
    'SELECT id FROM dm_threads WHERE id = $1 AND (user_one_id = $2 OR user_two_id = $2)',
    [threadId, userId],
  );
  return result.rows.length > 0;
}

const SELECT_DM_THREADS = `
  SELECT
    t.id,
    CASE WHEN t.user_one_id = $1 THEN t.user_two_id ELSE t.user_one_id END AS other_user_id,
    other_user.username AS other_username,
    other_user.avatar AS other_avatar,
    latest.content AS last_message,
    latest.sender_id AS last_sender_id,
    latest.created_at AS last_message_at,
    t.created_at,
    t.updated_at
  FROM dm_threads t
  JOIN users other_user
    ON other_user.id = CASE WHEN t.user_one_id = $1 THEN t.user_two_id ELSE t.user_one_id END
  LEFT JOIN LATERAL (
    SELECT content, sender_id, created_at
    FROM dm_messages
    WHERE thread_id = t.id
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  ) latest ON true
  WHERE (t.user_one_id = $1 OR t.user_two_id = $1)
`;

export async function getDmThreads(req: Request, res: Response): Promise<void> {
  const result = await pool.query<DmThreadRow>(
    `${SELECT_DM_THREADS} ORDER BY COALESCE(latest.created_at, t.updated_at) DESC LIMIT 100`,
    [req.user!.sub],
  );
  res.json(result.rows);
}

export async function createDm(req: Request, res: Response): Promise<void> {
  const { receiver_id: receiverIdRaw, receiver_username: receiverUsernameRaw, content } = req.body as {
    receiver_id?: number;
    receiver_username?: string;
    content?: string;
  };
  const senderId = req.user!.sub;
  const safeReceiverUsername = cleanText(receiverUsernameRaw ?? '');
  const safeContent = cleanText(content ?? '');

  const receiverIdFromBody = Number(receiverIdRaw);

  if (!receiverIdRaw && !safeReceiverUsername) {
    res.status(400).json({ error: 'Receiver is required' });
    return;
  }
  if (!safeReceiverUsername && (!Number.isInteger(receiverIdFromBody) || receiverIdFromBody <= 0)) {
    res.status(400).json({ error: 'Receiver is required' });
    return;
  }
  if (!safeReceiverUsername && receiverIdFromBody === senderId) {
    res.status(400).json({ error: 'You cannot send a private message to yourself' });
    return;
  }
  if (!safeContent) {
    res.status(400).json({ error: 'Message content is required' });
    return;
  }
  if (safeContent.length > 5000) {
    res.status(400).json({ error: 'Message must be 5000 characters or fewer' });
    return;
  }

  const receiver = safeReceiverUsername
    ? await pool.query<{ id: number }>(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
      [safeReceiverUsername],
    )
    : await pool.query<{ id: number }>(
      'SELECT id FROM users WHERE id = $1',
      [receiverIdFromBody],
    );

  const receiverId = receiver.rows[0]?.id;
  if (!receiverId) {
    res.status(404).json({ error: 'No user found with that username' });
    return;
  }
  if (receiverId === senderId) {
    res.status(400).json({ error: 'You cannot send a private message to yourself' });
    return;
  }

  const [userOneId, userTwoId] = orderedPair(senderId, receiverId);
  const threadResult = await pool.query<{ id: number }>(
    `INSERT INTO dm_threads (user_one_id, user_two_id, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_one_id, user_two_id)
     DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [userOneId, userTwoId],
  );
  const threadId = threadResult.rows[0].id;

  await pool.query(
    'INSERT INTO dm_messages (thread_id, sender_id, content) VALUES ($1, $2, $3)',
    [threadId, senderId, safeContent],
  );
  await pool.query('UPDATE dm_threads SET updated_at = NOW() WHERE id = $1', [threadId]);

  const result = await pool.query<DmThreadRow>(
    `${SELECT_DM_THREADS} AND t.id = $2`,
    [senderId, threadId],
  );
  res.status(201).json(result.rows[0]);
}

export async function getDmMessages(req: Request, res: Response): Promise<void> {
  const threadId = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(threadId) || threadId <= 0) {
    res.status(400).json({ error: 'Invalid private message thread' });
    return;
  }
  if (!(await isParticipant(threadId, req.user!.sub))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const result = await pool.query<DmMessageRow>(
    `SELECT m.id, m.thread_id, m.sender_id, u.username AS sender_username,
            u.avatar AS sender_avatar, m.content, m.created_at
     FROM dm_messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.thread_id = $1
     ORDER BY m.created_at ASC, m.id ASC`,
    [threadId],
  );
  res.json(result.rows);
}

export async function postDmMessage(req: Request, res: Response): Promise<void> {
  const threadId = parseInt(String(req.params.id), 10);
  const { content } = req.body as { content?: string };
  const safeContent = cleanText(content ?? '');

  if (!Number.isInteger(threadId) || threadId <= 0) {
    res.status(400).json({ error: 'Invalid private message thread' });
    return;
  }
  if (!(await isParticipant(threadId, req.user!.sub))) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  if (!safeContent) {
    res.status(400).json({ error: 'Message content is required' });
    return;
  }
  if (safeContent.length > 5000) {
    res.status(400).json({ error: 'Message must be 5000 characters or fewer' });
    return;
  }

  const insertResult = await pool.query<{ id: number }>(
    'INSERT INTO dm_messages (thread_id, sender_id, content) VALUES ($1, $2, $3) RETURNING id',
    [threadId, req.user!.sub, safeContent],
  );
  await pool.query('UPDATE dm_threads SET updated_at = NOW() WHERE id = $1', [threadId]);

  const result = await pool.query<DmMessageRow>(
    `SELECT m.id, m.thread_id, m.sender_id, u.username AS sender_username,
            u.avatar AS sender_avatar, m.content, m.created_at
     FROM dm_messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.id = $1`,
    [insertResult.rows[0].id],
  );
  res.status(201).json(result.rows[0]);
}
