import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import pool from '../db/database';
import {
  sha256,
  vtGet,
  vtPost,
  VTFileResponse,
  VTAnalysisResponse,
  VTUploadResponse,
} from '../utils/virustotal';
import { validateImageMagicBytes, validatePdfMagicBytes } from '../utils/fileValidation';
import { canModerate } from '../middleware/auth.middleware';
import { cleanText } from '../utils/text';
import {
  CloudinaryResourceType,
  deleteCloudinaryAsset,
  requireCloudinary,
  resourceTypeForMime,
  uploadBufferToCloudinary,
} from '../utils/cloudinary';

const FILES_DIR = path.join(process.cwd(), 'uploads', 'files');

const SAFE_INLINE_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
  'application/pdf',
  'video/mp4', 'video/webm', 'video/ogg',
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
]);

interface FileRow {
  id: number;
  user_id: number;
  username: string;
  avatar: string | null;
  title: string;
  description: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  scan_status: 'clean' | 'pending' | 'rejected';
  vt_analysis_id: string | null;
  storage_url: string | null;
  storage_public_id: string | null;
  storage_resource_type: CloudinaryResourceType | null;
  created_at: string;
}

const SELECT_FILES = `
  SELECT f.id, f.user_id, u.username, u.avatar, f.title, f.description,
         f.original_name, f.mime_type, f.size,
         f.scan_status, f.storage_url, f.storage_public_id, f.storage_resource_type,
         f.created_at
  FROM files f
  JOIN users u ON u.id = f.user_id
`;

function isMalicious(stats: { malicious: number; suspicious: number }): boolean {
  return stats.malicious > 0 || stats.suspicious > 0;
}

function removeStoredFile(filename: string): void {
  fs.unlink(path.join(FILES_DIR, filename), () => undefined);
}

async function uploadSharedFile(buffer: Buffer, mimeType: string) {
  return uploadBufferToCloudinary(buffer, {
    folder: 'secdev/files',
    resourceType: resourceTypeForMime(mimeType),
  });
}

