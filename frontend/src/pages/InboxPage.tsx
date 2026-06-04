import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import Topbar from '../components/Topbar';
import ErrorMessage from '../components/ErrorMessage';
import UserAvatar from '../components/UserAvatar';
import { getApiError } from '../utils/apiError';
import { formatDateTime } from '../utils/date';
import styles from './Messages.module.css';

interface PublicUser {
  id: number;
  username: string;
  avatar: string | null;
}

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
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [composing, setComposing] = useState(false);
  const [receiverId, setReceiverId] = useState('');
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');

  const fetchInbox = useCallback(async () => {
    setListError('');
    try {
      const [dmRes, usersRes] = await Promise.all([
        apiClient.get<DmThread[]>('/api/dms'),
        apiClient.get<PublicUser[]>('/api/users'),
      ]);
      setThreads(dmRes.data);
      setUsers(usersRes.data);
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
    if (!receiverId || !content.trim()) return;
    setPostError('');
    setPosting(true);
    try {
      const res = await apiClient.post<DmThread>('/api/dms', {
        receiver_id: Number(receiverId),
        content,
      });
      setReceiverId('');
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
            <h1 className={styles.pageTitle}>DM Inbox</h1>
            <p className={styles.pageDesc}>Send private one-to-one messages to other users.</p>
          </div>
          {!composing && (
            <button className={styles.newBtn} onClick={() => setComposing(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New DM
            </button>
          )}
        </div>

        {composing && (
          <div className={styles.composeCard}>
            <div className={styles.composeCardHeader}>
              <h2 className={styles.composeTitle}>Private Message</h2>
              <button className={styles.cancelBtn} onClick={() => { setComposing(false); setPostError(''); }}>Cancel</button>
            </div>
            <form onSubmit={handleSend} className={styles.composeForm}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Recipient</label>
                <select
                  className={styles.input}
                  value={receiverId}
                  onChange={(e) => setReceiverId(e.target.value)}
                  required
                >
                  <option value="">Select a user</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.username}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Message</label>
                <textarea
                  className={styles.textarea}
                  placeholder="Write a private message..."
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
                <button className={styles.postBtn} type="submit" disabled={posting || !receiverId || !content.trim()}>
                  {posting ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className={styles.boardCard}>
          {listError && <ErrorMessage message={listError} onRetry={fetchInbox} />}
          {loading ? (
            <p className={styles.empty}>Loading...</p>
          ) : threads.length === 0 ? (
            <p className={styles.empty}>No private messages yet.</p>
          ) : (
            <div className={styles.threadList}>
              {threads.map((thread) => (
                <div key={thread.id} className={styles.thread} onClick={() => navigate(`/inbox/${thread.id}`)}>
                  <div className={styles.threadHeader}>
                    <div className={styles.threadLeft}>
                      <UserAvatar username={thread.other_username} avatar={thread.other_avatar} className={styles.avatar} />
                      <div className={styles.threadMeta}>
                        <span className={styles.threadTitle}>{thread.other_username}</span>
                        <div className={styles.threadSub}>
                          <span className={styles.threadAuthor}>{thread.last_message ?? 'No messages yet'}</span>
                          <span className={styles.dot}>·</span>
                          <span className={styles.threadDate}>{formatDateTime(thread.last_message_at ?? thread.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.threadRight}>
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
