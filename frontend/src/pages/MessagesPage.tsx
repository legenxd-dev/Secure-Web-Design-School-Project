import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../context/useAuth';
import Topbar from '../components/Topbar';
import ErrorMessage from '../components/ErrorMessage';
import { getApiError } from '../utils/apiError';
import { formatDateTime } from '../utils/date';
import styles from './Messages.module.css';

interface Message {
  id: number;
  user_id: number;
  username: string;
  title: string;
  content: string;
  created_at: string;
}

function InitialAvatar({ name }: { name: string }) {
  return (
    <div className={styles.avatar}>{name[0]?.toUpperCase()}</div>
  );
}

export default function MessagesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');

  const fetchMessages = useCallback(async () => {
    setListError('');
    try {
      const res = await apiClient.get<Message[]>('/api/messages');
      setMessages(res.data);
    } catch (err) {
      setListError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    setPostError('');
    setPosting(true);
    try {
      await apiClient.post<Message>('/api/messages', { title, content });
      setTitle('');
      setContent('');
      setComposing(false);
      await fetchMessages();
    } catch (err) {
      setPostError(getApiError(err));
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiClient.delete(`/api/messages/${id}`);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setListError(getApiError(err));
    }
  }

  return (
    <div className={styles.page}>
      <Topbar active="messages" />

      <main className={styles.content}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Discussion Board</h1>
            <p className={styles.pageDesc}>Share topics, ideas, or questions with the community.</p>
          </div>
          {!composing && (
            <button className={styles.newBtn} onClick={() => setComposing(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Post
            </button>
          )}
        </div>

        {composing && (
          <div className={styles.composeCard}>
            <div className={styles.composeCardHeader}>
              <h2 className={styles.composeTitle}>Create Post</h2>
              <button className={styles.cancelBtn} onClick={() => { setComposing(false); setPostError(''); }}>Cancel</button>
            </div>
            <form onSubmit={handlePost} className={styles.composeForm}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Title</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="What's this post about?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  required
                />
                <span className={styles.charHint}>{title.length}/200</span>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Content</label>
                <textarea
                  className={styles.textarea}
                  placeholder="Write your message here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={5000}
                  rows={6}
                  required
                />
                <span className={styles.charHint}>{content.length}/5000</span>
              </div>
              {postError && <ErrorMessage message={postError} />}
              <div className={styles.composeActions}>
                <button className={styles.postBtn} type="submit" disabled={posting}>
                  {posting ? 'Posting...' : 'Publish Post'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className={styles.boardCard}>
          {listError && <ErrorMessage message={listError} onRetry={fetchMessages} />}
          {loading ? (
            <p className={styles.empty}>Loading...</p>
          ) : messages.length === 0 ? (
            <p className={styles.empty}>No posts yet. Start the discussion.</p>
          ) : (
            <div className={styles.threadList}>
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={styles.thread}
                  onClick={() => navigate(`/messages/${m.id}`)}
                >
                  <div className={styles.threadHeader}>
                    <div className={styles.threadLeft}>
                      <InitialAvatar name={m.username} />
                      <div className={styles.threadMeta}>
                        <span className={styles.threadTitle}>{m.title}</span>
                        <div className={styles.threadSub}>
                          <span className={styles.threadAuthor}>{m.username}</span>
                          <span className={styles.dot}>·</span>
                          <span className={styles.threadDate}>{formatDateTime(m.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.threadRight}>
                      {user?.id === m.user_id && (
                        <button
                          className={styles.deleteBtn}
                          onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}
                          title="Delete post"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                          </svg>
                        </button>
                      )}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.chevron}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
