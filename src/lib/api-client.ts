import type { ProfileRow } from '@/lib/db/types';
import type { AuthToken, User } from '@/types';
import { clearAuthGateCookies } from '@/lib/auth/client-gate-cookies';
import { createClient } from '@/utils/supabase/client';
import { safeGet, safeRemove, safeSet } from '@/lib/storage';
import { getUserErrorMessage } from '@/lib/errors/app-error';

/** Same-origin App Router API. Do not use NEXT_PUBLIC_API_URL (breaks production). */
const API_BASE = '/api';

const TOKEN_KEY = 'auth_token';

// Supabase rotates refresh tokens. Share one refresh operation across concurrent
// requests in this tab so parallel dashboard calls cannot consume the same token.
let refreshInFlight: Promise<{ access_token: string; refresh_token: string } | null> | null = null;

async function refreshSessionSingleFlight(): Promise<{ access_token: string; refresh_token: string } | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const { data, error } = await createClient().auth.refreshSession();
      if (error || !data.session?.access_token || !data.session.refresh_token) return null;
      return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
    } catch {
      return null;
    }
  })();
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    /** Machine-readable code when API returns `{ code }` (e.g. DB_NOT_READY). */
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Safe message for UI when catching unknown rejections from `apiFetch` / auth helpers. */
export function getApiErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    return getUserErrorMessage(e, {
      status: e.status,
      code: e.code,
    });
  }

  return getUserErrorMessage(e);
}

export async function getToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  try {
    const supabase = createClient();
    const { data: sessionData } =
      await supabase.auth.getSession();

    const session = sessionData.session;

    // No stored Supabase session means there is no refresh token to refresh.
    // Calling refreshSession() here caused repeated "Invalid Refresh Token" console
    // errors after browser storage was cleared or a previous session expired.
    if (!session) {
      clearToken();
      clearUser();
      clearAuthGateCookies();
      safeRemove('aurowater_session');
      return null;
    }

    const expiresAtMs =
      Number(session.expires_at ?? 0) * 1000;

    const refreshBeforeMs =
      60 * 1000;

    if (
      !expiresAtMs ||
      expiresAtMs - Date.now() <= refreshBeforeMs
    ) {
      const refreshed = await refreshSessionSingleFlight();
      if (!refreshed?.access_token) return null;
      setToken(refreshed.access_token);
      return refreshed.access_token;
    }

    return session.access_token;
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  safeSet(TOKEN_KEY, token);
}

export function clearToken(): void {
  safeRemove(TOKEN_KEY);
}

type Envelope<T> = { success: boolean; data?: T; error?: string; code?: string };

const RETRY_503_MS = 800;

function apiTelemetryGroup(path: string): string | null {
  const clean = path.split('?')[0] ?? path;
  if (/^\/customer\/orders\/[^/]+$/.test(clean)) return 'customer_order_detail';
  if (clean === '/supplier/orders' || clean.startsWith('/supplier/orders/')) return 'supplier_orders';
  if (clean === '/technician/jobs' || clean.startsWith('/technician/jobs/')) return 'technician_jobs';
  if (clean === '/admin/dashboard' || clean === '/admin/orders' || clean.startsWith('/admin/dashboard/')) return 'admin_dashboard';
  return null;
}

/** Best-effort sampled API latency reporting; telemetry must never block an API response. */
function reportApiTiming(path: string, startedAt: number, status: number): void {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production' ||
      !navigator.sendBeacon || Math.random() > 0.2) return;
  const apiGroup = apiTelemetryGroup(path);
  if (!apiGroup) return;
  try {
    const payload = {
      kind: 'api',
      name: 'API',
      value: Math.round(performance.now() - startedAt),
      rating: 'unknown',
      route_group: apiGroup === 'customer_order_detail' ? 'customer' :
        apiGroup === 'supplier_orders' ? 'supplier' :
        apiGroup === 'technician_jobs' ? 'technician' : 'admin',
      api_group: apiGroup,
      status_class: status >= 500 ? '5xx' : status >= 400 ? '4xx' : '2xx',
    };
    navigator.sendBeacon('/api/internal/telemetry/web-vitals', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  } catch {
    // Telemetry must never affect the user request.
  }
}

async function parseJson(res: Response): Promise<Envelope<unknown>> {
  try {
    return (await res.json()) as Envelope<unknown>;
  } catch {
    return { success: false, error: 'Invalid response' };
  }
}

/**
 * All app API calls: `credentials: 'include'`, one automatic retry after 800ms on HTTP 503.
 * Network failure → `ApiError` with code `NETWORK` (use `apiFetchSafe` to get `{ ok: false }` instead).
 */
async function performFetchWithRetryParse(
  path: string,
  init: RequestInit
): Promise<{ res: Response; json: Envelope<unknown> }> {
  const url = `${API_BASE}${path}`;
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
  const startedAt = typeof performance !== 'undefined' ? performance.now() : 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, merged);
      const json = await parseJson(res);
      last = { res, json };
      if (res.status === 503 && attempt === 0) {
        await new Promise<void>((r) => setTimeout(r, RETRY_503_MS));
        continue;
      }
      reportApiTiming(path, startedAt, res.status);
      return last;
    } catch {
      // Network changes are common on mobile/Wi-Fi handoffs. Retry once rather
      // than failing the first same-origin request immediately.
      if (attempt === 0) {
        await new Promise<void>((r) => setTimeout(r, 350));
        continue;
      }
      throw new ApiError('Network error', 503, 'NETWORK');
    }
  }
  if (last) return last;
  throw new ApiError('Network error', 503, 'NETWORK');
}