async function sendStoredFile(
  res: Response,
  file: Pick<FileRow, 'filename' | 'original_name' | 'mime_type' | 'storage_url'>,
  disposition: 'inline' | 'attachment',
): Promise<void> {
  const safeName = encodeURIComponent(file.original_name);
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${safeName}`);
  res.setHeader('Content-Type', SAFE_INLINE_MIME.has(file.mime_type) ? file.mime_type : 'application/octet-stream');

  if (file.storage_url) {
    const response = await fetch(file.storage_url);
    if (!response.ok) {
      res.status(502).json({ error: 'Failed to fetch stored file' });
      return;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
    return;
  }

  const filePath = path.join(FILES_DIR, file.filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found on disk' });
    return;
  }

  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) res.status(500).json({ error: 'Failed to serve file' });
  });
}

export async function getFiles(_req: Request, res: Response): Promise<void> {
  const result = await pool.query<FileRow>(
    `${SELECT_FILES} ORDER BY f.created_at DESC LIMIT 200`,
  );
  res.json(result.rows);
}

export async function getFileById(req: Request, res: Response): Promise<void> {
  const id = parseInt(String(req.params.id), 10);
  const result = await pool.query<FileRow>(`${SELECT_FILES} WHERE f.id = $1`, [id]);
  const file = result.rows[0];
  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  res.json(file);
}

export async function uploadFile(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const { title, description } = req.body as { title?: string; description?: string };

  const safeTitle = cleanText(title ?? '');
  const safeDescription = cleanText(description ?? '');

  if (!safeTitle) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }
  if (safeTitle.length > 200) {
    res.status(400).json({ error: 'Title must be 200 characters or fewer' });
    return;
  }
  if (safeDescription.length > 1000) {
    res.status(400).json({ error: 'Description must be 1000 characters or fewer' });
    return;
  }

  const { buffer, originalname, mimetype, size } = req.file;

  if (mimetype.startsWith('image/')) {
    if (!validateImageMagicBytes(buffer)) {
      res.status(422).json({ error: 'File content does not match the declared image type' });
      return;
    }
  } else if (mimetype === 'application/pdf') {
    if (!validatePdfMagicBytes(buffer)) {
      res.status(422).json({ error: 'File content does not match the declared PDF type' });
      return;
    }
  }

  const ext = path.extname(originalname);
  const apiKey = process.env.VIRUSTOTAL_API_KEY;

  if (!apiKey) {
    res.status(503).json({ error: 'VirusTotal API key is not configured. File sharing is disabled.' });
    return;
  }

  try {
    requireCloudinary();
  } catch {
    res.status(503).json({ error: 'Cloudinary is not configured. File sharing is disabled.' });
    return;
  }

  const safeFilename = path.basename(originalname).replace(/[^\w.\- ]/g, '_') || `upload${ext}`;

  try {
    const hash = sha256(buffer);
    const hashReport = await vtGet(`/files/${hash}`, apiKey);

    if (hashReport.status === 200) {
      const data = hashReport.data as VTFileResponse;
      const stats = data.data.attributes.last_analysis_stats;

      if (isMalicious(stats)) {
        res.status(422).json({
          error: `File rejected by VirusTotal: ${stats.malicious} malicious, ${stats.suspicious} suspicious detections.`,
        });
        return;
      }

      const stored = await uploadSharedFile(buffer, mimetype);

      const insertResult = await pool.query<{ id: number }>(
        `INSERT INTO files
          (user_id, title, description, filename, original_name, mime_type, size, scan_status, storage_url, storage_public_id, storage_resource_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id`,
        [
          req.user!.sub,
          safeTitle,
          safeDescription,
          safeFilename,
          originalname,
          mimetype,
          size,
          'clean',
          stored.url,
          stored.publicId,
          stored.resourceType,
        ],
      );
      const file = (await pool.query<FileRow>(`${SELECT_FILES} WHERE f.id = $1`, [insertResult.rows[0].id])).rows[0];
      res.status(201).json(file);
      return;
    }

    const uploadRes = await vtPost('/files', apiKey, buffer, originalname, mimetype || 'application/octet-stream');
    let analysisId: string | null = null;

    if (uploadRes.status === 200) {
      analysisId = (uploadRes.data as VTUploadResponse).data.id;
    } else {
      console.warn('[files] VT upload failed with status', uploadRes.status);
      res.status(502).json({ error: `VirusTotal upload failed (HTTP ${uploadRes.status})` });
      return;
    }

    if (!analysisId) {
      res.status(502).json({ error: 'VirusTotal did not return an analysis ID' });
      return;
    }

    const stored = await uploadSharedFile(buffer, mimetype);

    const insertResult = await pool.query<{ id: number }>(
      `INSERT INTO files
        (user_id, title, description, filename, original_name, mime_type, size, scan_status, vt_analysis_id, storage_url, storage_public_id, storage_resource_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [
        req.user!.sub,
        safeTitle,
        safeDescription,
        safeFilename,
        originalname,
        mimetype,
        size,
        'pending',
        analysisId,
        stored.url,
        stored.publicId,
        stored.resourceType,
      ],
    );
    const file = (await pool.query<FileRow>(`${SELECT_FILES} WHERE f.id = $1`, [insertResult.rows[0].id])).rows[0];
    res.status(201).json(file);
  } catch (err) {
    console.error('[files] upload error:', err instanceof Error ? err.message : err);
    res.status(502).json({ error: 'File scan or storage failed. File was not accepted.' });
  }
}

