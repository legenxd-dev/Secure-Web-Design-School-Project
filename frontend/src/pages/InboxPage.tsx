import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import Topbar from '../components/Topbar';
import ErrorMessage from '../components/ErrorMessage';
import UserAvatar from '../components/UserAvatar';
import { getApiError } from '../utils/apiError';
import { formatDateTime } from '../utils/date';
import styles from './Messages.module.css';

interface DmThread {
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

export default function InboxPage() {
  const navigate = useNavigate();
  const [threads, setThreads] = useState<DmThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [composing, setComposing] = useState(false);
  const [receiverUsername, setReceiverUsername] = useState('');
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');

  const fetchInbox = useCallback(async () => {
    setListError('');
    try {
      const dmRes = await apiClient.get<DmThread[]>('/api/dms');
      setThreads(dmRes.data);
    } catch (err) {
      setListError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInbox();
  }, [fetchInbox]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!receiverUsername.trim() || !content.trim()) return;
    setPostError('');
    setPosting(true);
    try {
      const res = await apiClient.post<DmThread>('/api/dms', {
        receiver_username: receiverUsername.trim(),
        content,
      });
      setReceiverUsername('');
      setContent('');
      setComposing(false);
      navigate(`/inbox/${res.data.id}`);
    } catch (err) {
      setPostError(getApiError(err));
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className={styles.page}>
      <Topbar active="inbox" />

      <main className={styles.content}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Inbox</h1>
            <p className={styles.pageDesc}>Send direct messages to other users.</p>
          </div>
          {!composing && (
            <button className={styles.newBtn} onClick={() => setComposing(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Message
            </button>
          )}
        </div>

        {composing && (
          <div className={styles.composeCard}>
            <div className={styles.composeCardHeader}>
              <h2 className={styles.composeTitle}>New Message</h2>
              <button className={styles.cancelBtn} onClick={() => { setComposing(false); setPostError(''); }}>Cancel</button>
            </div>
            <form onSubmit={handleSend} className={styles.composeForm}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Username</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Type the recipient username"
                  value={receiverUsername}
                  onChange={(e) => setReceiverUsername(e.target.value)}
                  maxLength={30}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Message</label>
                <textarea
                  className={styles.textarea}
                  placeholder="Write a message..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={5000}
                  rows={5}
                  required
                />
                <span className={styles.charHint}>{content.length}/5000</span>
              </div>
              {postError && <ErrorMessage message={postError} />}
              <div className={styles.composeActions}>
                <button className={styles.postBtn} type="submit" disabled={posting || !receiverUsername.trim() || !content.trim()}>
                  {posting ? 'Sending...' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className={styles.boardCard}>
          {listError && <ErrorMessage message={listError} onRetry={fetchInbox} />}
          {loading ? (
            <div className={styles.threadList}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={styles.skeletonRow}>
                  <span className={styles.skelAvatar} />
                  <span className={styles.skelLines}>
                    <span className={styles.skelTitle} />
                    <span className={styles.skelSub} />
                  </span>
                </div>
              ))}
            </div>
          ) : threads.length === 0 ? (
            <div className={styles.emptyState}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <p>No messages yet</p>
            </div>
          ) : (
            <div className={styles.threadList}>
              {threads.map((thread, i) => (
                <div
                  key={thread.id}
                  className={styles.thread}
                  style={{ '--i': i } as React.CSSProperties}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/inbox/${thread.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/inbox/${thread.id}`); }
                  }}
                >
                  <div className={styles.threadHeader}>
                    <div className={styles.threadLeft}>
                      <UserAvatar username={thread.other_username} avatar={thread.other_avatar} className={styles.rowAvatar} />
                      <div className={styles.threadMeta}>
                        <span className={styles.threadTitle}>{thread.other_username}</span>
                        <div className={styles.threadSub}>
                          <span className={styles.threadAuthor}>{thread.last_message ?? 'No messages yet'}</span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.threadRight}>
                      <span className={styles.metaDate}>{formatDateTime(thread.last_message_at ?? thread.created_at)}</span>
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
