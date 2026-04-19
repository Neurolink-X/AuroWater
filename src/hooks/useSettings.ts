'use client';

/**
 * AuroWater — Platform Settings Hook
 * Place at: src/hooks/useSettings.ts  (or src/lib/hooks/useSettings.ts)
 *
 * Single source of truth for all platform configuration:
 *   • Pricing (cans, services, fees, commissions)
 *   • Contact / operational info
 *   • Price calculation utilities
 *   • Admin save support (PUT /api/admin/settings)
 *   • Smart cache: localStorage → stale-while-revalidate
 *   • Cross-tab sync via StorageEvent
 *   • Suspense-compatible with immediate fallback render
 */

import React from 'react';

/* ═══════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════ */

export type ServiceKey =
  | 'water_tanker'
  | 'ro_service'
  | 'plumbing'
  | 'borewell'
  | 'motor_pump'
  | 'tank_cleaning';

/** All rates that live in the [0, 1] range */
export interface CommissionRates {
  /** Platform cut on bulk orders  (e.g. 0.08 = 8%) */
  bulk:       number;
  /** Technician share of order total (e.g. 0.50 = 50%) */
  technician: number;
  /** Supplier share of order total  (e.g. 0.30 = 30%) */
  supplier:   number;
}

/** Everything needed to price any order */
export interface PricingConfig {
  default_can_price:      number;  // ₹ pay-as-go
  subscription_can_price: number;  // ₹ subscription rate
  bulk_can_price:         number;  // ₹ bulk rate (≥ bulk_threshold cans)
  bulk_threshold:         number;  // minimum qty for bulk pricing
  market_can_price:       number;  // competitor price for savings display
  service_base_prices:    Record<ServiceKey, number>;
  convenience_fee:        number;  // flat ₹ per order
  emergency_surcharge:    number;  // flat ₹ for emergency orders
  gst_rate:               number;  // 0–1, e.g. 0.18 = 18%
  commissions:            CommissionRates;
}

/** Operational / contact config */
export interface ContactConfig {
  support_email:    string;
  secondary_email:  string | null;
  phone_primary:    string;
  phone_secondary:  string | null;
  office_address:   string;
  working_hours:    string;
  brand_name:       string;
  whatsapp_enabled: boolean;
}

/** Full merged settings object */
export interface PlatformSettings extends PricingConfig, ContactConfig {}

/** Breakdown returned by calcOrderTotal() */
export interface OrderBreakdown {
  base:            number;
  convenience:     number;
  emergency:       number;
  subtotal:        number;  // base + convenience + emergency (pre-GST)
  gst:             number;
  total:           number;
  supplier_payout: number;
  platform_net:    number;
}

/** What the hook returns */
export interface UseSettingsReturn {
  settings:       PlatformSettings;
  loading:        boolean;
  /** null = ok; string = last error message (settings still usable via fallback) */
  error:          string | null;
  /** Force a network refresh */
  refresh:        () => Promise<void>;
  /** Optimistically patch local state + cache — no network round-trip */
  patchLocal:     (patch: Partial<PlatformSettings>) => void;
  /** Save to DB via PUT /api/admin/settings (admin-only) */
  saveToServer:   (patch: Partial<PlatformSettings>) => Promise<void>;
  saving:         boolean;
  /** WhatsApp deep-link for primary phone, or null */
  whatsappHref:   string | null;
  /** Full order cost breakdown */
  calcOrderTotal: (basePrice: number, isEmergency?: boolean) => OrderBreakdown;
  /** Savings % vs market_can_price */
  savingsPct:     (pricePerCan: number) => number;
  /** Display-formatted GST rate, e.g. "18%" */
  gstLabel:       string;
}

/* ═══════════════════════════════════════════════════════════════
   DEFAULTS  — always-safe fallback, never breaks the UI
═══════════════════════════════════════════════════════════════ */

