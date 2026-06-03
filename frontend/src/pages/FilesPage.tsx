import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../context/useAuth';
import Topbar from '../components/Topbar';
import ErrorMessage from '../components/ErrorMessage';
import { getApiError } from '../utils/apiError';
import styles from './Files.module.css';

interface SharedFile {
  id: number;
  user_id: number;
  username: string;
  title: string;
  description: string;
  original_name: string;
  mime_type: string;
  size: number;
  scan_status: 'clean' | 'pending' | 'rejected';
  created_at: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso + 'Z').toLocaleString();
}

function isImage(mime: string) { return mime.startsWith('image/'); }
function isPdf(mime: string) { return mime === 'application/pdf'; }

function FileIcon({ mime }: { mime: string }) {
  if (isImage(mime)) return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
  if (isPdf(mime)) return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="15" x2="15" y2="15" />
      <line x1="9" y1="11" x2="15" y2="11" />
    </svg>
  );
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

export default function FilesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [composing, setComposing] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');

  const fetchFiles = useCallback(async () => {
    setListError('');
    try {
      const res = await apiClient.get<SharedFile[]>('/api/files');
      setFiles(res.data);
    } catch (err) {
      setListError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    const pendingIds = files.filter(f => f.scan_status === 'pending' && f.user_id === user?.id).map(f => f.id);
    if (pendingIds.length === 0) return;

    const interval = setInterval(async () => {
      for (const fileId of pendingIds) {
        try {
          const r = await apiClient.get<{ status: string }>(`/api/files/${fileId}/scan-status`);
          if (r.data.status !== 'pending') {
            setFiles(prev => prev.map(f =>
              f.id === fileId ? { ...f, scan_status: r.data.status as 'clean' | 'pending' | 'rejected' } : f
            ));
          }
        } catch { /* ignore */ }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [files, user?.id]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError('');
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      setUploadError('File must be smaller than 10 MB');
      return;
    }
    setSelectedFile(f);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile || !uploadTitle.trim()) return;
    setUploadError('');
    setUploading(true);
    setUploadProgress('Uploading...');
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', uploadTitle.trim());
    formData.append('description', uploadDesc.trim());
    try {
      await apiClient.post('/api/files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadTitle('');
      setUploadDesc('');
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = '';
      setComposing(false);
      setUploadProgress('');
      await fetchFiles();
    } catch (err) {
      setUploadError(getApiError(err));
      setUploadProgress('');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiClient.delete(`/api/files/${id}`);
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      setListError(getApiError(err));
    }
  }

  return (
    <div className={styles.page}>
      <Topbar active="files" />

      <main className={styles.content}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>File Sharing</h1>
            <p className={styles.pageDesc}>Share files after they pass the VirusTotal safety check. Preview and download stay locked while scanning.</p>
          </div>
          {!composing && (
            <button className={styles.newBtn} onClick={() => setComposing(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Share File
            </button>
          )}
        </div>

        {composing && (
          <div className={styles.composeCard}>
            <div className={styles.composeCardHeader}>
              <h2 className={styles.composeTitle}>Share a File</h2>
              <button className={styles.cancelBtn} onClick={() => { setComposing(false); setUploadError(''); setUploadProgress(''); }}>Cancel</button>
            </div>
            <form onSubmit={handleUpload} className={styles.composeForm}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Title</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Give your file a title"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  maxLength={200}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Description <span className={styles.optional}>(optional)</span></label>
                <textarea
                  className={styles.textarea}
                  placeholder="Describe what this file contains..."
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  maxLength={1000}
                  rows={3}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>File</label>
                <input
                  ref={inputRef}
                  type="file"
                  className={styles.fileInput}
                  onChange={handleFileChange}
                  required
                />
                <span className={styles.hint}>Max 10 MB. Preview and download unlock only after a clean VirusTotal result.</span>
              </div>
              {uploadError && <ErrorMessage message={uploadError} />}
              {uploadProgress && (
                <div className={styles.scanProgress}>
                  <span className={styles.spinner} />
                  {uploadProgress}
                </div>
              )}
              <div className={styles.composeActions}>
                <button className={styles.postBtn} type="submit" disabled={uploading || !selectedFile}>
                  {uploading ? 'Processing...' : 'Upload & Share'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className={styles.boardCard}>
          {listError && <ErrorMessage message={listError} onRetry={fetchFiles} />}
          {loading ? (
            <p className={styles.empty}>Loading...</p>
          ) : files.length === 0 ? (
            <p className={styles.empty}>No files shared yet.</p>
          ) : (
            <div className={styles.threadList}>
              {files.map((f) => (
                <div
                  key={f.id}
                  className={styles.thread}
                  onClick={() => navigate(`/files/${f.id}`)}
                >
                  <div className={styles.threadHeader}>
                    <div className={styles.threadLeft}>
                      <div className={styles.fileIcon}><FileIcon mime={f.mime_type} /></div>
                      <div className={styles.threadMeta}>
                        <span className={styles.threadTitle}>{f.title}</span>
                        <div className={styles.threadSub}>
                          <span className={styles.threadAuthor}>{f.username}</span>
                          <span className={styles.dot}>·</span>
                          <span className={styles.threadDate}>{formatDate(f.created_at)}</span>
                          <span className={styles.dot}>·</span>
                          <span className={styles.fileSize}>{formatBytes(f.size)}</span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.threadRight}>
                      {f.scan_status === 'pending' && (
                        <span className={styles.scanBadgePending}>Scanning</span>
                      )}
                      {f.scan_status === 'rejected' && (
                        <span className={styles.scanBadgeRejected}>Rejected</span>
                      )}
                      {user?.id === f.user_id && (
                        <button
                          className={styles.deleteBtn}
                          onClick={(e) => { e.stopPropagation(); handleDelete(f.id); }}
                          title="Delete file"
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
