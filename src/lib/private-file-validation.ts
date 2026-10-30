export const MAX_PRIVATE_FILE_BYTES = 5 * 1024 * 1024;

export const PRIVATE_FILE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
} as const;

export type PrivateFileMime = keyof typeof PRIVATE_FILE_TYPES;

export function isPrivateFileMime(value: string): value is PrivateFileMime {
  return Object.prototype.hasOwnProperty.call(PRIVATE_FILE_TYPES, value);
}

export function matchesPrivateFileSignature(bytes: Uint8Array, type: string): boolean {
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes.length >= 8 && bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10';
  if (type === 'image/webp') return bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (type === 'application/pdf') return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
  return false;
}

export function sanitizePrivateFileName(value: string, fallback: string): string {
  return value.replace(/[\\/\\0-\\x1f\\x7f]/g, '_').trim().slice(0, 180) || fallback;
}

export function isValidPrivateFileSize(size: number): boolean {
  return Number.isSafeInteger(size) && size > 0 && size <= MAX_PRIVATE_FILE_BYTES;
}