export const DEFAULT_SETTINGS: PlatformSettings = {
  /* Pricing */
  default_can_price:      12,
  subscription_can_price: 10,
  bulk_can_price:         9,
  bulk_threshold:         50,
  market_can_price:       20,
  service_base_prices: {
    water_tanker:  299,
    ro_service:    199,
    plumbing:      149,
    borewell:      499,
    motor_pump:    249,
    tank_cleaning: 349,
  },
  convenience_fee:     29,
  emergency_surcharge: 199,
  gst_rate:            0.18,
  commissions: {
    bulk:       0.08,
    technician: 0.50,
    supplier:   0.30,
  },
  /* Contact */
  support_email:    'support.aurotap@gmail.com',
  secondary_email:  'aurotap@gmail.com',
  phone_primary:    '9889305803',
  phone_secondary:  null,
  office_address:   'Kanpur, Uttar Pradesh',
  working_hours:    '09:00–21:00 IST',
  brand_name:       'Auro Water',
  whatsapp_enabled: true,
};

/* ═══════════════════════════════════════════════════════════════
   CACHE
═══════════════════════════════════════════════════════════════ */

const CACHE_KEY        = 'aw_settings_v3';
const CACHE_TS_KEY     = 'aw_settings_v3_ts';
const DEFAULT_STALE_MS = 15 * 60 * 1000; // 15 min

/* ═══════════════════════════════════════════════════════════════
   PURE HELPERS  (no React deps — independently testable)
═══════════════════════════════════════════════════════════════ */

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

function clamp01(n: unknown): number {
  const num = Number(n);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(1, num));
}

function safePositive(n: unknown, fallback: number): number {
  const num = Number(n);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}

function normalizePhone(phone: string | null | undefined): string | null {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits.length >= 10 ? digits : null;
}

/**
 * Merges a partial raw API/cache payload with DEFAULT_SETTINGS.
 * Handles two storage conventions for rate fields:
 *   • Decimal  (0.18) → used directly
 *   • Integer  (18)   → divided by 100 automatically
 */
export function mergeSettings(
  raw: Partial<
    PlatformSettings & {
      /** Legacy flat commission keys from old API shape */
      bulk_commission?:            number;
      technician_commission_rate?: number;
      supplier_commission_rate?:   number;
    }
  > | null | undefined
): PlatformSettings {
  if (!raw) {
    return {
      ...DEFAULT_SETTINGS,
      commissions:         { ...DEFAULT_SETTINGS.commissions },
      service_base_prices: { ...DEFAULT_SETTINGS.service_base_prices },
    };
  }

  /** Convert stored value to a 0–1 rate — handles both 0.18 and 18 */
  const toRate = (v: unknown): number => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return n > 1 ? clamp01(n / 100) : clamp01(n);
  };

  const commissions: CommissionRates = {
    bulk:       toRate(raw.commissions?.bulk       ?? raw.bulk_commission),
    technician: toRate(raw.commissions?.technician ?? raw.technician_commission_rate),
    supplier:   toRate(raw.commissions?.supplier   ?? raw.supplier_commission_rate),
  };

  // If any rate parsed to 0 (e.g. missing field), fall back to default
  if (!commissions.bulk)       commissions.bulk       = DEFAULT_SETTINGS.commissions.bulk;
  if (!commissions.technician) commissions.technician = DEFAULT_SETTINGS.commissions.technician;
  if (!commissions.supplier)   commissions.supplier   = DEFAULT_SETTINGS.commissions.supplier;

  const gstRate = toRate(raw.gst_rate) || DEFAULT_SETTINGS.gst_rate;

  return {
    default_can_price:      safePositive(raw.default_can_price,      DEFAULT_SETTINGS.default_can_price),
    subscription_can_price: safePositive(raw.subscription_can_price, DEFAULT_SETTINGS.subscription_can_price),
    bulk_can_price:         safePositive(raw.bulk_can_price,         DEFAULT_SETTINGS.bulk_can_price),
    bulk_threshold:         safePositive(raw.bulk_threshold,         DEFAULT_SETTINGS.bulk_threshold),
    market_can_price:       safePositive(raw.market_can_price,       DEFAULT_SETTINGS.market_can_price),
    convenience_fee:        safePositive(raw.convenience_fee,        DEFAULT_SETTINGS.convenience_fee),
    emergency_surcharge:    safePositive(raw.emergency_surcharge,    DEFAULT_SETTINGS.emergency_surcharge),
    gst_rate: gstRate,
    commissions,
    service_base_prices: {
      ...DEFAULT_SETTINGS.service_base_prices,
      ...(raw.service_base_prices ?? {}),
    },
    support_email:    raw.support_email    ?? DEFAULT_SETTINGS.support_email,
    secondary_email:  raw.secondary_email  ?? DEFAULT_SETTINGS.secondary_email,
    phone_primary:    raw.phone_primary    ?? DEFAULT_SETTINGS.phone_primary,
    phone_secondary:  raw.phone_secondary  ?? DEFAULT_SETTINGS.phone_secondary,
    office_address:   raw.office_address   ?? DEFAULT_SETTINGS.office_address,
    working_hours:    raw.working_hours    ?? DEFAULT_SETTINGS.working_hours,
    brand_name:       raw.brand_name       ?? DEFAULT_SETTINGS.brand_name,
    whatsapp_enabled: raw.whatsapp_enabled ?? DEFAULT_SETTINGS.whatsapp_enabled,
  };
}