// Coalesce identical in-flight GETs (including auth identity) to avoid duplicate
// dashboard reads during concurrent component mounts. Never share mutations or abortable calls.
const inFlightGetRequests = new Map<string, Promise<{ res: Response; json: Envelope<unknown> }>>();

async function fetchWithRetryParse(
  path: string,
  init: RequestInit
): Promise<{ res: Response; json: Envelope<unknown> }> {
  const method = (init.method ?? 'GET').toUpperCase();
  if (method !== 'GET' || init.signal) return performFetchWithRetryParse(path, init);
  const headers = new Headers(init.headers);
  const key = [path, headers.get('Authorization') ?? '', headers.get('Accept') ?? '', String(init.cache ?? '')].join('|');
  const existing = inFlightGetRequests.get(key);
  if (existing) return existing;
  const request = performFetchWithRetryParse(path, init);
  inFlightGetRequests.set(key, request);
  try {
    return await request;
  } finally {
    if (inFlightGetRequests.get(key) === request) inFlightGetRequests.delete(key);
  }
}

/** Same retry/credentials/network rules; parses JSON body without `{ success, data }` envelope (admin routes). */
async function fetchWithRetryRaw(
  path: string,
  init: RequestInit
): Promise<{ res: Response; body: unknown }> {
  const url = `${API_BASE}${path}`;
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
  const startedAt = typeof performance !== 'undefined' ? performance.now() : 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, merged);
      const body: unknown = await res.json().catch(() => ({}));
      last = { res, body };
      if (res.status === 503 && attempt === 0) {
        await new Promise<void>((r) => setTimeout(r, RETRY_503_MS));
        continue;
      }
      reportApiTiming(path, startedAt, res.status);
      return last;
    } catch {
      if (attempt === 0) {
        await new Promise<void>((r) => setTimeout(r, 350));
        continue;
      }
      throw new ApiError('Network error', 503, 'NETWORK');
    }
  }
  if (last) return last;
  throw new ApiError('Network error', 503, 'NETWORK');
}

async function apiFetch<T>(path: string, init: RequestInit = {}, redirectOnUnauthorized = true): Promise<T> {
  let { res, json } = await fetchWithRetryParse(path, init);

  const authEndpoint = /^\/(auth\/(login|register|refresh|resend-confirmation)|auth\/callback)(\/|$)/.test(path);
  const onAuthEntry =
    typeof window !== 'undefined' &&
    (window.location.pathname.startsWith('/auth/login') ||
      window.location.pathname.startsWith('/auth/register'));

  // Recover once from an expired access token before treating the user as signed out.
  // Do not run this for login/register: their 401/4xx responses are form errors, not expired sessions.
  if (res.status === 401 && redirectOnUnauthorized && !authEndpoint && !onAuthEntry && typeof window !== 'undefined') {
    try {
      const supabase = createClient();
      const { data: current } = await supabase.auth.getSession();
      if (current.session?.refresh_token) {
        const refreshed = await refreshSessionSingleFlight();
        const token = refreshed?.access_token;
        if (token) {
          const headers = new Headers(init.headers);
          headers.set('Authorization', `Bearer ${token}`);
          ({ res, json } = await fetchWithRetryParse(path, { ...init, headers, credentials: 'include' }));
        }
      }
    } catch {
      // Preserve the original API response; only clear auth after confirmed retry failure below.
    }
  }

  if (!res.ok || json.success === false) {
    if (res.status === 401 && redirectOnUnauthorized && !authEndpoint && !onAuthEntry && typeof window !== 'undefined') {
      // Only protected requests with an app session should redirect. Public endpoint 401s
      // and failed login attempts must not destroy an otherwise valid local session.
      const cachedSession = safeGet('aurowater_session');
      const hasSession = Boolean(cachedSession);
      if (hasSession) {
        clearToken();
        clearUser();
        clearAuthGateCookies();
        safeRemove('aurowater_session');
        const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search || ''}`);
        window.location.assign(`/auth/login?returnTo=${returnTo}&reason=session-expired`);
      }
    }
    const msg = typeof json.error === 'string' ? json.error : `HTTP ${res.status}`;
    const code = typeof json.code === 'string' ? json.code : undefined;
    throw new ApiError(msg, res.status, code);
  }

  return json.data as T;
}

/** Same as `apiFetch` but never throws on transport failure — returns `{ ok: false, error: 'Network error' }`. */
export type ApiSafeResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function apiFetchSafe<T>(path: string, init: RequestInit = {}): Promise<ApiSafeResult<T>> {
  try {
    const data = await apiFetch<T>(path, init);
    return { ok: true, data };
  } catch (e: unknown) {
    if (e instanceof ApiError && e.code === 'NETWORK') {
      return { ok: false, error: 'Network error' };
    }
    if (e instanceof ApiError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: 'Network error' };
  }
}

async function apiFetchAuth<T>(path: string, init: RequestInit = {}): Promise<T> {
  const supabase = createClient();

  const requestWithToken = (token: string) =>
    apiFetch<T>(
      path,
      {
        ...init,
        credentials: 'include',
        headers: {
          ...(init.headers ?? {}),
          Authorization: `Bearer ${token}`,
        },
      },
      false, // Do not redirect until a one-time session refresh has been attempted.
    );

  try {
    const token = await getToken();
    if (!token) {
      throw new ApiError('No authentication token found', 401);
    }

    try {
      return await requestWithToken(token);
    } catch (firstError) {
      if (!(firstError instanceof ApiError) || firstError.status !== 401) {
        throw firstError;
      }

      // A stale access token can return 401 even while the refresh token is still valid.
      // Refresh once and retry the exact same request before treating the user as signed out.
      const refreshed = await refreshSessionSingleFlight();
      const refreshedToken = refreshed?.access_token;
      if (!refreshedToken) {
        throw new ApiError('Your session has expired. Please sign in again.', 401, 'SESSION_EXPIRED');
      }

      try {
        return await requestWithToken(refreshedToken);
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.status === 401) {
          throw new ApiError('Your session could not be renewed. Please sign in again.', 401, 'SESSION_EXPIRED');
        }
        throw retryError;
      }
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      // Clear this browser's invalid session only after refresh + retry both fail.
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        /* stale refresh tokens can make local sign-out throw; clear app-side state below */
      }
      clearToken();
      clearUser();
      clearAuthGateCookies();
      safeRemove('aurowater_session');

      if (typeof window !== 'undefined') {
        const onAuthEntry =
          window.location.pathname.startsWith('/auth/login') ||
          window.location.pathname.startsWith('/auth/register');
        if (!onAuthEntry) {
          const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search || ''}`);
          window.location.assign(`/auth/login?returnTo=${returnTo}&reason=session-expired`);
        }
      }
    }
    throw error;
  }
}

