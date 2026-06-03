import { Request, Response } from 'express';
import pool from '../db/database';

interface MessageRow {
  id: number;
  user_id: number;
  username: string;
  title: string;
  content: string;
  created_at: string;
}

const SELECT_MESSAGES = `
  SELECT m.id, m.user_id, u.username, m.title, m.content, m.created_at
  FROM messages m
  JOIN users u ON u.id = m.user_id
`;

export async function getMessageById(req: Request, res: Response): Promise<void> {
  const id = parseInt(String(req.params.id), 10);
  const result = await pool.query<MessageRow>(
    `${SELECT_MESSAGES} WHERE m.id = $1`,
    [id],
  );
  const message = result.rows[0];
  if (!message) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }
  res.json(message);
}

export async function getMessages(_req: Request, res: Response): Promise<void> {
  const result = await pool.query<MessageRow>(
    `${SELECT_MESSAGES} ORDER BY m.created_at DESC LIMIT 100`,
  );
  res.json(result.rows);
}

export async function postMessage(req: Request, res: Response): Promise<void> {
  const { title, content } = req.body as { title?: string; content?: string };

  if (!title || title.trim().length === 0) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }
  if (title.length > 200) {
    res.status(400).json({ error: 'Title must be 200 characters or fewer' });
    return;
  }
  if (!content || content.trim().length === 0) {
    res.status(400).json({ error: 'Content is required' });
    return;
  }
  if (content.length > 5000) {
    res.status(400).json({ error: 'Content must be 5000 characters or fewer' });
    return;
  }

  const insertResult = await pool.query<{ id: number }>(
    'INSERT INTO messages (user_id, title, content) VALUES ($1, $2, $3) RETURNING id',
    [req.user!.sub, title.trim(), content.trim()],
  );
  const newId = insertResult.rows[0].id;

  const result = await pool.query<MessageRow>(
    `${SELECT_MESSAGES} WHERE m.id = $1`,
    [newId],
  );
  res.status(201).json(result.rows[0]);
}

export async function deleteMessage(req: Request, res: Response): Promise<void> {
  const id = parseInt(String(req.params.id), 10);

  const result = await pool.query<{ user_id: number }>(
    'SELECT user_id FROM messages WHERE id = $1',
    [id],
  );
  const message = result.rows[0];

  if (!message) {
    res.status(404).json({ error: 'Message not found' });
    return;
  }
  if (message.user_id !== req.user!.sub) {
    res.status(403).json({ error: 'You can only delete your own posts' });
    return;
  }

  await pool.query('DELETE FROM messages WHERE id = $1', [id]);
  res.status(204).send();
}
