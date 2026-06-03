import { Request, Response } from 'express';
import pool from '../db/database';
import { canModerate } from '../middleware/auth.middleware';
import { cleanText } from '../utils/text';

interface CommentRow {
  id: number;
  post_type: string;
  post_id: number;
  user_id: number;
  username: string;
  avatar: string | null;
  content: string;
  created_at: string;
}

function resolveParentTable(postType: unknown): 'messages' | 'files' | null {
  if (postType === 'message') return 'messages';
  if (postType === 'file') return 'files';
  return null;
}

const SELECT_COMMENT = `
  SELECT c.id, c.post_type, c.post_id, c.user_id, u.username, u.avatar, c.content, c.created_at
  FROM comments c
  JOIN users u ON u.id = c.user_id
`;

export async function getComments(req: Request, res: Response): Promise<void> {
  const postType = req.params.postType;
  const postId = parseInt(String(req.params.postId), 10);

  if (postType !== 'message' && postType !== 'file') {
    res.status(400).json({ error: 'Invalid post type' });
    return;
  }

  const result = await pool.query<CommentRow>(
    `${SELECT_COMMENT} WHERE c.post_type = $1 AND c.post_id = $2 ORDER BY c.created_at ASC`,
    [postType, postId],
  );
  res.json(result.rows);
}

export async function postComment(req: Request, res: Response): Promise<void> {
  const postType = req.params.postType;
  const postId = parseInt(String(req.params.postId), 10);
  const { content } = req.body as { content?: string };

  const parentTable = resolveParentTable(postType);
  if (!parentTable) {
    res.status(400).json({ error: 'Invalid post type' });
    return;
  }

  const safeContent = cleanText(content ?? '');

  if (!safeContent) {
    res.status(400).json({ error: 'Comment content is required' });
    return;
  }
  if (safeContent.length > 2000) {
    res.status(400).json({ error: 'Comment must be 2000 characters or fewer' });
    return;
  }

  const parent = await pool.query(`SELECT id FROM ${parentTable} WHERE id = $1`, [postId]);
  if (parent.rows.length === 0) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  const insertResult = await pool.query<{ id: number }>(
    'INSERT INTO comments (post_type, post_id, user_id, content) VALUES ($1, $2, $3, $4) RETURNING id',
    [postType, postId, req.user!.sub, safeContent],
  );
  const newId = insertResult.rows[0].id;

  const result = await pool.query<CommentRow>(
    `${SELECT_COMMENT} WHERE c.id = $1`,
    [newId],
  );
  res.status(201).json(result.rows[0]);
}

export async function deleteComment(req: Request, res: Response): Promise<void> {
  const id = parseInt(String(req.params.commentId), 10);

  const result = await pool.query<{ user_id: number }>(
    'SELECT user_id FROM comments WHERE id = $1',
    [id],
  );
  const comment = result.rows[0];

  if (!comment) {
    res.status(404).json({ error: 'Comment not found' });
    return;
  }
  if (!canModerate(req, comment.user_id)) {
    res.status(403).json({ error: 'You can only delete your own comments' });
    return;
  }

  await pool.query('DELETE FROM comments WHERE id = $1', [id]);
  res.status(204).send();
}
