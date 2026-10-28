// src/app/api/supplier/coverage-requests/route.ts
// (If your folder is named `coverage` instead, put this file there. The code is identical.)
//
// Supplier coverage: list service zones + the supplier's own requests, and let the supplier
// request coverage. A request NEVER activates a zone; an admin approves it.
// Response shapes are unchanged ({ zones, requests } / { submitted, status }), with additive fields only.
import { createHash, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

type Row = Record<string, unknown>;
type PgErr = { code?: string; message?: string; details?: string; hint?: string } | null | undefined;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const ZONE_COLS = 'id, city, name, status, pincodes, services';
const REQ_COLS = 'id, zone_id, service_keys, status, supplier_note, admin_note, created_at, updated_at';

/* ───────── Errors: log the real cause server-side, return a safe message ───────── */

/** Postgres/PostgREST codes that mean "database setup is incomplete" (missing table/column/unique index). */
const SETUP_CODES = new Set(['42P01', '42703', '42P10', 'PGRST205', 'PGRST204', 'PGRST200']);

function classify(err: PgErr): { status: 502 | 503; message: string; setup: boolean } {
  const code = err?.code ?? '';
  const msg = (err?.message ?? '').toLowerCase();
  if (SETUP_CODES.has(code)) {
    return { status: 503, setup: true, message: 'Coverage setup is incomplete. Our team has been alerted. Please try again later.' };
  }
  if (code === '57014' || msg.includes('fetch failed') || msg.includes('timeout') || msg.includes('network')) {
    return { status: 503, setup: false, message: 'Coverage settings are temporarily unavailable. Please retry in a moment.' };
  }
  return { status: 502, setup: false, message: 'Coverage settings are temporarily unavailable.' };
}

function fail(rid: string, step: string, err: PgErr, fallback?: string) {
  const c = classify(err);
  // Search your Vercel logs for this line (or the request id) to see the REAL cause.
  console.error('[supplier/coverage]', { rid, step, code: err?.code, message: err?.message, details: err?.details, hint: err?.hint });
  const res = jsonErr(fallback ?? c.message, c.status);
  res.headers.set('x-request-id', rid);
  return res;
}

function withMeta<T extends Response>(res: T, rid: string): T {
  res.headers.set('x-request-id', rid);
  return res;
}

/* ───────── Zones: small reference data, cached briefly per server instance ───────── */

const ZONE_TTL_MS = 60_000;
let zoneCache: { rows: Row[]; exp: number } | null = null;
type Db = ReturnType<typeof createServiceClient>;

async function loadZones(db: Db): Promise<{ rows: Row[] | null; error: PgErr }> {
  if (zoneCache && Date.now() < zoneCache.exp) return { rows: zoneCache.rows, error: null };
  let res = await db.from('service_zones').select(ZONE_COLS);
  // A renamed/missing optional column must not take the whole page down: retry with all columns.
  if (res.error?.code === '42703') res = await db.from('service_zones').select('*');
  if (res.error) return { rows: null, error: res.error as PgErr };
  const rows = ((res.data ?? []) as unknown as Row[]).slice().sort((a, b) =>
    String(a.city ?? '').localeCompare(String(b.city ?? '')) || String(a.name ?? '').localeCompare(String(b.name ?? '')));
  zoneCache = { rows, exp: Date.now() + ZONE_TTL_MS };
  return { rows, error: null };
}

async function loadRequests(db: Db, supplierId: string, zoneIds?: string[]): Promise<{ rows: Row[] | null; error: PgErr }> {
  const run = (cols: string) => {
    let q = db.from('supplier_zone_requests').select(cols).eq('supplier_id', supplierId);
    if (zoneIds) q = q.in('zone_id', zoneIds);
    return q;
  };
  let res = await run(REQ_COLS);
  if (res.error?.code === '42703') res = await run('*');
  if (res.error) return { rows: null, error: res.error as PgErr };
  return { rows: (res.data ?? []) as unknown as Row[], error: null };
}

/* ───────── Tiny per-supplier rate limit for POST (best effort on serverless) ───────── */

const hits = new Map<string, number[]>();
function rateLimited(key: string, max = 10, windowMs = 60_000): number {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter(t => now - t < windowMs);
  if (recent.length >= max) { hits.set(key, recent); return Math.ceil((windowMs - (now - recent[0])) / 1000); }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5_000) for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k);
  return 0;
}

/* ───────── GET ───────── */

