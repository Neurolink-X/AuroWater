// PATH: src/lib/private-file-client.ts
'use client';

import { getToken } from '@/lib/api-client';
import { HttpError, requestJson } from '@/lib/account-recovery/http'; // generic helper; consider moving to @/lib/http
import {
  MAX_PRIVATE_FILE_BYTES, detectPrivateFileMime, formatBytes, type ReviewStatus,
} from '@/lib/private-file-validation';

export type UserFile = {
  id: string; category: string; document_slot: string | null; original_name: string; content_type: string;
  size_bytes: number; review_status: ReviewStatus; review_note?: string | null; created_at: string; reviewed_at?: string | null;
};
export type SlotInfo = { slot: string; category: string; label: string; hint: string };

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  if (!token) throw new HttpError('Please sign in again.', 401);
  return { Authorization: `Bearer ${token}` };
}

/** Same rules as the server, checked instantly in the browser by reading the file's magic bytes. */
export async function validateClientFile(file: File): Promise<string | null> {
  if (file.size === 0) return 'This file is empty.';
  if (file.size > MAX_PRIVATE_FILE_BYTES) return `File is ${formatBytes(file.size)}. Maximum is ${formatBytes(MAX_PRIVATE_FILE_BYTES)}.`;
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return detectPrivateFileMime(head) ? null : 'Use a JPG, PNG, WebP or PDF file.';
}

/** Shrinks big photos so phone cameras never hit the 5 MB limit. PDFs and small images pass through untouched. */
export async function shrinkImageIfNeeded(file: File, targetBytes = 4.2 * 1024 * 1024): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= targetBytes || typeof createImageBitmap !== 'function') return file;
  try {
    const bmp = await createImageBitmap(file);
    let scale = Math.min(1, 2600 / Math.max(bmp.width, bmp.height));
    for (let i = 0; i < 4; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
      canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
      if (blob && blob.size <= targetBytes) return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
      scale *= 0.75;
    }
  } catch { /* fall back to the original; the server will give a clear error */ }
  return file;
}

type UploadArgs = {
  file: File; category: string; slot?: string;
  onProgress?: (pct: number) => void; signal?: AbortSignal; retries?: number;
};

/** XHR (not fetch) because only XHR reports upload progress. Retries network blips and 502/503/504 with backoff. */
export async function uploadPrivateFile({ file, category, slot, onProgress, signal, retries = 2 }: UploadArgs): Promise<UserFile> {
  const headers = await authHeaders();
  const attempt = () => new Promise<UserFile>((resolve, reject) => {
    const form = new FormData();
    form.append('file', file); form.append('category', category);
    if (slot) form.append('document_slot', slot);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/files/upload');
    xhr.setRequestHeader('Authorization', headers.Authorization);
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let body: { success?: boolean; data?: { file?: UserFile }; error?: string; code?: string } = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* non-JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && body.data?.file) return resolve(body.data.file);
      reject(new HttpError(body.error || 'Upload failed. Please try again.', xhr.status, body.code, Number(xhr.getResponseHeader('Retry-After')) || undefined));
    };
    xhr.onerror = () => reject(new HttpError('Network problem. Check your connection and try again.', 0, 'NETWORK'));
    xhr.ontimeout = () => reject(new HttpError('The upload timed out. Try again on a faster connection.', 0, 'TIMEOUT'));
    signal?.addEventListener('abort', () => { xhr.abort(); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
    xhr.send(form);
  });

  for (let n = 0; ; n++) {
    try { return await attempt(); } catch (e) {
      const retryable = e instanceof HttpError && (e.status === 0 || [502, 503, 504].includes(e.status));
      if (!retryable || n >= retries) throw e;
      await new Promise((r) => setTimeout(r, 600 * 2 ** n + Math.random() * 300));
    }
  }
}

export async function listMyFiles(signal?: AbortSignal) {
  const json = await requestJson<{ role: string; slots: SlotInfo[]; files: UserFile[] }>('/api/files', {
    headers: await authHeaders(), cache: 'no-store', retries: 2, signal,
  });
  return json.data ?? { role: '', slots: [], files: [] };
}

export async function getSignedFileUrl(id: string, disposition: 'inline' | 'attachment' = 'inline') {
  const json = await requestJson<{ url: string; file: { name: string; content_type: string } }>(
    `/api/files/${encodeURIComponent(id)}/download?disposition=${disposition}`, { headers: await authHeaders(), cache: 'no-store', retries: 1 });
  if (!json.data?.url) throw new HttpError('Could not open this file.', 502);
  return json.data;
}

export async function deleteMyFile(id: string) {
  await requestJson(`/api/files/${encodeURIComponent(id)}/download`, { method: 'DELETE', headers: await authHeaders() });
}
