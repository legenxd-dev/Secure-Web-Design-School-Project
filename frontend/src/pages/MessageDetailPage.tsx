import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../context/useAuth';
import Topbar from '../components/Topbar';
import CommentsSection from '../components/CommentsSection';
import ErrorMessage from '../components/ErrorMessage';
import { getApiError } from '../utils/apiError';
import { formatDateTime } from '../utils/date';
import styles from './Detail.module.css';

interface Message {
  id: number;
  user_id: number;
  username: string;
  title: string;
  content: string;
  created_at: string;
}

export default function MessageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const postId = parseInt(id ?? '0', 10);

  const [message, setMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .get<Message>(`/api/messages/${postId}`)
      .then((res) => setMessage(res.data))
      .catch((err) => setError(getApiError(err)))
      .finally(() => setLoading(false));
  }, [postId]);

  async function handleDelete() {
    if (!message) return;
    try {
      await apiClient.delete(`/api/messages/${message.id}`);
      navigate('/messages');
    } catch (err) {
      setError(getApiError(err));
    }
  }

  return (
    <div className={styles.page}>
      <Topbar active="messages" />

      <main className={styles.content}>
        <button className={styles.backBtn} onClick={() => navigate('/messages')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Messages
        </button>

        {loading && <p className={styles.empty}>Loading...</p>}
        {error && <ErrorMessage message={error} />}

        {message && (
          <>
            <div className={styles.postCard}>
              <div className={styles.postMeta}>
                <div className={styles.metaAvatar}>{message.username[0]?.toUpperCase()}</div>
                <div className={styles.metaInfo}>
                  <span className={styles.metaAuthor}>{message.username}</span>
                  <span className={styles.metaDate}>{formatDateTime(message.created_at)}</span>
                </div>
                {user?.id === message.user_id && (
                  <button className={styles.deleteBtn} onClick={handleDelete} title="Delete post">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                    </svg>
                    Delete
                  </button>
                )}
              </div>

              <h1 className={styles.postTitle}>{message.title}</h1>
              <pre className={styles.postContent}>{message.content}</pre>
            </div>

            <div className={styles.commentsCard}>
              <CommentsSection postType="message" postId={postId} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