export async function GET(req: NextRequest) {
  const rid = randomUUID();
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const db = createServiceClient();
  const [zonesRes, requestsRes, profileRes] = await Promise.all([
    loadZones(db),
    loadRequests(db, auth.ctx.profile.id),
    db.from('profiles').select('city').eq('id', auth.ctx.profile.id).maybeSingle(),
  ]);

  if (zonesRes.error || !zonesRes.rows) return fail(rid, 'load-zones', zonesRes.error);
  if (profileRes.error) return fail(rid, 'load-supplier-city', profileRes.error);

  // Show the supplier's registered city first and only; prevents a Noida supplier
  // accidentally requesting a Kanpur zone simply because all zones were globally listed.
  const normalizeCity = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/\\s+/g, ' ');
  const supplierCity = normalizeCity(profileRes.data?.city);
  const cityZones = supplierCity
    ? zonesRes.rows.filter(z => normalizeCity(z.city) === supplierCity)
    : zonesRes.rows;
  const zones = cityZones;

  let requests = requestsRes.rows ?? [];
  const warnings: string[] = [];
  if (requestsRes.error) {
    // Missing requests table/column: still show the zones so the page loads; POST will explain the setup issue.
    if (classify(requestsRes.error).setup) {
      console.error('[supplier/coverage]', { rid, step: 'load-requests (degraded)', code: requestsRes.error.code, message: requestsRes.error.message });
      requests = [];
      warnings.push('requests_unavailable');
    } else return fail(rid, 'load-requests', requestsRes.error);
  }

  const body = { zones, requests, supplier_city: profileRes.data?.city ?? null, ...(warnings.length ? { warnings } : {}) };

  // ETag: an unchanged reload costs a 304 with no body. no-cache = always revalidate, so a
  // supplier never sees stale state right after submitting a request.
  const etag = `W/"${createHash('sha1').update(JSON.stringify(body)).digest('base64url')}"`;
  const headers = { ETag: etag, 'Cache-Control': 'private, no-cache', Vary: 'Authorization, Cookie', 'x-request-id': rid };
  if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });

  const res = jsonOk(body);
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

/* ───────── POST ───────── */

export async function POST(req: NextRequest) {
  const rid = randomUUID();
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const supplierId = auth.ctx.profile.id;
  const wait = rateLimited(supplierId);
  if (wait > 0) {
    const res = jsonErr('Too many requests. Please wait a moment and try again.', 429);
    res.headers.set('Retry-After', String(wait));
    return withMeta(res, rid);
  }

  let body: unknown;
  try { body = await req.json(); } catch { return withMeta(jsonErr('Invalid JSON body', 400), rid); }

  if (!isRecord(body) || !Array.isArray(body.zone_ids) || body.zone_ids.length < 1 || body.zone_ids.length > 30 ||
      body.zone_ids.some((id) => typeof id !== 'string' || id.length === 0 || id.length > 64)) {
    return withMeta(jsonErr('Select between 1 and 30 service areas.', 422), rid);
  }
  const zoneIds = [...new Set(body.zone_ids as string[])];

  const serviceKeys = Array.isArray(body.service_keys) && body.service_keys.length <= 30 &&
    body.service_keys.every((x) => typeof x === 'string' && /^[a-z0-9_-]{1,60}$/.test(x))
      ? [...new Set(body.service_keys as string[])].sort() : null;
  if (serviceKeys === null || serviceKeys.length === 0) return withMeta(jsonErr('Choose at least one valid service type.', 422), rid);
  const note = typeof body.supplier_note === 'string' ? body.supplier_note.trim().slice(0, 500) : '';
  const pinMatch = note.match(/Requested PIN codes:\\s*([^\\n]+)/i);
  const requestedPins = pinMatch
    ? [...new Set(pinMatch[1].split(/[\\s,]+/).map(p => p.trim()).filter(Boolean))]
    : [];
  if (requestedPins.length > 3) {
    return withMeta(jsonErr('You can request a maximum of 3 additional PIN codes at a time.', 422), rid);
  }
  if (requestedPins.some(pin => !/^\\d{6}$/.test(pin))) {
    return withMeta(jsonErr('Requested PIN codes must be valid 6-digit numbers.', 422), rid);
  }

  const db = createServiceClient();

  // 1. Every selected zone must exist
  const { data: zones, error: zoneError } = await db.from('service_zones').select('id').in('id', zoneIds);
  if (zoneError) return fail(rid, 'validate-zones', zoneError, 'Could not validate selected service areas.');
  const valid = new Set((zones ?? []).map((z: { id: string }) => String(z.id)));
  if (zoneIds.some((id) => !valid.has(id))) return withMeta(jsonErr('One or more selected service areas do not exist.', 422), rid);

  // 2. Never knock an already-APPROVED zone back to PENDING (the old upsert silently removed live coverage)
  const existing = await loadRequests(db, supplierId, zoneIds);
  if (existing.error) return fail(rid, 'load-existing', existing.error, 'Could not submit coverage request.');
  const approved = new Set((existing.rows ?? []).filter(r => String(r.status ?? '').toUpperCase() === 'APPROVED').map(r => String(r.zone_id)));

  const skipped = zoneIds.filter(id => approved.has(id)).map(zone_id => ({ zone_id, reason: 'ALREADY_APPROVED' as const }));
  const rows = zoneIds.filter(id => !approved.has(id)).map((zone_id) => ({
    supplier_id: supplierId, zone_id, service_keys: serviceKeys,
    supplier_note: note || null, status: 'PENDING', admin_note: null,
    reviewed_by: null, reviewed_at: null, updated_at: new Date().toISOString(),
  }));

  if (rows.length === 0) return withMeta(jsonOk({ submitted: 0, skipped, status: 'UNCHANGED' }), rid);

  // 3. Save (needs a UNIQUE (supplier_id, zone_id) index; see the migration file)
  const { error } = await db.from('supplier_zone_requests').upsert(rows, { onConflict: 'supplier_id,zone_id' });
  if (error) return fail(rid, 'save-request', error, 'Could not submit coverage request.');

  return withMeta(jsonOk({ submitted: rows.length, skipped, status: 'PENDING' }), rid);
}