/* ═══════════════════════════════════════════════════════════════
   API LAYER
═══════════════════════════════════════════════════════════════ */

type ApiEnvelope<T> = { success?: boolean; data?: T; error?: string };

async function apiFetchSettings(
  signal?: AbortSignal
): Promise<Partial<PlatformSettings>> {
  const res = await fetch('/api/settings', { cache: 'no-store', signal });
  if (!res.ok) throw new Error(`Settings API ${res.status}: ${res.statusText}`);
  const json = (await res.json()) as ApiEnvelope<Partial<PlatformSettings>>;
  if (json?.success === false) throw new Error(json.error ?? 'API returned success:false');
  // Support both { data: {...} } and flat response shapes
  return json?.data ?? (json as Partial<PlatformSettings>);
}

async function apiSaveSettings(
  patch: Partial<PlatformSettings>,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch('/api/admin/settings', {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(settingsToApiPayload(patch)),
    signal,
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(json?.error ?? `Save failed: HTTP ${res.status}`);
  }
}

/* ═══════════════════════════════════════════════════════════════
   CACHE HELPERS
═══════════════════════════════════════════════════════════════ */

function readCache(): { settings: Partial<PlatformSettings> | null; ts: number } {
  if (typeof window === 'undefined') return { settings: null, ts: 0 };
  return {
    settings: safeParse<Partial<PlatformSettings>>(localStorage.getItem(CACHE_KEY)),
    ts:       Number(localStorage.getItem(CACHE_TS_KEY) ?? '0'),
  };
}

function writeCache(s: PlatformSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY,    JSON.stringify(s));
    localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
  } catch {
    // Quota exceeded — silently skip
  }
}

/* ═══════════════════════════════════════════════════════════════
   HOOK
═══════════════════════════════════════════════════════════════ */

