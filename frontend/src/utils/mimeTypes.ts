export function isImage(mime: string): boolean { return mime.startsWith('image/'); }
export function isText(mime: string): boolean {
  return mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/xml';
}
export function isPdf(mime: string): boolean { return mime === 'application/pdf'; }
export function isVideo(mime: string): boolean { return mime.startsWith('video/'); }
export function isAudio(mime: string): boolean { return mime.startsWith('audio/'); }
export function isPreviewable(mime: string): boolean {
  return isImage(mime) || isText(mime) || isPdf(mime) || isVideo(mime) || isAudio(mime);
}
