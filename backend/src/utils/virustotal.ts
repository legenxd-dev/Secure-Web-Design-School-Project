import https from 'https';
import crypto from 'crypto';

const VT_HOST = 'www.virustotal.com';
const VT_BASE_PATH = '/api/v3';
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 12;

export interface VTEngineResult {
  category: string;
  engine_name: string;
  engine_version: string | null;
  result: string | null;
  method: string;
}

export interface VTFileAttributes {
  last_analysis_stats: {
    malicious: number;
    suspicious: number;
    harmless: number;
    undetected: number;
    timeout: number;
    failure: number;
  };
  last_analysis_results: Record<string, VTEngineResult>;
}

export interface VTFileResponse {
  data: { attributes: VTFileAttributes };
}

export interface VTAnalysisAttributes {
  status: string;
  stats: {
    malicious: number;
    suspicious: number;
    harmless: number;
    undetected: number;
    timeout: number;
    failure: number;
  };
  results: Record<string, VTEngineResult>;
}

export interface VTAnalysisResponse {
  data: {
    id: string;
    attributes: VTAnalysisAttributes;
  };
}

export interface VTUploadResponse {
  data: { id: string };
}

export function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function httpsRequest(path: string, options: https.RequestOptions, body?: Buffer): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { ...options, hostname: VT_HOST, path, port: 443, family: 4 },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          try {
            const text = Buffer.concat(chunks).toString('utf8');
            resolve({ status: res.statusCode ?? 0, data: JSON.parse(text) });
          } catch (e) {
            reject(e);
          }
        });
        res.on('error', reject);
      },
    );
    req.setTimeout(30000, () => { req.destroy(new Error('Request timeout')); });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function buildMultipart(fileBuffer: Buffer, filename: string, mimeType: string): { body: Buffer; boundary: string } {
  const boundary = `----FormBoundary${Date.now().toString(16)}`;
  const CRLF = '\r\n';
  const header = Buffer.from(
    `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}Content-Type: ${mimeType}${CRLF}${CRLF}`,
    'utf8',
  );
  const footer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf8');
  return { body: Buffer.concat([header, fileBuffer, footer]), boundary };
}

export async function vtPost(path: string, apiKey: string, fileBuffer: Buffer, filename: string, mimeType: string) {
  const { body, boundary } = buildMultipart(fileBuffer, filename, mimeType);
  return httpsRequest(`${VT_BASE_PATH}${path}`, {
    method: 'POST',
    headers: {
      'x-apikey': apiKey,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length,
    },
  }, body);
}

export async function vtGet(path: string, apiKey: string) {
  return httpsRequest(`${VT_BASE_PATH}${path}`, {
    method: 'GET',
    headers: { 'x-apikey': apiKey },
  });
}

export async function pollAnalysis(analysisId: string, apiKey: string): Promise<VTAnalysisResponse | null> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const res = await vtGet(`/analyses/${analysisId}`, apiKey);
    if (res.status !== 200) return null;
    const data = res.data as VTAnalysisResponse;
    if (data.data.attributes.status === 'completed') return data;
  }
  return null;
}

export function formatFromFileReport(file: VTFileResponse, fileName: string, fileSize: number) {
  const attrs = file.data.attributes;
  const engines = Object.values(attrs.last_analysis_results).map((e) => ({
    name: e.engine_name,
    category: e.category,
    result: e.result,
  }));
  return { status: 'completed', fileName, fileSize, stats: attrs.last_analysis_stats, engines };
}

export function formatAnalysisResult(analysis: VTAnalysisResponse, fileName: string, fileSize: number) {
  const { stats, results } = analysis.data.attributes;
  const engines = Object.values(results).map((e) => ({
    name: e.engine_name,
    category: e.category,
    result: e.result,
  }));
  return { status: 'completed', fileName, fileSize, stats, engines };
}
