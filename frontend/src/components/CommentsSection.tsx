import React, { useCallback, useEffect, useState } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/useAuth';
import ErrorMessage from './ErrorMessage';
import UserAvatar from './UserAvatar';
import { getApiError } from '../utils/apiError';
import { formatDateTime } from '../utils/date';
import styles from './CommentsSection.module.css';

interface Comment {
  id: number;
  user_id: number;
  username: string;
  avatar: string | null;
  content: string;
  created_at: string;
}

interface Props {
  postType: 'message' | 'file';
  postId: number;
}

export default function CommentsSection({ postType, postId }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');

  const base = postType === 'message' ? '/api/messages' : '/api/files';

  const fetchComments = useCallback(async () => {
    setLoadError('');
    try {
      const res = await apiClient.get<Comment[]>(`${base}/${postId}/comments`);
      setComments(res.data);
    } catch (err) {
      setLoadError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [base, postId]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setPostError('');
    setPosting(true);
    try {
      await apiClient.post(`${base}/${postId}/comments`, { content });
      setContent('');
      await fetchComments();
    } catch (err) {
      setPostError(getApiError(err));
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(commentId: number) {
    try {
      await apiClient.delete(`${base}/${postId}/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      setPostError(getApiError(err));
    }
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>
        {loading ? 'Comments' : `${comments.length} Comment${comments.length !== 1 ? 's' : ''}`}
      </h3>

      <form onSubmit={handleSubmit} className={styles.form}>
        <UserAvatar
          username={user?.username ?? '?'}
          avatar={user?.avatar}
          className={styles.formAvatar}
        />
        <div className={styles.formRight}>
          <textarea
            className={styles.textarea}
            placeholder="Write a comment..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={2000}
            rows={3}
          />
          <div className={styles.formFooter}>
            <span className={styles.charCount}>{content.length}/2000</span>
            <button className={styles.submitBtn} type="submit" disabled={posting || !content.trim()}>
              {posting ? 'Posting...' : 'Comment'}
            </button>
          </div>
          {postError && <ErrorMessage message={postError} />}
        </div>
      </form>

      {loadError && <ErrorMessage message={loadError} onRetry={fetchComments} />}

      {loading ? (
        <p className={styles.empty}>Loading comments...</p>
      ) : comments.length === 0 && !loadError ? (
        <p className={styles.empty}>No comments yet. Be the first to reply.</p>
      ) : (
        <div className={styles.list}>
          {comments.map((c) => (
            <div key={c.id} className={styles.comment}>
              <UserAvatar username={c.username} avatar={c.avatar} className={styles.commentAvatar} />
              <div className={styles.commentBody}>
                <div className={styles.commentHeader}>
                  <span className={styles.commentAuthor}>{c.username}</span>
                  <span className={styles.commentDate}>{formatDateTime(c.created_at)}</span>
                  {user?.id === c.user_id && (
                    <button
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(c.id)}
                      title="Delete comment"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                      </svg>
                    </button>
                  )}
                </div>
                <p className={styles.commentContent}>{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
