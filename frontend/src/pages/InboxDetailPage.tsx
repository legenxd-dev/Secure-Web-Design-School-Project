import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../context/useAuth';
import Topbar from '../components/Topbar';
import ErrorMessage from '../components/ErrorMessage';
import UserAvatar from '../components/UserAvatar';
import { getApiError } from '../utils/apiError';
import { formatDateTime } from '../utils/date';
import styles from './Inbox.module.css';

interface DmMessage {
  id: number;
  thread_id: number;
  sender_id: number;
  sender_username: string;
  sender_avatar: string | null;
  content: string;
  created_at: string;
}

export default function InboxDetailPage() {
  const { id } = useParams<{ id: string }>();
  const threadId = parseInt(id ?? '0', 10);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);

  const fetchMessages = useCallback(async () => {
    setError('');
    try {
      const res = await apiClient.get<DmMessage[]>(`/api/dms/${threadId}/messages`);
      setMessages(res.data);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setPosting(true);
    setError('');
    try {
      await apiClient.post(`/api/dms/${threadId}/messages`, { content });
      setContent('');
      await fetchMessages();
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setPosting(false);
    }
  }

  const otherUser = messages.find((m) => m.sender_id !== user?.id);

  return (
    <div className={styles.page}>
      <Topbar active="inbox" />

      <main className={styles.content}>
        <button className={styles.backBtn} onClick={() => navigate('/inbox')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Inbox
        </button>

        <section className={styles.card}>
          <div className={styles.header}>
            <h1 className={styles.title}>{otherUser ? otherUser.sender_username : 'Private Message'}</h1>
          </div>

          {error && <ErrorMessage message={error} onRetry={fetchMessages} />}

          {loading ? (
            <p className={styles.empty}>Loading...</p>
          ) : (
            <div className={styles.messageList}>
              {messages.map((message) => {
                const mine = message.sender_id === user?.id;
                return (
                  <div key={message.id} className={mine ? styles.messageMine : styles.messageOther}>
                    {!mine && (
                      <UserAvatar
                        username={message.sender_username}
                        avatar={message.sender_avatar}
                        className={styles.avatar}
                      />
                    )}
                    <div className={mine ? styles.bubbleMine : styles.bubbleOther}>
                      <div className={styles.messageMeta}>
                        <span>{mine ? 'You' : message.sender_username}</span>
                        <span>{formatDateTime(message.created_at)}</span>
                      </div>
                      <p className={styles.messageText}>{message.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <form onSubmit={handleReply} className={styles.replyForm}>
            <textarea
              className={styles.textarea}
              placeholder="Write a reply..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={5000}
              rows={4}
            />
            <div className={styles.replyFooter}>
              <span className={styles.charCount}>{content.length}/5000</span>
              <button className={styles.sendBtn} type="submit" disabled={posting || !content.trim()}>
                {posting ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
