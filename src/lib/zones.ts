/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from '@/utils/supabase/server';
import { getServiceZone, isCityServed, OUT_OF_ZONE_MESSAGE } from '@/lib/geo';

/**
 * City -> Zone -> Address -> Serviceability.
 *
 * Rules
 *  - A city WITHOUT zones configured keeps the legacy city/geofence check (nothing breaks).
 *  - A city WITH zones is enforced strictly: the address must fall in a zone
 *    (by pincode, then by coordinates, then the city's "Other areas" catch-all).
 *  - AVAILABLE and LIMITED zones accept bookings; TEMPORARILY_UNAVAILABLE and COMING_SOON do not.
 *  - A zone may restrict which services it offers (services = null means all).
 */

export const ZONE_STATUSES = ['AVAILABLE', 'LIMITED', 'TEMPORARILY_UNAVAILABLE', 'COMING_SOON'] as const;
export type ZoneStatus = (typeof ZONE_STATUSES)[number];

const BOOKABLE: ZoneStatus[] = ['AVAILABLE', 'LIMITED'];

export type ZoneRow = {
  id: string;
  city: string;
  name: string;
  slug: string;
  status: ZoneStatus;
  pincodes: string[] | null;
  center_lat: number | null;
  center_lng: number | null;
  radius_km: number | null;
  services: string[] | null;
  is_catch_all: boolean;
};

export type Serviceability = {
  serviceable: boolean;
  status: ZoneStatus | 'NO_ZONES' | 'NO_MATCH';
  zone: { id: string; name: string; city: string } | null;
  message: string;
  services: string[] | null;
};

function coord(v: unknown): number {
  if (v === null || v === undefined || v === '') return NaN;
  return Number(v);
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const STATUS_MESSAGE: Record<ZoneStatus, (zone: string) => string> = {
  AVAILABLE: (z) => `AuroWater is available in ${z}.`,
  LIMITED: () => 'Limited availability in your area. Delivery may take a little longer.',
  TEMPORARILY_UNAVAILABLE: (z) => `Service is temporarily unavailable in ${z}. Please try again later.`,
  COMING_SOON: (z) => `AuroWater is coming soon to ${z}. Join the waitlist and we will tell you first.`,
};

/** Decide if an address can be served, and by which zone. Never throws. */
export async function resolveServiceability(
  addr: Record<string, unknown>,
  serviceKey?: string
): Promise<Serviceability> {
  const city = String(addr.city ?? '').trim();
  const pincode = String(addr.pincode ?? '').trim();
  const lat = coord(addr.lat);
  const lng = coord(addr.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  const legacy = (): Serviceability => {
    const ok = hasCoords ? getServiceZone(lat, lng) !== null : isCityServed(city);
    return {
      serviceable: ok,
      status: 'NO_ZONES',
      zone: null,
      message: ok ? 'AuroWater is available in your area.' : OUT_OF_ZONE_MESSAGE,
      services: null,
    };
  };

  let zones: ZoneRow[] = [];
  try {
    const db: any = createServiceClient();
    const { data, error } = await db
      .from('service_zones')
      .select('*')
      .ilike('city', city.replace(/[%_]/g, (m) => `\\${m}`));
    if (error) return legacy(); // zones table not created yet
    zones = (data ?? []) as ZoneRow[];
  } catch (e) {
    console.error('[zones] lookup failed, using legacy check:', e);
    return legacy();
  }

  if (!zones.length) return legacy();

  // 1) pincode, 2) nearest zone by coordinates, 3) catch-all
  let zone: ZoneRow | null =
    zones.find((z) => !z.is_catch_all && (z.pincodes ?? []).includes(pincode)) ?? null;

  if (!zone && hasCoords) {
    let best: { z: ZoneRow; d: number } | null = null;
    for (const z of zones) {
      if (z.is_catch_all) continue;
      const zl = coord(z.center_lat);
      const zg = coord(z.center_lng);
      const r = Number(z.radius_km);
      if (!Number.isFinite(zl) || !Number.isFinite(zg) || !(r > 0)) continue;
      const d = haversineKm(lat, lng, zl, zg);
      if (d <= r && (!best || d < best.d)) best = { z, d };
    }
    zone = best?.z ?? null;
  }

  if (!zone) zone = zones.find((z) => z.is_catch_all) ?? null;

  if (!zone) {
    return {
      serviceable: false,
      status: 'NO_MATCH',
      zone: null,
      message: `AuroWater is not available in this part of ${city} yet. Join the waitlist and we will tell you first.`,
      services: null,
    };
  }

  const ref = { id: zone.id, name: zone.name, city: zone.city };

  if (!BOOKABLE.includes(zone.status)) {
    return {
      serviceable: false,
      status: zone.status,
      zone: ref,
      message: STATUS_MESSAGE[zone.status](zone.name),
      services: zone.services,
    };
  }

  if (serviceKey && zone.services && zone.services.length && !zone.services.includes(serviceKey)) {
    return {
      serviceable: false,
      status: zone.status,
      zone: ref,
      message: `This service is not offered in ${zone.name} yet.`,
      services: zone.services,
    };
  }

  return {
    serviceable: true,
    status: zone.status,
    zone: ref,
    message: STATUS_MESSAGE[zone.status](zone.name),
    services: zone.services,
  };
}

/* ───────────── admin input validation ───────────── */

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type Parsed = { ok: true; value: Record<string, unknown> } | { ok: false; error: string };

/** Validates a zone payload. `partial` = update (only supplied fields are checked). */
export function parseZoneInput(body: Record<string, unknown>, partial: boolean): Parsed {
  const out: Record<string, unknown> = {};

  if (!partial || body.city !== undefined) {
    const city = typeof body.city === 'string' ? body.city.trim() : '';
    if (!city) return { ok: false, error: 'city is required' };
    out.city = city;
  }
  if (!partial || body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return { ok: false, error: 'name is required' };
    out.name = name;
  }
  if (body.status !== undefined) {
    if (!ZONE_STATUSES.includes(body.status as ZoneStatus)) {
      return { ok: false, error: `status must be one of ${ZONE_STATUSES.join(', ')}` };
    }
    out.status = body.status;
  }
  if (body.pincodes !== undefined) {
    if (!Array.isArray(body.pincodes) || body.pincodes.some((p) => !/^[0-9]{6}$/.test(String(p)))) {
      return { ok: false, error: 'pincodes must be a list of 6-digit pincodes' };
    }
    out.pincodes = (body.pincodes as unknown[]).map(String);
  }
  if (body.services !== undefined) {
    if (body.services !== null && (!Array.isArray(body.services) || body.services.some((x) => typeof x !== 'string'))) {
      return { ok: false, error: 'services must be null or a list of service keys' };
    }
    out.services = body.services;
  }
  for (const k of ['center_lat', 'center_lng', 'radius_km'] as const) {
    if (body[k] !== undefined) {
      if (body[k] === null) out[k] = null;
      else {
        const n = Number(body[k]);
        if (!Number.isFinite(n)) return { ok: false, error: `${k} must be a number` };
        out[k] = n;
      }
    }
  }
  if (body.is_catch_all !== undefined) out.is_catch_all = Boolean(body.is_catch_all);
  if (body.notes !== undefined) out.notes = typeof body.notes === 'string' ? body.notes.slice(0, 500) : null;

  return { ok: true, value: out };
}
