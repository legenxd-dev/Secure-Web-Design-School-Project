import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import ErrorMessage from './ErrorMessage';
import { getApiError } from '../utils/apiError';
import styles from './CommentsSection.module.css';

interface Comment {
  id: number;
  user_id: number;
  username: string;
  content: string;
  created_at: string;
}

interface Props {
  postType: 'message' | 'file';
  postId: number;
}

function formatDate(iso: string): string {
  return new Date(iso + 'Z').toLocaleString();
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

  async function fetchComments() {
    setLoadError('');
    try {
      const res = await apiClient.get<Comment[]>(`${base}/${postId}/comments`);
      setComments(res.data);
    } catch (err) {
      setLoadError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchComments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

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
        <div className={styles.formAvatar}>
          {user?.username[0]?.toUpperCase()}
        </div>
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
              <div className={styles.commentAvatar}>
                {c.username[0]?.toUpperCase()}
              </div>
              <div className={styles.commentBody}>
                <div className={styles.commentHeader}>
                  <span className={styles.commentAuthor}>{c.username}</span>
                  <span className={styles.commentDate}>{formatDate(c.created_at)}</span>
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