/* ─── Auth ─────────────────────────────────────────────────────────── */

export type LoginResult = {
  access_token: string;
  refresh_token: string;
  expires_at: number | null;
  profile: ProfileRow;
};

export async function authRegister(body: {
  email?: string;
  password: string;
  full_name: string;
  phone: string;
  role?: string;
  invite_code?: string;
  city?: string;
  pincode?: string;
  business_name?: string;
  business_type?: string;
  gst_number?: string;
  vehicle_type?: string;
  license_number?: string;
}): Promise<LoginResult | { needsEmailConfirmation: true; email: string; pending?: boolean }> {
  const { res, json } = await fetchWithRetryParse('/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok || json.success === false) {
    throw new ApiError(
      typeof json.error === 'string' ? json.error : 'Registration failed',
      res.status,
      typeof json.code === 'string' ? json.code : undefined
    );
  }
  const data = json.data as LoginResult | { needsEmailConfirmation: true; email: string };
  if ('access_token' in data && data.access_token) {
    setToken(data.access_token);
    if ('refresh_token' in data && data.refresh_token) {
      try {
        const supabase = createClient();
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
      } catch {
        /* localStorage token still set */
      }
    }
  }
  return data;
}

export async function authLogin(
  email: string,
  password: string,
  extra?: { phone?: string }
): Promise<LoginResult> {
  const data = await apiFetch<LoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, phone: extra?.phone }),
  });
  setToken(data.access_token);
  if (data.refresh_token) {
    try {
      const supabase = createClient();
      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
    } catch {
      /* token still in storage */
    }
  }
  return data;
}

export async function authResendConfirmation(email: string): Promise<void> {
  await apiFetch<{ sent: true }>('/auth/resend-confirmation', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
}

export async function authLogout(): Promise<void> {
  // Clear client credentials synchronously so logout never waits on network latency.
  clearToken();
  clearUser();
  clearAuthGateCookies();
  safeRemove('aurowater_session');

  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
    });
  } catch {
    /* Local logout is already complete; server cleanup is best-effort. */
  }
}

export async function authMe(): Promise<ProfileRow> {
  return apiFetchAuth<ProfileRow>('/auth/me', { method: 'GET' });
}

export async function authUpdateMe(patch: Partial<Pick<ProfileRow, 'full_name' | 'phone' | 'avatar_url'>>): Promise<ProfileRow> {
  return apiFetchAuth<ProfileRow>('/auth/me', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

export async function authRefresh(refresh_token: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: number | null;
}> {
  const data = await apiFetch<{
    access_token: string;
    refresh_token: string;
    expires_at: number | null;
  }>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token }),
  });
  setToken(data.access_token);
  return data;
}

type AuthRoleLocal = 'customer' | 'technician' | 'supplier' | 'admin';

/** Map Supabase profile + tokens into useAuth `Session` fields. */
export function profileToSession(
  profile: ProfileRow,
  tokens: { access_token: string; refresh_token: string; expires_at?: number | null }
) {
  const role = profile.role as AuthRoleLocal;
  return {
    name: profile.full_name ?? '',
    email: profile.email ?? '',
    role,
    phone: profile.phone ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
    aurotapId: profile.aurotap_id ?? undefined,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    userId: profile.id,
  };
}

/* ─── Settings & services ─────────────────────────────────────────── */

export async function getPublicSettings(): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>('/settings', { method: 'GET' });
}

export async function getServices(): Promise<unknown[]> {
  return apiFetch<unknown[]>('/services', { method: 'GET' });
}

export async function getTechnicians(): Promise<unknown[]> {
  return apiFetch<unknown[]>('/technicians', { method: 'GET' });
}

