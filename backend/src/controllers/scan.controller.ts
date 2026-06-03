import { Request, Response } from 'express';
import {
  sha256,
  vtGet,
  vtPost,
  pollAnalysis,
  formatFromFileReport,
  formatAnalysisResult,
  VTFileResponse,
  VTAnalysisResponse,
  VTUploadResponse,
} from '../utils/virustotal';

export async function checkAnalysis(req: Request, res: Response): Promise<void> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'VirusTotal API key is not configured' });
    return;
  }

  const { id } = req.params;
  if (!id || !/^[A-Za-z0-9+/=_\-]+$/.test(id)) {
    res.status(400).json({ error: 'Invalid analysis ID' });
    return;
  }

  try {
    const result = await vtGet(`/analyses/${id}`, apiKey);
    if (result.status !== 200) {
      res.status(502).json({ error: `VirusTotal returned HTTP ${result.status}` });
      return;
    }

    const data = result.data as VTAnalysisResponse;
    if (data.data.attributes.status !== 'completed') {
      res.status(202).json({
        status: 'pending',
        analysisId: id,
        message: 'Analysis is still in progress. Try again in a moment.',
      });
      return;
    }

    res.json(formatAnalysisResult(data, '', 0));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[scan] check error:', message);
    res.status(502).json({ error: `Failed to communicate with VirusTotal: ${message}` });
  }
}

export async function scanFile(req: Request, res: Response): Promise<void> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'VirusTotal API key is not configured' });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: 'No file provided' });
    return;
  }

  const { originalname, buffer, size, mimetype } = req.file;

  try {
    const hash = sha256(buffer);
    const fileReport = await vtGet(`/files/${hash}`, apiKey);

    if (fileReport.status === 200) {
      const data = fileReport.data as VTFileResponse;
      res.json(formatFromFileReport(data, originalname, size));
      return;
    }

    const uploadRes = await vtPost('/files', apiKey, buffer, originalname, mimetype || 'application/octet-stream');

    if (uploadRes.status !== 200) {
      const body = uploadRes.data as { error?: { message?: string } };
      const vtErr = body.error?.message ?? `VirusTotal upload failed (HTTP ${uploadRes.status})`;
      console.error('[scan] upload error:', uploadRes.status, vtErr);
      res.status(502).json({ error: vtErr });
      return;
    }

    const uploadData = uploadRes.data as VTUploadResponse;
    const analysisId = uploadData.data.id;
    const analysis = await pollAnalysis(analysisId, apiKey);

    if (!analysis) {
      res.status(202).json({
        status: 'pending',
        analysisId,
        message: 'Analysis is queued. Click "Check Status" in about a minute to see results.',
      });
      return;
    }

    res.json(formatAnalysisResult(analysis, originalname, size));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[scan] VirusTotal error:', message);
    res.status(502).json({ error: `Failed to communicate with VirusTotal: ${message}` });
  }
}
