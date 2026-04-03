'use client';

import React from 'react';

export type ServiceKey =
  | 'water_tanker'
  | 'ro_service'
  | 'plumbing'
  | 'borewell'
  | 'motor_pump'
  | 'tank_cleaning';

export type PlatformSettings = {
  default_can_price: number;
  bulk_commission: number; // 0..1
  convenience_fee: number;
  gst_rate: number; // 0..1
  emergency_surcharge: number;
  technician_commission_rate: number; // 0..1
  supplier_commission_rate: number; // 0..1
  service_base_prices: Record<ServiceKey, number>;
  support_email: string;
  secondary_email: string | null;
  phone_primary: string;
  phone_secondary: string | null;
  office_address: string;
  working_hours: string;
};

const FALLBACK_SETTINGS: PlatformSettings = {
  default_can_price: 12,
  bulk_commission: 0.05,
  convenience_fee: 29,
  gst_rate: 0.18,
  emergency_surcharge: 199,
  technician_commission_rate: 0.5,
  supplier_commission_rate: 0.3,
  service_base_prices: {
    water_tanker: 299,
    ro_service: 199,
    plumbing: 149,
    borewell: 499,
    motor_pump: 249,
    tank_cleaning: 349,
  },
  support_email: 'support.aurotap@gmail.com',
  secondary_email: 'aurotap@gmail.com',
  phone_primary: '9889305803',
  phone_secondary: null,
  office_address: 'Auro Water / AuroTap',
  working_hours: '09:00–21:00 IST',
};

const CACHE_KEY = 'aw_platform_settings';
const CACHE_TS_KEY = 'aw_platform_settings_ts';

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function normalizePhoneForWhatsapp(phone: string | null | undefined): string | null {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function mergeSettings(raw: Partial<PlatformSettings> | null | undefined): PlatformSettings {
  const merged: PlatformSettings = {
    ...FALLBACK_SETTINGS,
    ...(raw ?? {}),
    service_base_prices: {
      ...FALLBACK_SETTINGS.service_base_prices,
      ...(raw?.service_base_prices ?? {}),
    },
  };

  merged.bulk_commission = clamp01(Number(merged.bulk_commission));
  merged.gst_rate = clamp01(Number(merged.gst_rate));
  merged.technician_commission_rate = clamp01(Number(merged.technician_commission_rate));
  merged.supplier_commission_rate = clamp01(Number(merged.supplier_commission_rate));
  merged.default_can_price = Number.isFinite(Number(merged.default_can_price)) ? Number(merged.default_can_price) : FALLBACK_SETTINGS.default_can_price;
  merged.convenience_fee = Number.isFinite(Number(merged.convenience_fee)) ? Number(merged.convenience_fee) : FALLBACK_SETTINGS.convenience_fee;
  merged.emergency_surcharge = Number.isFinite(Number(merged.emergency_surcharge)) ? Number(merged.emergency_surcharge) : FALLBACK_SETTINGS.emergency_surcharge;

  return merged;
}

type ApiEnvelope<T> = { success?: boolean; data?: T; error?: string };

async function fetchPublicSettings(): Promise<Partial<PlatformSettings> | null> {
  const res = await fetch('/api/settings', { cache: 'no-store' });
  const json = (await res.json()) as ApiEnvelope<{
    support_email?: string;
    secondary_email?: string | null;
    phone_primary?: string;
    phone_secondary?: string | null;
    office_address?: string;
    working_hours?: string;
  }>;
  if (!json?.success || !json.data) return null;
  return {
    support_email: json.data.support_email ?? FALLBACK_SETTINGS.support_email,
    secondary_email: json.data.secondary_email ?? FALLBACK_SETTINGS.secondary_email,
    phone_primary: json.data.phone_primary ?? FALLBACK_SETTINGS.phone_primary,
    phone_secondary: json.data.phone_secondary ?? FALLBACK_SETTINGS.phone_secondary,
    office_address: json.data.office_address ?? FALLBACK_SETTINGS.office_address,
    working_hours: json.data.working_hours ?? FALLBACK_SETTINGS.working_hours,
  };
}

export function useSettings(staleMs = 15 * 60 * 1000) {
  const [settings, setSettings] = React.useState<PlatformSettings>(FALLBACK_SETTINGS);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const writeCache = React.useCallback((next: PlatformSettings) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
    } catch {
      // ignore cache write failures
    }
  }, []);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fromPublic = await fetchPublicSettings();
      const next = mergeSettings(fromPublic ?? safeParse<Partial<PlatformSettings>>(typeof window !== 'undefined' ? localStorage.getItem(CACHE_KEY) : null));
      setSettings(next);
      writeCache(next);
    } catch (e: unknown) {
      const fallback = mergeSettings(safeParse<Partial<PlatformSettings>>(typeof window !== 'undefined' ? localStorage.getItem(CACHE_KEY) : null));
      setSettings(fallback);
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [writeCache]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const cached = safeParse<PlatformSettings>(localStorage.getItem(CACHE_KEY));
    const tsRaw = localStorage.getItem(CACHE_TS_KEY);
    const ts = tsRaw ? Number(tsRaw) : 0;
    const fresh = cached && Number.isFinite(ts) && Date.now() - ts < staleMs;
    if (fresh) {
      setSettings(mergeSettings(cached));
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh, staleMs]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== CACHE_KEY) return;
      const incoming = mergeSettings(safeParse<Partial<PlatformSettings>>(e.newValue));
      setSettings(incoming);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const whatsappHref = React.useMemo(() => {
    const normalized = normalizePhoneForWhatsapp(settings.phone_primary);
    return normalized ? `https://wa.me/${normalized}` : null;
  }, [settings.phone_primary]);

  const saveLocalSettings = React.useCallback((patch: Partial<PlatformSettings>) => {
    const next = mergeSettings({ ...settings, ...patch });
    setSettings(next);
    writeCache(next);
  }, [settings, writeCache]);

  return { settings, loading, error, refresh, saveLocalSettings, whatsappHref };
}

