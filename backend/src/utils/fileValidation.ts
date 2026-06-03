import fs from 'fs';

function isJpeg(buf: Buffer): boolean {
  return buf.length >= 3 &&
    buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
}

function isPng(buf: Buffer): boolean {
  return buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 &&
    buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A;
}

function isWebp(buf: Buffer): boolean {
  // RIFF....WEBP
  return buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
}

function isPdf(buf: Buffer): boolean {
  // %PDF
  return buf.length >= 4 &&
    buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
}

function readHeader(source: string | Buffer): Buffer {
  if (Buffer.isBuffer(source)) {
    return source.slice(0, 12);
  }
  const buf = Buffer.alloc(12);
  const fd = fs.openSync(source, 'r');
  const bytesRead = fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);
  if (bytesRead < 3) return Buffer.alloc(0);
  return buf;
}

export function validateImageMagicBytes(source: string | Buffer): boolean {
  const buf = readHeader(source);
  return isJpeg(buf) || isPng(buf) || isWebp(buf);
}

export function validatePdfMagicBytes(source: string | Buffer): boolean {
  const buf = readHeader(source);
  return isPdf(buf);
}