export async function checkFileScanStatus(req: Request, res: Response): Promise<void> {
  const id = parseInt(String(req.params.id), 10);

  const result = await pool.query<{
    id: number;
    user_id: number;
    filename: string;
    scan_status: string;
    vt_analysis_id: string | null;
    storage_public_id: string | null;
    storage_resource_type: CloudinaryResourceType | null;
  }>(
    'SELECT id, user_id, filename, scan_status, vt_analysis_id, storage_public_id, storage_resource_type FROM files WHERE id = $1',
    [id],
  );
  const file = result.rows[0];

  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  if (file.user_id !== req.user!.sub) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  if (file.scan_status !== 'pending' || !file.vt_analysis_id) {
    res.json({ status: file.scan_status });
    return;
  }

  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    res.json({ status: 'pending' });
    return;
  }

  try {
    const vtResult = await vtGet(`/analyses/${file.vt_analysis_id}`, apiKey);
    if (vtResult.status !== 200) {
      res.json({ status: 'pending' });
      return;
    }

    const data = vtResult.data as VTAnalysisResponse;
    if (data.data.attributes.status !== 'completed') {
      res.json({ status: 'pending' });
      return;
    }

    const stats = data.data.attributes.stats;

    if (isMalicious(stats)) {
      fs.unlink(path.join(FILES_DIR, file.filename), () => undefined);
      await deleteCloudinaryAsset(file.storage_public_id, file.storage_resource_type);
      await pool.query(
        `UPDATE files
         SET scan_status = 'rejected',
             vt_analysis_id = NULL,
             storage_url = NULL,
             storage_public_id = NULL,
             storage_resource_type = NULL
         WHERE id = $1`,
        [id],
      );
      res.json({
        status: 'rejected',
        reason: `VirusTotal flagged this file: ${stats.malicious} malicious, ${stats.suspicious} suspicious detections.`,
      });
      return;
    }

    await pool.query(
      `UPDATE files SET scan_status = 'clean', vt_analysis_id = NULL WHERE id = $1`,
      [id],
    );
    res.json({ status: 'clean' });
  } catch (err) {
    console.error('[files] scan status check error:', err instanceof Error ? err.message : err);
    res.json({ status: 'pending' });
  }
}

export async function viewFile(req: Request, res: Response): Promise<void> {
  const id = parseInt(String(req.params.id), 10);
  const result = await pool.query<Pick<FileRow, 'filename' | 'original_name' | 'mime_type' | 'scan_status' | 'storage_url'>>(
    'SELECT filename, original_name, mime_type, scan_status, storage_url FROM files WHERE id = $1',
    [id],
  );
  const file = result.rows[0];

  if (!file) { res.status(404).json({ error: 'File not found' }); return; }
  if (file.scan_status === 'pending') { res.status(202).json({ error: 'File is still being scanned. Please wait.' }); return; }
  if (file.scan_status === 'rejected') { res.status(410).json({ error: 'This file was removed after being flagged by VirusTotal.' }); return; }

  await sendStoredFile(res, file, 'inline');
}

export async function downloadFile(req: Request, res: Response): Promise<void> {
  const id = parseInt(String(req.params.id), 10);
  const result = await pool.query<Pick<FileRow, 'filename' | 'original_name' | 'mime_type' | 'scan_status' | 'storage_url'>>(
    'SELECT filename, original_name, mime_type, scan_status, storage_url FROM files WHERE id = $1',
    [id],
  );
  const file = result.rows[0];

  if (!file) { res.status(404).json({ error: 'File not found' }); return; }
  if (file.scan_status === 'pending') { res.status(202).json({ error: 'File is still being scanned. Please wait.' }); return; }
  if (file.scan_status === 'rejected') { res.status(410).json({ error: 'This file was removed after being flagged by VirusTotal.' }); return; }

  await sendStoredFile(res, file, 'attachment');
}

export async function deleteFile(req: Request, res: Response): Promise<void> {
  const id = parseInt(String(req.params.id), 10);

  const result = await pool.query<{
    user_id: number;
    filename: string;
    storage_public_id: string | null;
    storage_resource_type: CloudinaryResourceType | null;
  }>(
    'SELECT user_id, filename, storage_public_id, storage_resource_type FROM files WHERE id = $1',
    [id],
  );
  const file = result.rows[0];

  if (!file) { res.status(404).json({ error: 'File not found' }); return; }
  if (!canModerate(req, file.user_id)) {
    res.status(403).json({ error: 'You can only delete your own files' });
    return;
  }

  fs.unlink(path.join(FILES_DIR, file.filename), () => undefined);
  await deleteCloudinaryAsset(file.storage_public_id, file.storage_resource_type);
  await pool.query('DELETE FROM files WHERE id = $1', [id]);
  res.status(204).send();
}
