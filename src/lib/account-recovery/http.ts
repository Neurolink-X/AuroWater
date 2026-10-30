/**
 * Small resilient fetch helper for the browser.
 * - hard timeout, caller-supplied AbortSignal support
 * - automatic retry with backoff + jitter for SAFE requests only (GET/HEAD)
 * - never throws raw network errors: everything becomes an HttpError with a friendly message
 * - understands the { success, data, error, code } envelope and Retry-After
 */

export type ApiEnvelope<T> = { success?: boolean; data?: T; error?: string; code?: string; message?: string };

export class HttpError extends Error {
  status: number;
  code?: string;
  retryAfter?: number;
  constructor(message: string, status: number, code?: string, retryAfter?: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

type Options = RequestInit & { timeoutMs?: number; retries?: number };
const RETRYABLE = new Set([502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function requestJson<T = unknown>(url: string, opts: Options = {}): Promise<ApiEnvelope<T>> {
  const { timeoutMs = 15_000, retries = 0, signal: outer, ...init } = opts;
  const method = (init.method ?? 'GET').toUpperCase();
  const maxAttempts = 1 + (method === 'GET' || method === 'HEAD' ? Math.max(0, retries) : 0);
  let lastError: HttpError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    outer?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      let body: ApiEnvelope<T> = {};
      try { body = (await res.json()) as ApiEnvelope<T>; } catch { /* non-JSON body */ }
      if (res.ok && body.success !== false) return body;
      const retryAfter = Number(res.headers.get('Retry-After')) || undefined;
      const err = new HttpError(
        body.error || (res.status === 429 ? 'Too many requests. Please wait a moment.' : 'Something went wrong. Please try again.'),
        res.status, body.code, retryAfter,
      );
      if (!RETRYABLE.has(res.status) || attempt === maxAttempts) throw err;
      lastError = err;
    } catch (e) {
      if (e instanceof HttpError) throw e;
      if (outer?.aborted) throw new DOMException('Aborted', 'AbortError'); // caller cancelled: let it bubble
      lastError = new HttpError(
        ctrl.signal.aborted ? 'The request timed out. Check your connection and try again.' : 'Network problem. Check your connection and try again.',
        0, ctrl.signal.aborted ? 'TIMEOUT' : 'NETWORK',
      );
      if (attempt === maxAttempts) throw lastError;
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener('abort', onAbort);
    }
    await sleep(400 * 2 ** (attempt - 1) + Math.random() * 250); // backoff + jitter
  }
  throw lastError ?? new HttpError('Request failed.', 0);
}

export const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';
