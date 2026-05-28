/**
 * Canonical HTTP client for same-origin Route Handlers (/api/*).
 *
 * Browser: ALWAYS relative `/api/...` — never localhost, never NEXT_PUBLIC_APP_URL.
 * Server: optional absolute URL only for non-local production/preview hosts.
 */

import { getSiteUrl, isLocalhostSiteUrl } from '@/lib/env';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Normalize `/auth/login` → `/api/auth/login`. */
export function resolveApiPath(path: string): string {
  if (path.startsWith('/api/')) return path;
  if (path === '/api') return path;
  if (path.startsWith('/api')) return path;
  return `/api${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Build the final fetch URL.
 * Called at request time (not module init) to avoid SSR/client bundle leaks.
 */
export function buildApiUrl(path: string): string {
  const apiPath = resolveApiPath(path);

  // Browser: same-origin only — fixes CSP + production localhost leaks.
  if (typeof window !== 'undefined') {
    return apiPath;
  }

  // Server: prefer calling route logic directly; if HTTP is required, use production site URL only.
  const site = getSiteUrl();
  if (!isLocalhostSiteUrl(site)) {
    return `${site}${apiPath}`;
  }

  return apiPath;
}

export function statusMessage(status: number): string {
  if (status === 401) return 'Invalid email or password';
  if (status === 403) return 'You do not have permission to do this';
  if (status === 404) return 'Not found';
  if (status === 429) return 'Too many attempts — please wait 60 seconds';
  if (status >= 500) return 'Server error — please try again';
  return `HTTP ${status}`;
}

export type Envelope<T> = {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: { code?: string } | unknown;
  code?: string;
};

const RETRY_503_MS = 800;

export async function parseJson(res: Response): Promise<Envelope<unknown>> {
  try {
    const raw = (await res.json()) as Envelope<unknown>;
    if (typeof raw.success === 'boolean') return raw;
    if ('error' in raw || !res.ok) return { ...raw, success: false };
    return { ...raw, success: true };
  } catch {
    return { success: false, error: 'Invalid response' };
  }
}

export async function fetchWithRetryParse(
  path: string,
  init: RequestInit
): Promise<{ res: Response; json: Envelope<unknown> }> {
  const url = buildApiUrl(path);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init.headers ?? {}),
  };
  const merged: RequestInit = {
    ...init,
    headers,
    credentials: 'include',
  };

  let last: { res: Response; json: Envelope<unknown> } | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, merged);
      const json = await parseJson(res);
      last = { res, json };
      if (res.status === 503 && attempt === 0) {
        await new Promise<void>((r) => setTimeout(r, RETRY_503_MS));
        continue;
      }
      return last;
    } catch {
      throw new ApiError('Network error', 503, 'NETWORK');
    }
  }
  if (last) return last;
  throw new ApiError('Network error', 503, 'NETWORK');
}

export async function fetchWithRetryRaw(
  path: string,
  init: RequestInit
): Promise<{ res: Response; body: unknown }> {
  const url = buildApiUrl(path);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init.headers ?? {}),
  };
  const merged: RequestInit = {
    ...init,
    headers,
    credentials: 'include',
  };

  let last: { res: Response; body: unknown } | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, merged);
      const body: unknown = await res.json().catch(() => ({}));
      last = { res, body };
      if (res.status === 503 && attempt === 0) {
        await new Promise<void>((r) => setTimeout(r, RETRY_503_MS));
        continue;
      }
      return last;
    } catch {
      throw new ApiError('Network error', 503, 'NETWORK');
    }
  }
  if (last) return last;
  throw new ApiError('Network error', 503, 'NETWORK');
}
