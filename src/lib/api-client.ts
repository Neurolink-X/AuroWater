import type { ProfileRow } from '@/lib/db/types';
import type { AuthToken, User } from '@/types';
import { clearAuthGateCookies } from '@/lib/auth/client-gate-cookies';
import { createClient } from '@/utils/supabase/client';
import { safeGet, safeRemove, safeSet } from '@/lib/storage';
import { getUserErrorMessage } from '@/lib/errors/app-error';

/** Same-origin App Router API. Do not use NEXT_PUBLIC_API_URL (breaks production). */
const API_BASE = '/api';

const TOKEN_KEY = 'auth_token';

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

    if (!session) {
      const { data: refreshed } =
        await supabase.auth.refreshSession();

      return (
        refreshed.session?.access_token ??
        null
      );
    }

    const expiresAtMs =
      Number(session.expires_at ?? 0) * 1000;

    const refreshBeforeMs =
      60 * 1000;

    if (
      !expiresAtMs ||
      expiresAtMs - Date.now() <= refreshBeforeMs
    ) {
      const { data: refreshed } =
        await supabase.auth.refreshSession();

      return (
        refreshed.session?.access_token ??
        null
      );
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
async function fetchWithRetryParse(
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

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { res, json } = await fetchWithRetryParse(path, init);

  if (!res.ok || json.success === false) {
    if (res.status === 401) {
      const onAuthEntry =
        typeof window !== 'undefined' &&
        (window.location.pathname.startsWith('/auth/login') ||
          window.location.pathname.startsWith('/auth/register'));
      /** Failed login/register must not hard-redirect (breaks error UI + resend flows). */
      if (!onAuthEntry) {
        clearToken();
        clearUser();
        if (typeof window !== 'undefined') {
          const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search || ''}`);
          window.location.assign(`/auth/login?returnTo=${returnTo}`);
        }
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
  const token = await getToken();
  if (!token) {
    throw new ApiError('No authentication token found', 401);
  }
  return apiFetch<T>(path, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
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
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch {
    /* ignore */
  }
  clearToken();
  clearUser();
  clearAuthGateCookies();
  safeRemove('aurowater_session');
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
  subject?: string;
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
  accepted_at?: string | null;
  assigned_at?: string | null;
  dispatched_at?: string | null;
  completed_at?: string | null;
  service_type_id: number;
  service_type_key?: string | null;
  sub_option_key?: string | null;
  address_snapshot?: Record<string, unknown> | null;
  scheduled_date?: string | null;
  time_slot?: string | null;
  is_emergency?: boolean;
  total_amount: number | string;
  supplier_payout?: number | string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
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

export async function adminFinance(range?: string): Promise<unknown> {
  const q = range ? `?range=${encodeURIComponent(range)}` : '';
  return apiFetchAuth(`/admin/finance${q}`);
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
  order_count: number | null;
  total_spent: number | null;
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

export async function supplierOrdersList(params?: { status?: string }): Promise<ApiOrder[]> {
  const q = params?.status ? `?status=${encodeURIComponent(params.status)}` : '';
  return apiFetchAuth<ApiOrder[]>(`/supplier/orders${q}`);
}

export async function supplierOrderAccept(id: string): Promise<{ accepted: boolean; reserved_qty: number }> {
  return apiFetchAuth<{ accepted: boolean; reserved_qty: number }>(`/supplier/orders/${id}/accept`, {
    method: 'PUT',
  });
}

export async function supplierOrderReject(id: string, reason?: string): Promise<{ released: boolean; reassigned: boolean }> {
  return apiFetchAuth<{ released: boolean; reassigned: boolean }>(`/supplier/orders/${id}/reject`, {
    method: 'PUT',
    body: JSON.stringify({ reason: reason ?? '' }),
  });
}

export async function supplierOrderUpdateStatus(id: string, status: 'IN_PROGRESS' | 'COMPLETED'): Promise<ApiOrder> {
  return apiFetchAuth<ApiOrder>(`/supplier/orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export type SupplierSettings = {
  user_id: string;
  is_online: boolean;
  price_per_can: number;
  service_radius: number;
  zone_radius_km?: number;
  auto_accept?: boolean;
  upi_id?: string | null;
  bank_account?: string | null;
  ifsc?: string | null;
  qr_code_url?: string | null;
};

export async function supplierSettingsGet(): Promise<SupplierSettings | null> {
  return apiFetchAuth<SupplierSettings | null>('/supplier/settings');
}

export async function supplierSettingsUpdate(
  patch: Partial<Pick<SupplierSettings, 'is_online' | 'price_per_can' | 'service_radius' | 'zone_radius_km' | 'auto_accept' | 'upi_id' | 'bank_account' | 'ifsc' | 'qr_code_url'>>
): Promise<SupplierSettings> {
  return apiFetchAuth<SupplierSettings>('/supplier/settings', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

export type SupplierStock = {
  supplier_id: string;
  cans_available: number;
  reserved_cans?: number;
  low_stock_alert: number;
};

export async function supplierStockGet(): Promise<SupplierStock> {
  return apiFetchAuth<SupplierStock>('/supplier/stock');
}

export async function supplierStockUpdate(
  patch: { cans_available?: number; low_stock_alert?: number }
): Promise<SupplierStock> {
  return apiFetchAuth<SupplierStock>('/supplier/stock', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

export type SupplierProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  pincode: string | null;
  aurotap_id: string | null;
  business_name: string | null;
  gstin: string | null;
  service_cities: string[];
  role: string;
  status: string;
  is_active: boolean;
};

export async function supplierProfileGet(): Promise<SupplierProfile> {
  return apiFetchAuth<SupplierProfile>('/supplier/profile');
}

export async function supplierProfileUpdate(
  patch: {
    business_name?: string;
    gstin?: string;
    service_cities?: string[];
  }
): Promise<SupplierProfile> {
  return apiFetchAuth<SupplierProfile>('/supplier/profile', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

export type SupplierFleetItem = {
  id: string;
  supplier_id: string;
  vehicle_number: string;
  vehicle_name: string | null;
  vehicle_type: string;
  capacity_litres: number;
  driver_name: string | null;
  price_per_trip: number | string | null;
  status: 'available' | 'in_use' | 'maintenance' | 'inactive';
  created_at: string;
  updated_at: string;
};

export async function supplierFleetList(): Promise<SupplierFleetItem[]> {
  return apiFetchAuth<SupplierFleetItem[]>('/supplier/fleet');
}

export async function supplierFleetCreate(body: {
  vehicle_number: string;
  vehicle_name?: string;
  vehicle_type?: string;
  capacity_litres: number;
  driver_name?: string;
  price_per_trip?: number;
}): Promise<SupplierFleetItem> {
  return apiFetchAuth<SupplierFleetItem>('/supplier/fleet', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function supplierFleetUpdate(
  id: string,
  patch: Partial<Pick<SupplierFleetItem, 'vehicle_number' | 'vehicle_name' | 'vehicle_type' | 'capacity_litres' | 'driver_name' | 'price_per_trip' | 'status'>>
): Promise<SupplierFleetItem> {
  return apiFetchAuth<SupplierFleetItem>(`/supplier/fleet/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

export async function supplierFleetDelete(id: string): Promise<{ deleted: boolean; id: string }> {
  return apiFetchAuth<{ deleted: boolean; id: string }>(`/supplier/fleet/${id}`, {
    method: 'DELETE',
  });
}

export type SupplierDocument = {
  id: string;
  supplier_id: string;
  document_type: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  status: 'submitted' | 'verified' | 'rejected';
  rejection_reason: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function supplierDocumentsList(): Promise<SupplierDocument[]> {
  return apiFetchAuth<SupplierDocument[]>('/supplier/documents');
}

export async function supplierDocumentUpload(documentType: string, file: File): Promise<SupplierDocument> {
  const form = new FormData();
  form.set('document_type', documentType);
  form.set('file', file);
  return apiFetchAuth<SupplierDocument>('/supplier/documents', {
    method: 'POST',
    body: form,
  });
}

export async function supplierDocumentUrl(id: string): Promise<SupplierDocument & { url: string }> {
  return apiFetchAuth<SupplierDocument & { url: string }>(`/supplier/documents/${id}`);
}

export async function supplierDocumentDelete(id: string): Promise<{ deleted: boolean }> {
  return apiFetchAuth<{ deleted: boolean }>(`/supplier/documents/${id}`, {
    method: 'DELETE',
  });
}


export async function supplierEarningsSummary(period = 'month'): Promise<SupplierEarningsSummary> {
  return apiFetchAuth<SupplierEarningsSummary>(`/supplier/earnings?period=${encodeURIComponent(period)}`);
}

/** @deprecated Prefer supplierEarningsSummary */
export async function supplierEarnings(period?: string): Promise<unknown> {
  return supplierEarningsSummary(period ?? 'month');
}

export async function supplierPayoutHistory(): Promise<unknown[]> {
  return apiFetchAuth<unknown[]>('/supplier/earnings/history');
}

export async function supplierPayoutRequest(body: { amount: number; notes?: string }): Promise<unknown> {
  return apiFetchAuth('/supplier/payouts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function technicianJobsList(params?: { status?: string }): Promise<ApiOrder[]> {
  const q = params?.status ? `?status=${encodeURIComponent(params.status)}` : '';
  return apiFetchAuth<ApiOrder[]>(`/technician/jobs${q}`);
}

export async function technicianJobAccept(id: string): Promise<ApiOrder> {
  return apiFetchAuth<ApiOrder>(`/technician/jobs/${id}/accept`, { method: 'PUT' });
}

export async function technicianJobUpdateStatus(id: string, status: string): Promise<ApiOrder> {
  return apiFetchAuth<ApiOrder>(`/technician/jobs/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
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
  _notes?: string
): Promise<unknown> {
  void _notes;
  const a = (action ?? '').toLowerCase();
  let status = 'IN_PROGRESS';
  if (a.includes('complete')) status = 'COMPLETED';
  else if (a.includes('cancel')) status = 'CANCELLED';
  else if (a.includes('accept') || a.includes('start')) status = 'IN_PROGRESS';

  return apiFetchAuth(`/technician/jobs/${String(job_id)}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
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
    orders: { list: supplierOrdersList, updateStatus: supplierOrderUpdateStatus },
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
