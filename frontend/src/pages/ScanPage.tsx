import React, { useRef, useState } from 'react';
import apiClient from '../api/client';
import Topbar from '../components/Topbar';
import { formatBytes } from '../utils/format';
import { MAX_SCAN_FILE_SIZE } from '../constants/limits';
import styles from './Scan.module.css';

interface EngineResult {
  name: string;
  category: string;
  result: string | null;
}

interface ScanStats {
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
  timeout: number;
  failure: number;
}

interface ScanResult {
  status: 'completed' | 'pending';
  fileName?: string;
  fileSize?: number;
  stats?: ScanStats;
  engines?: EngineResult[];
  analysisId?: string;
  message?: string;
}

function verdict(stats: ScanStats): 'malicious' | 'suspicious' | 'clean' {
  if (stats.malicious > 0) return 'malicious';
  if (stats.suspicious > 0) return 'suspicious';
  return 'clean';
}

export default function ScanPage() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [pendingFileName, setPendingFileName] = useState('');

  function selectFile(f: File) {
    setError('');
    setResult(null);
    if (f.size > MAX_SCAN_FILE_SIZE) {
      setError('File must be smaller than 32 MB');
      return;
    }
    setFile(f);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) selectFile(f);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) selectFile(f);
  }

  async function handleScan() {
    if (!file) return;
    setError('');
    setResult(null);
    setScanning(true);
    setPendingFileName(file.name);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiClient.post<ScanResult>('/api/scan/file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error ?? 'Scan failed. Please try again.');
    } finally {
      setScanning(false);
    }
  }

  async function handleCheckStatus() {
    if (!result?.analysisId) return;
    setError('');
    setChecking(true);

    try {
      const res = await apiClient.get<ScanResult>(`/api/scan/analysis/${result.analysisId}`);
      setResult({ ...res.data, fileName: res.data.fileName || pendingFileName });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error ?? 'Status check failed. Please try again.');
    } finally {
      setChecking(false);
    }
  }

  const v = result?.stats && result.status === 'completed' ? verdict(result.stats) : null;

  return (
    <div className={styles.page}>
      <Topbar active="scan" />

      <div className={styles.content}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <h1>File Scanner</h1>
          </div>
          <p className={styles.subtitle}>Upload a file to check it against VirusTotal's threat database.</p>

          <div
            className={`${styles.dropzone} ${dragging ? styles.dropzoneDragging : ''} ${file ? styles.dropzoneHasFile : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              className={styles.hiddenInput}
              onChange={handleInputChange}
            />
            {file ? (
              <div className={styles.fileInfo}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <div>
                  <p className={styles.fileName}>{file.name}</p>
                  <p className={styles.fileSize}>{formatBytes(file.size)}</p>
                </div>
              </div>
            ) : (
              <div className={styles.dropzonePrompt}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 16 12 12 8 16" />
                  <line x1="12" y1="12" x2="12" y2="21" />
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                </svg>
                <p>Drag & drop a file here, or <span className={styles.browseLink}>browse</span></p>
                <p className={styles.limitNote}>Maximum file size: 32 MB</p>
              </div>
            )}
          </div>

          {error && <p className={styles.error}>{error}</p>}

          {file && (
            <button
              className={styles.scanBtn}
              onClick={handleScan}
              disabled={scanning}
            >
              {scanning ? (
                <>
                  <span className={styles.spinner} />
                  Analyzing...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  Scan File
                </>
              )}
            </button>
          )}
        </div>

        {result && result.status === 'completed' && result.stats && result.engines && v && (
          <div className={styles.resultsCard}>
            <div className={`${styles.verdict} ${styles[`verdict_${v}`]}`}>
              {v === 'clean' && (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {v === 'malicious' && (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
              {v === 'suspicious' && (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              )}
              <div>
                <p className={styles.verdictLabel}>
                  {v === 'clean' ? 'No threats detected' : v === 'malicious' ? 'Malicious file detected' : 'Suspicious file detected'}
                </p>
                <p className={styles.verdictFile}>{result.fileName}</p>
              </div>
            </div>

            <div className={styles.statsGrid}>
              <div className={`${styles.stat} ${styles.statMalicious}`}>
                <span className={styles.statNum}>{result.stats.malicious}</span>
                <span className={styles.statLabel}>Malicious</span>
              </div>
              <div className={`${styles.stat} ${styles.statSuspicious}`}>
                <span className={styles.statNum}>{result.stats.suspicious}</span>
                <span className={styles.statLabel}>Suspicious</span>
              </div>
              <div className={`${styles.stat} ${styles.statHarmless}`}>
                <span className={styles.statNum}>{result.stats.harmless}</span>
                <span className={styles.statLabel}>Harmless</span>
              </div>
              <div className={`${styles.stat} ${styles.statUndetected}`}>
                <span className={styles.statNum}>{result.stats.undetected}</span>
                <span className={styles.statLabel}>Undetected</span>
              </div>
            </div>

            <div className={styles.enginesSection}>
              <h2>Engine Results</h2>
              <div className={styles.enginesTable}>
                <div className={styles.enginesHeader}>
                  <span>Engine</span>
                  <span>Result</span>
                </div>
                {result.engines
                  .filter((e) => e.category !== 'undetected' && e.category !== 'type-unsupported')
                  .sort((a, b) => {
                    const order: Record<string, number> = { malicious: 0, suspicious: 1, harmless: 2 };
                    return (order[a.category] ?? 3) - (order[b.category] ?? 3);
                  })
                  .concat(
                    result.engines.filter(
                      (e) => e.category === 'undetected' || e.category === 'type-unsupported',
                    ),
                  )
                  .map((engine, idx) => (
                    <div key={idx} className={styles.engineRow}>
                      <span className={styles.engineName}>{engine.name}</span>
                      <span className={`${styles.engineBadge} ${styles[`badge_${engine.category}`]}`}>
                        {engine.result ?? engine.category}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {result && result.status === 'pending' && (
          <div className={styles.pendingCard}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <div className={styles.pendingBody}>
              <p>{result.message}</p>
              <button
                className={styles.checkBtn}
                onClick={handleCheckStatus}
                disabled={checking}
              >
                {checking ? (
                  <>
                    <span className={styles.spinnerDark} />
                    Checking...
                  </>
                ) : (
                  'Check Status'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
