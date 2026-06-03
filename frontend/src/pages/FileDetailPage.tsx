import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import Topbar from '../components/Topbar';
import CommentsSection from '../components/CommentsSection';
import ErrorMessage from '../components/ErrorMessage';
import { getApiError } from '../utils/apiError';
import styles from './Detail.module.css';

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

function formatDate(iso: string): string {
  return new Date(iso + 'Z').toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mime: string) { return mime.startsWith('image/'); }
function isText(mime: string) {
  return mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/xml' ||
    mime === 'application/javascript' ||
    mime === 'application/typescript';
}
function isPdf(mime: string) { return mime === 'application/pdf'; }
function isVideo(mime: string) { return mime.startsWith('video/'); }
function isAudio(mime: string) { return mime.startsWith('audio/'); }
function isPreviewable(mime: string) {
  return isImage(mime) || isText(mime) || isPdf(mime) || isVideo(mime) || isAudio(mime);
}

function FilePreview({ file }: { file: SharedFile }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    const mime = file.mime_type;
    if (!isPreviewable(mime)) return;
    setPreviewLoading(true);
    apiClient
      .get(`/api/files/${file.id}/view`, { responseType: isText(mime) ? 'text' : 'blob' })
      .then((r) => {
        if (isText(mime)) setTextContent(r.data as string);
        else setBlobUrl(URL.createObjectURL(r.data as Blob));
      })
      .catch(() => setTextContent('Failed to load preview'))
      .finally(() => setPreviewLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id]);

  if (previewLoading) return <p className={styles.previewLoading}>Loading preview...</p>;

  if (isImage(file.mime_type) && blobUrl) {
    return (
      <div className={styles.previewImageWrap}>
        <img src={blobUrl} alt={file.original_name} className={styles.previewImage} />
      </div>
    );
  }

  if (isPdf(file.mime_type) && blobUrl) {
    return <iframe src={blobUrl} className={styles.previewPdf} title={file.original_name} sandbox="allow-same-origin" />;
  }

  if (isVideo(file.mime_type) && blobUrl) {
    return (
      <div className={styles.previewMediaWrap}>
        <video controls className={styles.previewVideo} src={blobUrl} />
      </div>
    );
  }

  if (isAudio(file.mime_type) && blobUrl) {
    return (
      <div className={styles.previewMediaWrap}>
        <audio controls className={styles.previewAudio} src={blobUrl} />
      </div>
    );
  }

  if (isText(file.mime_type) && textContent !== null) {
    return (
      <div className={styles.previewTextWrap}>
        <pre className={styles.previewText}>{textContent}</pre>
      </div>
    );
  }

  return (
    <p className={styles.previewUnsupported}>
      Preview not available for this file type. Use the download button above.
    </p>
  );
}

export default function FileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const postId = parseInt(id ?? '0', 10);

  const [file, setFile] = useState<SharedFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    apiClient
      .get<SharedFile>(`/api/files/${postId}`)
      .then((res) => setFile(res.data))
      .catch((err) => setError(getApiError(err)))
      .finally(() => setLoading(false));
  }, [postId]);

  useEffect(() => {
    if (!file || file.scan_status !== 'pending' || file.user_id !== user?.id) return;

    const interval = setInterval(async () => {
      try {
        const r = await apiClient.get<{ status: string; reason?: string }>(`/api/files/${file.id}/scan-status`);
        if (r.data.status !== 'pending') {
          setFile(prev => prev ? { ...prev, scan_status: r.data.status as 'clean' | 'pending' | 'rejected' } : prev);
        }
      } catch { /* ignore */ }
    }, 5000);

    return () => clearInterval(interval);
  }, [file?.id, file?.scan_status]);

  async function handleDelete() {
    if (!file) return;
    try {
      await apiClient.delete(`/api/files/${file.id}`);
      navigate('/files');
    } catch (err) {
      setError(getApiError(err));
    }
  }

  function handleDownload() {
    if (!file) return;
    setDownloadError('');
    apiClient
      .get(`/api/files/${file.id}/download`, { responseType: 'blob' })
      .then((r) => {
        const blobUrl = URL.createObjectURL(r.data as Blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = file.original_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      })
      .catch((err) => setDownloadError(getApiError(err)));
  }

  return (
    <div className={styles.page}>
      <Topbar active="files" />

      <main className={styles.content}>
        <button className={styles.backBtn} onClick={() => navigate('/files')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Files
        </button>

        {loading && <p className={styles.empty}>Loading...</p>}
        {error && <ErrorMessage message={error} />}

        {file && (
          <>
            <div className={styles.postCard}>
              <div className={styles.postMeta}>
                <div className={styles.metaAvatar}>{file.username[0]?.toUpperCase()}</div>
                <div className={styles.metaInfo}>
                  <span className={styles.metaAuthor}>{file.username}</span>
                  <span className={styles.metaDate}>{formatDate(file.created_at)}</span>
                </div>
                <div className={styles.metaActions}>
                  <button
                    className={file.scan_status === 'clean' ? styles.downloadBtn : styles.downloadBtnDisabled}
                    onClick={handleDownload}
                    disabled={file.scan_status !== 'clean'}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download
                  </button>
                  {user?.id === file.user_id && (
                    <button className={styles.deleteBtn} onClick={handleDelete}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                      </svg>
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {downloadError && <ErrorMessage message={downloadError} />}

              <h1 className={styles.postTitle}>{file.title}</h1>

              {file.description && (
                <p className={styles.postDescription}>{file.description}</p>
              )}

              <div className={styles.fileInfoBar}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span>{file.original_name}</span>
                <span className={styles.fileSep}>·</span>
                <span>{formatBytes(file.size)}</span>
                <span className={styles.fileSep}>·</span>
                <span>{file.mime_type}</span>
              </div>

              {file.scan_status === 'pending' && (
                <div className={styles.scanBannerPending}>
                  <span className={styles.scanSpinner} />
                  <div className={styles.scanBannerText}>
                    <strong>Scan in progress</strong>
                    VirusTotal is analyzing this file. Preview and download will be available once the scan completes. This page updates automatically.
                  </div>
                </div>
              )}

              {file.scan_status === 'rejected' && (
                <div className={styles.scanBannerRejected}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <div className={styles.scanBannerText}>
                    <strong>File removed by VirusTotal</strong>
                    This file was flagged as malicious and has been permanently deleted.
                  </div>
                </div>
              )}

              {file.scan_status === 'clean' && (
                <div className={styles.previewSection}>
                  <FilePreview file={file} />
                </div>
              )}
            </div>

            <div className={styles.commentsCard}>
              <CommentsSection postType="file" postId={postId} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