export async function postContact(body: {
  name: string;
  email: string;
  message: string;
  phone?: string;
}): Promise<{ received: boolean }> {
  return apiFetch<{ received: boolean }>('/contact', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/* ─── Customer ─────────────────────────────────────────────────────── */

export type ApiOrder = {
  id: string;
  order_number?: string;
  status: string;
  created_at: string;
  updated_at: string;
  service_type_id: number;
  service_type_key?: string | null;
  sub_option_key?: string | null;
  address_snapshot?: Record<string, unknown> | null;
  scheduled_date?: string | null;
  time_slot?: string | null;
  is_emergency?: boolean;
  total_amount: number | string;
  payment_method?: string | null;
  payment_status?: string;
  technician_id?: string | null;
  notes?: string | null;
  can_quantity?: number | null;
  can_order_type?: string | null;
  can_frequency?: string | null;
  can_price_per_unit?: number | string | null;
};

export type ApiAddress = {
  id: string;
  label?: string | null;
  house_flat?: string | null;
  area?: string | null;
  city?: string | null;
  pincode?: string | null;
  landmark?: string | null;
  is_default?: boolean | null;
  lat?: number | null;
  lng?: number | null;
  zone_id?: string | null;
  created_at?: string | null;
};

export type CustomerServiceability = {
  serviceable: boolean;
  status: string;
  zone: {
    id: string;
    name: string;
    city: string;
  } | null;
  message: string;
  services: string[] | null;
};

export type ReverseGeocodeResult = {
  lat: number;
  lng: number;
  formattedAddress: string | null;
  placeId: string | null;
  houseNumber: string | null;
  route: string | null;
  area: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
  types: string[];
};

export type ApiNotification = {
  id: string;
  title: string;
  body?: string | null;
  message?: string | null;
  type?: string | null;
  icon?: string | null;
  is_read?: boolean | null;
  order_id?: string | null;
  created_at?: string | null;
};

export type CustomerStats = {
  total_orders: number;
  active_orders: number;
  completed: number;
  cancelled: number;
  total_spent: number;
  savings: number;
  avg_rating: number | null;
  total_reviews: number;
};

export async function customerOrdersList(params?: { status?: string; limit?: number; offset?: number }): Promise<ApiOrder[]> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set('status', params.status);
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.offset != null) sp.set('offset', String(params.offset));
  const q = sp.toString();
  return apiFetchAuth<ApiOrder[]>(`/customer/orders${q ? `?${q}` : ''}`);
}

export async function customerOrderGet(id: string): Promise<ApiOrder> {
  return apiFetchAuth<ApiOrder>(`/customer/orders/${id}`);
}

