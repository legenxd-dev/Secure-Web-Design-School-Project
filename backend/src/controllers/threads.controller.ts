import { Request, Response } from 'express';
import pool from '../db/database';
import { deleteFile, getFileById, uploadFile } from './files.controller';
import { deleteMessage, getMessageById, postMessage } from './messages.controller';

type ThreadType = 'message' | 'file';

interface ThreadRow {
  type: ThreadType;
  id: number;
  user_id: number;
  username: string;
  avatar: string | null;
  title: string;
  content: string | null;
  description: string | null;
  original_name: string | null;
  mime_type: string | null;
  size: number | null;
  scan_status: 'clean' | 'pending' | 'rejected' | null;
  created_at: string;
  comment_count: number;
  last_activity: string;
}

export async function getThreads(_req: Request, res: Response): Promise<void> {
  const result = await pool.query<ThreadRow>(`
    WITH comment_agg AS (
      SELECT post_type, post_id, COUNT(*)::INTEGER AS cnt, MAX(created_at) AS last
      FROM comments GROUP BY post_type, post_id
    )
    SELECT 'message' AS type, m.id, m.user_id, u.username, u.avatar, m.title,
           m.content, NULL::TEXT AS description, NULL::TEXT AS original_name,
           NULL::TEXT AS mime_type, NULL::INTEGER AS size, NULL::TEXT AS scan_status,
           m.created_at,
           COALESCE(agg.cnt, 0) AS comment_count,
           GREATEST(m.created_at, agg.last) AS last_activity
    FROM messages m
    JOIN users u ON u.id = m.user_id
    LEFT JOIN comment_agg agg ON agg.post_type = 'message' AND agg.post_id = m.id
    UNION ALL
    SELECT 'file' AS type, f.id, f.user_id, u.username, u.avatar, f.title,
           NULL::TEXT AS content, f.description, f.original_name,
           f.mime_type, f.size, f.scan_status, f.created_at,
           COALESCE(agg.cnt, 0) AS comment_count,
           GREATEST(f.created_at, agg.last) AS last_activity
    FROM files f
    JOIN users u ON u.id = f.user_id
    LEFT JOIN comment_agg agg ON agg.post_type = 'file' AND agg.post_id = f.id
    ORDER BY last_activity DESC
    LIMIT 200
  `);
  res.json(result.rows);
}

export async function createThread(req: Request, res: Response): Promise<void> {
  if (req.file) {
    await uploadFile(req, res);
    return;
  }
  await postMessage(req, res);
}

export async function getThreadById(req: Request, res: Response): Promise<void> {
  const type = req.params.type;
  if (type === 'message') {
    await getMessageById(req, res);
    return;
  }
  if (type === 'file') {
    await getFileById(req, res);
    return;
  }
  res.status(400).json({ error: 'Invalid thread type' });
}

export async function deleteThread(req: Request, res: Response): Promise<void> {
  const type = req.params.type;
  if (type === 'message') {
    await deleteMessage(req, res);
    return;
  }
  if (type === 'file') {
    await deleteFile(req, res);
    return;
  }
  res.status(400).json({ error: 'Invalid thread type' });
}