export function useSettings(staleMs: number = DEFAULT_STALE_MS): UseSettingsReturn {
  /**
   * Initialise synchronously from cache so the first render already has
   * real data (avoids flash of fallback values on page load).
   */
  const [settings, setSettings] = React.useState<PlatformSettings>(() => {
    const { settings: cached, ts } = readCache();
    const fresh = !!cached && Number.isFinite(ts) && Date.now() - ts < staleMs;
    return fresh ? mergeSettings(cached) : DEFAULT_SETTINGS;
  });

  const [loading, setLoading] = React.useState(true);
  const [saving,  setSaving]  = React.useState(false);
  const [error,   setError]   = React.useState<string | null>(null);

  const abortRef = React.useRef<AbortController | null>(null);

  /* ── Network refresh ── */
  const refresh = React.useCallback(async (): Promise<void> => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    try {
      const raw  = await apiFetchSettings(ctrl.signal);
      const next = mergeSettings(raw);
      if (!ctrl.signal.aborted) {
        setSettings(next);
        writeCache(next);
      }
    } catch (e: unknown) {
      if (ctrl.signal.aborted) return;
      setError(e instanceof Error ? e.message : 'Failed to load settings');
      // Keep current state — UI never breaks
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  /* ── Mount: serve cache if fresh; otherwise fetch ── */
  React.useEffect(() => {
    const { settings: cached, ts } = readCache();
    const fresh = !!cached && Number.isFinite(ts) && Date.now() - ts < staleMs;

    if (fresh) {
      setSettings(mergeSettings(cached));
      setLoading(false);
      return;
    }
    refresh();

    return () => { abortRef.current?.abort(); };
  }, [refresh, staleMs]);

  /* ── Cross-tab sync ── */
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent): void => {
      if (e.key !== CACHE_KEY || !e.newValue) return;
      const incoming = safeParse<Partial<PlatformSettings>>(e.newValue);
      if (incoming) setSettings(mergeSettings(incoming));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /* ── Optimistic local patch ── */
  const patchLocal = React.useCallback(
    (patch: Partial<PlatformSettings>): void => {
      setSettings(prev => {
        const next = mergeSettings({ ...prev, ...patch });
        writeCache(next);
        return next;
      });
    },
    []
  );

  /* ── Admin: save to server ── */
  const saveToServer = React.useCallback(
    async (patch: Partial<PlatformSettings>): Promise<void> => {
      setSaving(true);
      setError(null);
      // Optimistic — update UI immediately
      patchLocal(patch);
      try {
        await apiSaveSettings(patch);
        // Re-fetch to confirm server state
        await refresh();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to save settings';
        setError(msg);
        throw new Error(msg); // let caller show a toast
      } finally {
        setSaving(false);
      }
    },
    [patchLocal, refresh]
  );

  /* ── Derived: WhatsApp link ── */
  const whatsappHref = React.useMemo((): string | null => {
    if (!settings.whatsapp_enabled) return null;
    const n = normalizePhone(settings.phone_primary);
    return n ? `https://wa.me/${n}` : null;
  }, [settings.phone_primary, settings.whatsapp_enabled]);

  /* ── Derived: GST label ── */
  const gstLabel = React.useMemo(
    () => `${Math.round(settings.gst_rate * 100)}%`,
    [settings.gst_rate]
  );

  /* ── Price calculator ── */
  const calcOrderTotal = React.useCallback(
    (basePrice: number, isEmergency = false): OrderBreakdown => {
      const base        = Math.round(Math.max(0, basePrice));
      const convenience = Math.round(settings.convenience_fee);
      const emergency   = isEmergency ? Math.round(settings.emergency_surcharge) : 0;
      const subtotal    = base + convenience + emergency;
      const gst         = Math.round(subtotal * settings.gst_rate);
      const total       = subtotal + gst;
      const supplier_payout = Math.round(total * settings.commissions.supplier);
      const platform_net    = total - supplier_payout;
      return { base, convenience, emergency, subtotal, gst, total, supplier_payout, platform_net };
    },
    [settings.convenience_fee, settings.emergency_surcharge, settings.gst_rate, settings.commissions.supplier]
  );

  /* ── Savings % vs market price ── */
  const savingsPct = React.useCallback(
    (pricePerCan: number): number => {
      const market = settings.market_can_price;
      if (!market || market <= 0) return 0;
      return Math.max(0, Math.round(((market - pricePerCan) / market) * 100));
    },
    [settings.market_can_price]
  );

  return {
    settings,
    loading,
    error,
    refresh,
    patchLocal,
    saveToServer,
    saving,
    whatsappHref,
    calcOrderTotal,
    savingsPct,
    gstLabel,
  };
}

/* ═══════════════════════════════════════════════════════════════
   CONTEXT  — share one fetch across many components
═══════════════════════════════════════════════════════════════ */

const SettingsContext = React.createContext<UseSettingsReturn | null>(null);

/**
 * Wrap your layout or page with <SettingsProvider> so every child
 * shares a single fetch and a single cache slot.
 *
 * @example
 * // app/layout.tsx
 * export default function RootLayout({ children }) {
 *   return <SettingsProvider>{children}</SettingsProvider>;
 * }
 */
export function SettingsProvider({
  children,
  staleMs,
}: {
  children: React.ReactNode;
  staleMs?: number;
}): React.ReactElement {
  const value = useSettings(staleMs);
  return React.createElement(SettingsContext.Provider, { value }, children);
}

/**
 * Consume settings without an extra fetch.
 * Must be inside <SettingsProvider>.
 *
 * @example
 * const { settings, calcOrderTotal, gstLabel } = useSettingsContext();
 */
export function useSettingsContext(): UseSettingsReturn {
  const ctx = React.useContext(SettingsContext);
  if (!ctx) {
    throw new Error(
      'useSettingsContext must be called inside <SettingsProvider>. ' +
      'Either wrap your layout, or call useSettings() directly.'
    );
  }
  return ctx;
}

/* ═══════════════════════════════════════════════════════════════
   STANDALONE UTILITIES  (no React — import freely anywhere)
═══════════════════════════════════════════════════════════════ */

/**
 * Format a number as an Indian-locale ₹ string.
 * @example inr(12345) → "₹12,345"
 */
export function inr(amount: number): string {
  return '₹' + Math.round(Number.isFinite(amount) ? amount : 0).toLocaleString('en-IN');
}

/**
 * Compact ₹ format for dashboards.
 * @example inrK(150000) → "₹1.5L"   inrK(12500) → "₹12.5K"
 */
export function inrK(amount: number): string {
  const v = Math.round(Number.isFinite(amount) ? amount : 0);
  if (v >= 10_00_000) return `₹${(v / 10_00_000).toFixed(1)}Cr`;
  if (v >=  1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
  if (v >=      1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v}`;
}

/**
 * Build a WhatsApp deep-link. Handles 10-digit Indian numbers.
 * @example buildWhatsappHref('9889305803', 'Hello') → "https://wa.me/919889305803?text=Hello"
 */
export function buildWhatsappHref(
  phone: string | null | undefined,
  message?: string
): string | null {
  const n = normalizePhone(phone);
  if (!n) return null;
  return message ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : `https://wa.me/${n}`;
}

/**
 * Which per-can price applies for a given order quantity?
 */
export function canPriceForQty(
  qty: number,
  s: Pick<PlatformSettings, 'default_can_price' | 'bulk_can_price' | 'bulk_threshold'>
): number {
  return qty >= s.bulk_threshold ? s.bulk_can_price : s.default_can_price;
}

/**
 * Serialize a PlatformSettings patch to the flat key-value shape
 * expected by PUT /api/admin/settings.
 * Rates are converted to integer percentages for DB storage (0.18 → 18).
 */
export function settingsToApiPayload(
  settings: Partial<PlatformSettings>
): Record<string, string | number> {
  const out: Record<string, string | number> = {};

  const numeric: (keyof PricingConfig)[] = [
    'default_can_price', 'subscription_can_price', 'bulk_can_price',
    'bulk_threshold', 'market_can_price', 'convenience_fee', 'emergency_surcharge',
  ];
  for (const k of numeric) {
    if (settings[k] !== undefined) out[k] = Number(settings[k]);
  }

  const strings: (keyof ContactConfig)[] = [
    'support_email', 'secondary_email', 'phone_primary', 'phone_secondary',
    'office_address', 'working_hours', 'brand_name',
  ];
  for (const k of strings) {
    if (settings[k] !== undefined) out[k] = String(settings[k] ?? '');
  }

  // Store rates as integer percentages in DB
  if (settings.gst_rate !== undefined) {
    out.gst_rate = Math.round(settings.gst_rate * 100);
  }
  if (settings.commissions) {
    const c = settings.commissions;
    if (c.bulk       !== undefined) out.bulk_commission            = Math.round(c.bulk       * 100);
    if (c.technician !== undefined) out.technician_commission_rate = Math.round(c.technician * 100);
    if (c.supplier   !== undefined) out.supplier_commission_rate   = Math.round(c.supplier   * 100);
  }
  if (settings.service_base_prices) {
    out.service_base_prices = JSON.stringify(settings.service_base_prices);
  }
  if (settings.whatsapp_enabled !== undefined) {
    out.whatsapp_enabled = settings.whatsapp_enabled ? '1' : '0';
  }

  return out;
}

/* ═══════════════════════════════════════════════════════════════
   LEGACY COMPATIBILITY  — keeps old import paths working
═══════════════════════════════════════════════════════════════ */

/** @deprecated Rename to PlatformSettings */
export type { PlatformSettings as AppSettings };

/** @deprecated Use DEFAULT_SETTINGS */
export const SETTINGS_DEFAULTS = DEFAULT_SETTINGS;

/** @deprecated Renamed to patchLocal; use saveToServer for DB writes */
export const saveLocalSettings = (
  hook: UseSettingsReturn,
  patch: Partial<PlatformSettings>
): void => hook.patchLocal(patch);