export async function customerOrderCreate(body: Record<string, unknown>): Promise<ApiOrder> {
  return apiFetchAuth<ApiOrder>('/customer/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function customerOrderCancel(id: string, reason?: string): Promise<ApiOrder> {
  return apiFetchAuth<ApiOrder>(`/customer/orders/${id}/cancel`, {
    method: 'PUT',
    body: JSON.stringify({ reason: reason ?? '' }),
  });
}

export async function customerStats(): Promise<CustomerStats> {
  return apiFetchAuth<CustomerStats>('/customer/stats');
}

export async function customerAddresses(): Promise<ApiAddress[]> {
  return apiFetchAuth<ApiAddress[]>('/customer/addresses');
}

export async function customerServiceability(
  addressId: string,
  service?: string
): Promise<CustomerServiceability> {
  const sp = new URLSearchParams({
    address_id: addressId,
  });

  if (service) {
    sp.set('service', service);
  }

  return apiFetchAuth<CustomerServiceability>(
    `/customer/serviceability?${sp.toString()}`
  );
}


export type CustomerSubscription = {
  id: string;
  customer_id: string;
  address_id: string;
  first_order_id: string | null;
  last_order_id: string | null;
  quantity: number;
  frequency: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  start_date: string;
  next_order_date: string;
  preferred_time_slot: string;
  preferred_start_time: string;
  preferred_end_time: string;
  payment_method: 'cash' | 'upi';
  price_per_can: number;
  convenience_fee: number;
  gst_rate: number;
  notes: string | null;
  pause_reason: string | null;
  created_at: string;
  updated_at: string;
};

export async function customerSubscriptionsList(): Promise<CustomerSubscription[]> {
  return apiFetchAuth<CustomerSubscription[]>('/customer/subscriptions');
}

export async function customerSubscriptionUpdate(
  id: string,
  action: 'pause' | 'resume' | 'cancel'
): Promise<CustomerSubscription> {
  return apiFetchAuth<CustomerSubscription>(
    `/customer/subscriptions/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    }
  );
}


export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult> {
  return apiFetchAuth<ReverseGeocodeResult>('/geocode/reverse', {
    method: 'POST',
    body: JSON.stringify({ lat, lng }),
  });
}
export type ForwardGeocodeResult = {
  lat: number;
  lng: number;
  formattedAddress: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
};

export async function forwardGeocodeAddress(body: {
  house_flat: string;
  area: string;
  city: string;
  pincode: string;
}): Promise<ForwardGeocodeResult> {
  return apiFetchAuth<ForwardGeocodeResult>('/geocode/forward', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type NewAddressPayload = {
  label?: string;
  house_flat: string;
  area: string;
  city: string;
  pincode: string;
  landmark?: string;
  is_default?: boolean;
  lat?: number;
  lng?: number;
};

export async function customerAddressCreate(body: NewAddressPayload): Promise<ApiAddress> {
  return apiFetchAuth<ApiAddress>('/customer/addresses', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function customerAddressUpdate(id: string, body: Partial<NewAddressPayload>): Promise<ApiAddress> {
  return apiFetchAuth<ApiAddress>(`/customer/addresses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function customerAddressDelete(id: string): Promise<void> {
  await apiFetchAuth(`/customer/addresses/${id}`, { method: 'DELETE' });
}

export async function customerNotificationsList(limit = 30): Promise<ApiNotification[]> {
  return apiFetchAuth<ApiNotification[]>(`/customer/notifications?limit=${encodeURIComponent(String(limit))}`);
}

export async function customerNotificationsMarkRead(body: { ids: string[] | 'all' }): Promise<{ updated: number }> {
  return apiFetchAuth<{ updated: number }>('/customer/notifications/read', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function customerReviewCreate(body: { order_id: string; rating: number; text?: string }): Promise<{
  id: string;
  rating: number;
  created_at: string;
}> {
  return apiFetchAuth<{ id: string; rating: number; created_at: string }>('/customer/reviews', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/* ─── Admin ────────────────────────────────────────────────────────── */

/** Read-only supplier dispatch diagnosis; uses the normal authenticated admin API client. */
export async function adminDispatchDiagnose(orderId: string): Promise<unknown> {
  const id = orderId.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ApiError('Enter a valid order UUID.', 400, 'INVALID_ORDER_ID');
  }
  return apiFetchAuth<unknown>(`/admin/dispatch/diagnose?orderId=${encodeURIComponent(id)}`);
}

/** Explicitly runs the normal dispatch attempt; this can change order assignment. */
export async function adminDispatchRetry(orderId: string): Promise<unknown> {
  const id = orderId.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ApiError('Enter a valid order UUID.', 400, 'INVALID_ORDER_ID');
  }
  return apiFetchAuth<unknown>('/admin/dispatch/diagnose', {
    method: 'POST',
    body: JSON.stringify({ orderId: id }),
  });
}

export async function adminDashboard(): Promise<unknown> {
  return apiFetchAuth('/admin/dashboard');
}

export async function adminOrders(params?: Record<string, string | undefined>): Promise<unknown[]> {
  const sp = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '') sp.set(k, v);
    }
  }
  const q = sp.toString();
  return apiFetchAuth(`/admin/orders${q ? `?${q}` : ''}`);
}

export type AdminFinanceSnapshot = {
  range: '7d' | '30d' | '90d' | 'all';
  order_count: number;
  gross_revenue: number;
  collected_revenue: number;
  pending_payments: number;
};

export async function adminFinance(range?: '7d' | '30d' | '90d' | 'all'): Promise<AdminFinanceSnapshot> {
  const q = range ? `?range=${encodeURIComponent(range)}` : '';
  return apiFetchAuth<AdminFinanceSnapshot>(`/admin/finance${q}`);
}

export async function adminUsers(params?: { role?: string; limit?: number; offset?: number }): Promise<unknown[]> {
  const sp = new URLSearchParams();
  if (params?.role) sp.set('role', params.role);
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.offset != null) sp.set('offset', String(params.offset));
  const q = sp.toString();
  return apiFetchAuth(`/admin/users${q ? `?${q}` : ''}`);
}

export async function adminSettingsPut(patch: Record<string, unknown>): Promise<Record<string, unknown>> {
  return apiFetchAuth('/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

export async function adminSettingsGet(): Promise<Record<string, unknown>> {
  return apiFetchAuth('/admin/settings');
}

/** Admin list endpoints return `{ ok, data, meta }` — `apiFetch` only returns `data`. */
async function adminFetchJson<T>(path: string): Promise<T> {
  const token = await getToken();
  if (!token) {
    throw new ApiError('No authentication token found', 401);
  }
  const { res, body } = await fetchWithRetryRaw(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = body as T & { error?: string };
  if (!res.ok) {
    const err =
      json && typeof json === 'object' && 'error' in json ? String((json as { error?: string }).error) : '';
    throw new ApiError(err || `HTTP ${res.status}`, res.status);
  }
  return json as T;
}

export type AdminOrderRow = {
  id: string;
  status: string;
  total_amount: number | null;
  platform_fee: number | null;
  created_at: string;
  updated_at: string | null;
  service_type: string | null;
  address: string | null;
  is_emergency: boolean | null;
  customer_id: string | null;
  technician_id: string | null;
  payment_status: string | null;
  customer_name: string | null;
  technician_name: string | null;
};

export async function adminOrdersWithMeta(
  params?: Record<string, string | undefined>
): Promise<{ data: AdminOrderRow[]; meta: Record<string, unknown> }> {
  const sp = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '') sp.set(k, v);
    }
  }
  const q = sp.toString();
  const json = await adminFetchJson<{ data: AdminOrderRow[]; meta: Record<string, unknown> }>(
    `/admin/orders${q ? `?${q}` : ''}`
  );
  return { data: json.data ?? [], meta: json.meta ?? {} };
}

/** Single order for admin drawer — includes joined customer/tech/service fields. */
export type AdminOrderDetail = Record<string, unknown> & {
  id: string;
  status: string;
  order_number?: string | null;
  customer_id?: string | null;
  technician_id?: string | null;
  total_amount?: number | string | null;
  base_amount?: number | string | null;
  convenience_fee?: number | string | null;
  gst_amount?: number | string | null;
  emergency_charge?: number | string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  is_emergency?: boolean | null;
  scheduled_date?: string | null;
  time_slot?: string | null;
  sub_option_key?: string | null;
  notes?: string | null;
  created_at?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  technician_name?: string | null;
  technician_phone?: string | null;
  service_name?: string | null;
  service_key?: string | null;
  address_text?: string;
};

export async function adminOrderGet(id: string): Promise<AdminOrderDetail> {
  return apiFetchAuth<AdminOrderDetail>(`/admin/orders/${encodeURIComponent(id)}`);
}

export async function adminOrderUpdate(id: string, patch: Record<string, unknown>): Promise<unknown> {
  return apiFetchAuth(`/admin/orders/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

export type AdminTechnicianRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  is_online?: boolean | null;
  active_jobs?: number;
  email?: string | null;
  role?: string | null;
  stats?: { active: number; done: number };
};

export async function adminTechniciansList(): Promise<AdminTechnicianRow[]> {
  return apiFetchAuth<AdminTechnicianRow[]>('/admin/technicians');
}



export type AdminUserRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  status?: string | null;
  is_active: boolean | null;
  city: string | null;
  created_at: string;
  updated_at: string | null;

  // Customer order and spending metrics
  order_count: number | null;
  total_spent: number | null;

  // Verification and application status
  verification_status: string | null;
  application_status: string | null;
  application_type: string | null;

  // Supplier / technician quality and work metrics
  average_rating: number | null;
  review_count: number;
  low_rating_count: number;
  completed_work_count: number | null;
  cancelled_work_count: number | null;
};



export async function adminUsersWithMeta(params?: {
  role?: string;
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: AdminUserRow[]; meta: Record<string, unknown> }> {
  const sp = new URLSearchParams();
  if (params?.role) sp.set('role', params.role);
  if (params?.search) sp.set('search', params.search);
  if (params?.status) sp.set('status', params.status);
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.offset != null) sp.set('offset', String(params.offset));
  const q = sp.toString();
  const json = await adminFetchJson<{ data: AdminUserRow[]; meta: Record<string, unknown> }>(
    `/admin/users${q ? `?${q}` : ''}`
  );
  return { data: json.data ?? [], meta: json.meta ?? {} };
}

export async function adminUserUpdate(
  id: string,
  patch: { role?: string; is_active?: boolean; full_name?: string; phone?: string; status?: string; rejection_reason?: string }
): Promise<unknown> {
  return apiFetchAuth(`/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

/* ─── Supplier / technician (dashboard APIs) ─────────────────────── */

export type SupplierEarningsSummary = {
  period: string;
  order_count: number;
  gross_amount: number;
  pending_payout: number;
};

export type SupplierStock = {
  supplier_id: string;
  cans_available: number;
  reserved_cans: number;
  low_stock_alert: number;
  reservation_buffer_cans: number;
  updated_at: string;
};

export async function supplierStockGet(): Promise<SupplierStock | null> {
  return apiFetchAuth<SupplierStock | null>('/supplier/stock');
}

export type SupplierDispatchSettings = {
  is_online: boolean;
  zone_radius_km: number;
  base_lat: number | null;
  base_lng: number | null;
};

export type SupplierApiOrder = {
  id: string;
  order_number?: string | null;
  booking_id?: string | null;
  status: string;
  created_at: string;
  updated_at?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_city?: string | null;
  service_type?: string | null;
  service_type_key?: string | null;
  service_type_label?: string | null;
  service_type_id?: number | null;
  total_amount?: number | string | null;
  final_amount?: number | string | null;
  amount?: number | string | null;
  can_count?: number | null;
  can_quantity?: number | null;
  cans_count?: number | null;
  address?: string | null;
  address_line?: string | null;
  address_text?: string | null;
  delivery_address?: Record<string, unknown> | null;
  address_snapshot?: Record<string, unknown> | null;
  city?: string | null;
  scheduled_at?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  time_slot?: string | null;
  scheduled_slot?: string | null;
  note?: string | null;
  notes?: string | null;
  accepted_at?: string | null;
  assigned_at?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
};

export async function supplierSettingsGet(): Promise<SupplierDispatchSettings | null> {
  return apiFetchAuth<SupplierDispatchSettings | null>('/supplier/settings');
}

export async function supplierSettingsUpdate(body: {
  is_online?: boolean;
  base_lat?: number | null;
  base_lng?: number | null;
  zone_radius_km?: number;
}): Promise<SupplierDispatchSettings> {
  return apiFetchAuth<SupplierDispatchSettings>('/supplier/settings', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}



export async function supplierStockUpdate(body: {
  cans_available?: number;
  stock_delta?: number;
  low_stock_alert?: number;
  reservation_buffer_cans?: number;
}): Promise<SupplierStock> {
  return apiFetchAuth<SupplierStock>('/supplier/stock', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}



export async function supplierOrdersList(params?: { status?: string }): Promise<SupplierApiOrder[]> {
  const q = params?.status ? `?status=${encodeURIComponent(params.status)}` : '';
  return apiFetchAuth<SupplierApiOrder[]>(`/supplier/orders${q}`);
}

export async function supplierOrderAccept(id: string): Promise<{ accepted: boolean }> {
  return apiFetchAuth<{ accepted: boolean }>(`/supplier/orders/${id}/accept`, {
    method: 'PUT',
  });
}

export async function supplierOrderUpdateStatus(
  id: string,
  status: string,
  payment?: {
    payment_confirmed?: boolean;
    payment_reference?: string;
    payment_collector?: 'supplier' | 'aurotap';
  }
): Promise<ApiOrder> {
  return apiFetchAuth<ApiOrder>(`/supplier/orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      status,
      ...payment,
    }),
  });
}

export async function supplierEarningsSummary(period = 'month'): Promise<SupplierEarningsSummary> {
  return apiFetchAuth<SupplierEarningsSummary>(`/supplier/earnings?period=${encodeURIComponent(period)}`);
}

export type SupplierRatingSummary = {
  average_rating: number;
  review_count: number;
};

export async function supplierRatingGet(): Promise<SupplierRatingSummary> {
  return apiFetchAuth<SupplierRatingSummary>('/supplier/rating');
}

/** @deprecated Prefer supplierEarningsSummary */
export async function supplierEarnings(period?: string): Promise<unknown> {
  return supplierEarningsSummary(period ?? 'month');
}

export async function supplierPayoutHistory(): Promise<unknown[]> {
  return apiFetchAuth<unknown[]>('/supplier/earnings/history');
}

export async function supplierPayoutRequest(body: { amount: number; method: 'upi' | 'bank'; upi_id?: string; bank_account?: string; ifsc?: string }): Promise<unknown> {
  return apiFetchAuth('/supplier/payouts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function technicianJobsList(params?: { status?: string }): Promise<ApiOrder[]> {
  const q = params?.status ? `?status=${encodeURIComponent(params.status)}` : '';
  return apiFetchAuth<ApiOrder[]>(`/technician/jobs${q}`);
}

export async function technicianJobReject(id: string): Promise<{ released: boolean; reassigned: boolean }> {
  return apiFetchAuth<{ released: boolean; reassigned: boolean }>(`/technician/jobs/${id}/reject`, {
    method: 'PUT',
  });
}

export async function technicianAvailabilityUpdate(body: {
  online: boolean;
  lat?: number | null;
  lng?: number | null;
}): Promise<{ id: string; is_online: boolean; availability_status: string; current_lat: number | null; current_lng: number | null; last_seen_at: string | null }> {
  return apiFetchAuth('/technician/availability', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function technicianJobAccept(id: string): Promise<ApiOrder> {
  return apiFetchAuth<ApiOrder>(`/technician/jobs/${id}/accept`, { method: 'PUT' });
}

export async function technicianJobUpdateStatus(
  id: string,
  status: string,
  payment?: {
    payment_confirmed?: boolean;
    payment_reference?: string;
  }
): Promise<ApiOrder> {
  return apiFetchAuth<ApiOrder>(`/technician/jobs/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      status,
      ...payment,
    }),
  });
}

export async function technicianEarnings(): Promise<unknown> {
  return apiFetchAuth('/technician/earnings');
}

/* ─── Legacy exports (pre–Phase 5 call sites) ─────────────────────── */

const USER_KEY = 'user';

export function setUser(user: User): void {
  safeSet(USER_KEY, JSON.stringify(user));
}

export function clearUser(): void {
  safeRemove(USER_KEY);
}

function safeParseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Best-effort user for legacy screens — prefers `user` key, else derives from session. */
export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  const direct = safeParseJSON<User>(safeGet(USER_KEY));
  if (direct?.full_name) return direct;

  const SESSION_KEY = 'aurowater_session';
  const raw = safeGet(SESSION_KEY);
  const s = safeParseJSON<{
    loggedIn?: boolean;
    name?: string;
    email?: string;
    role?: string;
    phone?: string;
    userId?: string;
  }>(raw);
  if (!s?.loggedIn || !s.email) return null;

  const roleUpper = (s.role ?? 'customer').toUpperCase();
  const roleMap: Record<string, User['role']> = {
    CUSTOMER: 'CUSTOMER',
    TECHNICIAN: 'TECHNICIAN',
    ADMIN: 'ADMIN',
    SUPPLIER: 'SUPPLIER',
  };

  return {
    id: s.userId ?? s.email,
    phone: s.phone ?? '',
    email: s.email,
    full_name: s.name ?? '',
    role: roleMap[roleUpper] ?? 'CUSTOMER',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

/** Sync wrapper — clears storage via `authLogout` pattern used by older pages */
export function logout(): void {
  void authLogout();
}

export async function verifyToken(): Promise<AuthToken> {
  const profile = await authMe();
  const token = (await getToken()) ?? '';
  const user: User = {
    id: profile.id,
    phone: profile.phone ?? '',
    email: profile.email ?? '',
    full_name: profile.full_name ?? '',
    role:
      profile.role === 'admin'
        ? 'ADMIN'
        : profile.role === 'technician'
          ? 'TECHNICIAN'
          : profile.role === 'supplier'
            ? 'SUPPLIER'
            : 'CUSTOMER',
    is_active: profile.is_active !== false,
    avatar_url: profile.avatar_url ?? undefined,
    created_at: new Date(profile.created_at),
    updated_at: new Date(profile.updated_at),
  };
  setUser(user);
  return { token, user, access_token: token, refresh_token: '' };
}

export const getAdminDashboard = adminDashboard;

/** Supports legacy positional args `(status, limit, offset)` used by admin dashboard. */
export async function getAdminOrders(
  arg1?: string | Record<string, string | undefined>,
  limit = 20,
  offset = 0
): Promise<unknown[]> {
  if (typeof arg1 === 'object' && arg1 !== null) {
    return adminOrders(arg1);
  }
  const status = typeof arg1 === 'string' ? arg1 : undefined;
  return adminOrders({
    status: status ?? undefined,
    limit: String(limit),
    offset: String(offset),
  });
}

export async function getAdminUsers(
  role?: string,
  limit = 20,
  offset = 0
): Promise<unknown[]> {
  return adminUsers({ role: role?.toLowerCase(), limit, offset });
}

export async function getPricingRules(): Promise<unknown[]> {
  return [];
}

export async function getOrders(
  status?: string,
  limit = 10,
  offset = 0
): Promise<
  {
    id: string;
    service_name: string;
    total_amount: number;
    status: string;
    created_at: string;
    time_slot?: string;
  }[]
> {
  const rows = await customerOrdersList({ status, limit, offset });
  return rows.map((o) => ({
    id: o.id,
    service_name: String(o.service_type_key ?? 'service'),
    total_amount: Number(o.total_amount),
    status: o.status,
    created_at: o.created_at,
    time_slot: o.time_slot ?? undefined,
  }));
}

export async function assignTechnician(order_id: string | number, technician_id: string | number): Promise<unknown> {
  return apiFetchAuth(`/admin/technicians/${String(technician_id)}/assign`, {
    method: 'PUT',
    body: JSON.stringify({ order_id: String(order_id) }),
  });
}

export async function getTechnicianJobs(status = 'PENDING'): Promise<unknown[]> {
  const q = `?status=${encodeURIComponent(status)}`;
  return apiFetchAuth<unknown[]>(`/technician/jobs${q}`);
}

export async function getTechnicianJobDetail(jobId: string | number): Promise<unknown> {
  return apiFetchAuth(`/technician/jobs/${String(jobId)}`);
}

export async function updateJobStatus(
  job_id: string | number,
  action: string,
  _notes?: string,
  verification?: {
    otp?: string;
    payment_confirmed?: boolean;
    payment_reference?: string;
  }
): Promise<unknown> {
  void _notes;
  const a = (action ?? '').toLowerCase();

  if (a.includes('accept')) {
    return apiFetchAuth(`/technician/jobs/${String(job_id)}/accept`, {
      method: 'PUT',
    });
  }

  let status = '';
  if (a.includes('complete')) status = 'COMPLETED';
  else if (a.includes('cancel')) status = 'CANCELLED';
  else if (a.includes('start') || a.includes('on_the_way') || a.includes('working')) status = 'IN_PROGRESS';

  if (!status) throw new ApiError('Unsupported technician job action', 400);

  return apiFetchAuth(`/technician/jobs/${String(job_id)}`, {
    method: 'PUT',
    body: JSON.stringify({ status, ...(verification ?? {}) }),
  });
}

export const createOrder = customerOrderCreate;

/** Namespaced facade for gradual migration from loose exports. */
export const api = {
  auth: {
    register: authRegister,
    login: authLogin,
    resendConfirmation: authResendConfirmation,
    logout: authLogout,
    me: authMe,
    updateMe: authUpdateMe,
    refresh: authRefresh,
  },
  settings: {
    get: getPublicSettings,
    update: adminSettingsPut,
  },
  services: { list: getServices },
  technicians: { list: getTechnicians },
  contact: { send: postContact },
  customer: {
    orders: {
      list: customerOrdersList,
      create: customerOrderCreate,
      get: customerOrderGet,
      cancel: customerOrderCancel,
    },
    stats: customerStats,
    addresses: {
      list: customerAddresses,
      create: customerAddressCreate,
      update: customerAddressUpdate,
      delete: customerAddressDelete,
      setDefault: (id: string) => customerAddressUpdate(id, { is_default: true }),
    },
    notifications: {
      list: customerNotificationsList,
      markRead: customerNotificationsMarkRead,
    },
    reviews: {
      create: (body: { order_id: string; stars: number; comment?: string }) =>
        customerReviewCreate({
          order_id: body.order_id,
          rating: body.stars,
          text: body.comment,
        }),
    },
  },
  admin: {
    dashboard: adminDashboard,
    orders: {
      list: adminOrders,
      listWithMeta: adminOrdersWithMeta,
      get: adminOrderGet,
      update: adminOrderUpdate,
    },
    finance: { get: adminFinance },
    technicians: {
      list: adminTechniciansList,
      assign: (technicianId: string, orderId: string) => assignTechnician(orderId, technicianId),
    },
    users: adminUsers,
    usersWithMeta: adminUsersWithMeta,
    userUpdate: adminUserUpdate,
    settings: { get: adminSettingsGet, put: adminSettingsPut },
  },
  supplier: {
    orders: { list: supplierOrdersList, accept: supplierOrderAccept, updateStatus: supplierOrderUpdateStatus },
    earnings: { summary: supplierEarningsSummary, history: supplierPayoutHistory },
    payouts: { request: supplierPayoutRequest },
  },
  technician: {
    earnings: { summary: technicianEarnings },
    jobs: {
      list: technicianJobsList,
      accept: technicianJobAccept,
      updateStatus: technicianJobUpdateStatus,
    },
  },
} as const;
