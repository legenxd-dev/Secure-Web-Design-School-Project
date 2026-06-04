import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../context/useAuth';
import Topbar from '../components/Topbar';
import ErrorMessage from '../components/ErrorMessage';
import UserAvatar from '../components/UserAvatar';
import { getApiError } from '../utils/apiError';
import { formatDateTime } from '../utils/date';
import { canModerate } from '../utils/permissions';
import { formatBytes } from '../utils/format';
import { MAX_THREAD_FILE_SIZE, POLLING_INTERVAL_MS } from '../constants/limits';
import styles from './Files.module.css';

type ThreadType = 'message' | 'file';

interface Thread {
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

export default function ThreadsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [postProgress, setPostProgress] = useState('');

  const fetchThreads = useCallback(async () => {
    setListError('');
    try {
      const res = await apiClient.get<Thread[]>('/api/threads');
      setThreads(res.data);
    } catch (err) {
      setListError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchThreads();
  }, [fetchThreads]);

  useEffect(() => {
    const pendingIds = threads
      .filter((t) => t.type === 'file' && t.scan_status === 'pending' && t.user_id === user?.id)
      .map((t) => t.id);
    if (pendingIds.length === 0) return;

    const interval = setInterval(async () => {
      for (const fileId of pendingIds) {
        try {
          const r = await apiClient.get<{ status: string }>(`/api/files/${fileId}/scan-status`);
          if (r.data.status !== 'pending') {
            setThreads((prev) => prev.map((t) =>
              t.type === 'file' && t.id === fileId
                ? { ...t, scan_status: r.data.status as 'clean' | 'pending' | 'rejected' }
                : t,
            ));
          }
        } catch {
          // Polling is best-effort; the detail page can refresh status too.
        }
      }
    }, POLLING_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [threads, user?.id]);

  function resetForm() {
    setTitle('');
    setContent('');
    setSelectedFile(null);
    setPostError('');
    setPostProgress('');
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPostError('');
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_THREAD_FILE_SIZE) {
      setPostError('File must be smaller than 10 MB');
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setSelectedFile(file);
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (!selectedFile && !content.trim()) return;

    setPostError('');
    setPosting(true);
    setPostProgress(selectedFile ? 'Uploading...' : '');

    const formData = new FormData();
    formData.append('title', title.trim());
    if (selectedFile) {
      formData.append('description', content.trim());
      formData.append('file', selectedFile);
    } else {
      formData.append('content', content.trim());
    }

    try {
      await apiClient.post('/api/threads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      resetForm();
      setComposing(false);
      await fetchThreads();
    } catch (err) {
      setPostError(getApiError(err));
      setPostProgress('');
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(thread: Thread) {
    try {
      await apiClient.delete(`/api/threads/${thread.type}/${thread.id}`);
      setThreads((prev) => prev.filter((t) => !(t.type === thread.type && t.id === thread.id)));
    } catch (err) {
      setListError(getApiError(err));
    }
  }

  function openThread(thread: Thread) {
    navigate(`/threads/${thread.type}/${thread.id}`);
  }

  return (
    <div className={styles.page}>
      <Topbar active="threads" />

      <main className={styles.content}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Threads</h1>
            <p className={styles.pageDesc}>Share a message or attach a file to start a public discussion.</p>
          </div>
          {!composing && (
            <button className={styles.newBtn} onClick={() => setComposing(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Thread
            </button>
          )}
        </div>

        {composing && (
          <div className={styles.composeCard}>
            <div className={styles.composeCardHeader}>
              <h2 className={styles.composeTitle}>Create Thread</h2>
              <button className={styles.cancelBtn} onClick={() => { setComposing(false); resetForm(); }}>Cancel</button>
            </div>
            <form onSubmit={handlePost} className={styles.composeForm}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Title</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="What is this thread about?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>{selectedFile ? 'Description' : 'Content'}</label>
                <textarea
                  className={styles.textarea}
                  placeholder={selectedFile ? 'Describe what this file contains...' : 'Write your message here...'}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={selectedFile ? 1000 : 5000}
                  rows={selectedFile ? 3 : 6}
                  required={!selectedFile}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>File <span className={styles.optional}>(optional)</span></label>
                <input
                  ref={inputRef}
                  type="file"
                  className={styles.fileInput}
                  onChange={handleFileChange}
                />
                <span className={styles.hint}>Max 10 MB. Files unlock after a clean VirusTotal result.</span>
              </div>
              {postError && <ErrorMessage message={postError} />}
              {postProgress && (
                <div className={styles.scanProgress}>
                  <span className={styles.spinner} />
                  {postProgress}
                </div>
              )}
              <div className={styles.composeActions}>
                <button className={styles.postBtn} type="submit" disabled={posting || !title.trim() || (!selectedFile && !content.trim())}>
                  {posting ? 'Processing...' : selectedFile ? 'Upload & Share' : 'Publish Thread'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className={styles.boardCard}>
          {listError && <ErrorMessage message={listError} onRetry={fetchThreads} />}
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
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p>No threads yet</p>
            </div>
          ) : (
            <div className={styles.threadList}>
              {threads.map((thread, i) => (
                <div
                  key={`${thread.type}-${thread.id}`}
                  className={styles.thread}
                  style={{ '--i': i } as React.CSSProperties}
                  role="button"
                  tabIndex={0}
                  onClick={() => openThread(thread)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openThread(thread); }
                  }}
                >
                  <div className={styles.threadHeader}>
                    <div className={styles.threadLeft}>
                      <UserAvatar username={thread.username} avatar={thread.avatar} className={styles.rowAvatar} />
                      <div className={styles.threadMeta}>
                        <span className={styles.threadTitle}>{thread.title}</span>
                        <div className={styles.threadSub}>
                          <span className={styles.threadAuthor}>{thread.username}</span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.threadRight}>
                      <span className={thread.type === 'file' ? styles.typeChipFile : styles.typeChipMsg}>
                        {thread.type === 'file' ? (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                          </svg>
                        ) : (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                          </svg>
                        )}
                        {thread.type === 'file' ? 'FILE' : 'MSG'}
                      </span>
                      {thread.type === 'file' && typeof thread.size === 'number' && (
                        <span className={styles.metaSize}>{formatBytes(thread.size)}</span>
                      )}
                      <span className={styles.metaReplies} title={`${thread.comment_count} repl${thread.comment_count === 1 ? 'y' : 'ies'}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                        </svg>
                        {thread.comment_count}
                      </span>
                      <span className={styles.metaDate}>{formatDateTime(thread.last_activity)}</span>
                      {thread.scan_status === 'pending' && <span className={styles.scanBadgePending}>Scanning</span>}
                      {thread.scan_status === 'rejected' && <span className={styles.scanBadgeRejected}>Rejected</span>}
                      {canModerate(user, thread.user_id) && (
                        <button
                          className={styles.deleteBtn}
                          onClick={(e) => { e.stopPropagation(); void handleDelete(thread); }}
                          title="Delete thread"
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
