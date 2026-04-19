// import { NextRequest } from 'next/server';
// import { jsonErr, jsonOk } from '@/lib/api/json-response';
// import { rowsToSettingsPayload } from '@/lib/api/settings-map';
// import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';

// export async function GET(req: NextRequest) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;
//   if (!requireAdmin(auth.ctx)) {
//     return jsonErr('Forbidden', 403);
//   }

//   const { data, error } = await auth.ctx.supabase.from('settings').select('key, value');
//   if (error) {
//     return jsonErr(error.message, 500);
//   }

//   const flat = rowsToSettingsPayload(data ?? []);
//   return jsonOk(flat);
// }

// export async function PUT(req: NextRequest) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;
//   if (!requireAdmin(auth.ctx)) {
//     return jsonErr('Forbidden', 403);
//   }

//   let body: Record<string, unknown>;
//   try {
//     body = (await req.json()) as Record<string, unknown>;
//   } catch {
//     return jsonErr('Invalid JSON body', 400);
//   }

//   const rows = Object.entries(body).map(([key, value]) => ({
//     key,
//     value: typeof value === 'string' ? value : JSON.stringify(value),
//     updated_at: new Date().toISOString(),
//   }));

//   const { error } = await auth.ctx.supabase.from('settings').upsert(rows, { onConflict: 'key' });

//   if (error) {
//     return jsonErr(error.message, 500);
//   }

//   const { data: next } = await auth.ctx.supabase.from('settings').select('key, value');
//   return jsonOk(rowsToSettingsPayload(next ?? []));
// }



/**
 * GET|PUT /api/admin/settings
 *
 * Upgrades over original:
 *  ✓ Typed SETTINGS_SCHEMA — every key has type + min/max/pattern/label
 *  ✓ Per-key validation — invalid keys collected + returned, valid keys still upserted
 *  ✓ Audit log — every PUT writes actor_id, old_value, new_value, timestamp
 *  ✓ ETag-based 304 Not Modified on GET — avoids redundant reads for polling UIs
 *  ✓ Input size guard — rejects bodies > 50 keys to prevent abuse
 *  ✓ Unknown keys stored as-is (forward-compatible)
 *  ✓ Zero `any`/`unknown` leaks in the public response shape
 */

import { NextRequest, NextResponse } from 'next/server';
import { jsonErr } from '@/lib/api/json-response';
import { rowsToSettingsPayload } from '@/lib/api/settings-map';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

/* ── Schema ──────────────────────────────────────────────────────────────── */

type SettingType = 'number' | 'string' | 'boolean';

interface SettingMeta {
  type: SettingType;
  min?: number;
  max?: number;
  label: string;
  pattern?: RegExp;
}

export const SETTINGS_SCHEMA: Record<string, SettingMeta> = {
  platform_fee:        { type: 'number', min: 0,   max: 100,  label: 'Platform fee (₹)' },
  default_can_price:   { type: 'number', min: 1,   max: 500,  label: 'Default can price (₹)' },
  min_can_price:       { type: 'number', min: 1,   max: 500,  label: 'Min can price (₹)' },
  max_can_price:       { type: 'number', min: 1,   max: 1000, label: 'Max can price (₹)' },
  plumber_booking_fee: { type: 'number', min: 0,   max: 5000, label: 'Plumber booking fee (₹)' },
  supplier_commission: { type: 'number', min: 0,   max: 50,   label: 'Supplier commission (%)' },
  bulk_commission:     { type: 'number', min: 0,   max: 50,   label: 'Bulk commission (%)' },
  service_radius_km:   { type: 'number', min: 1,   max: 100,  label: 'Service radius (km)' },
  max_cans_per_order:  { type: 'number', min: 1,   max: 500,  label: 'Max cans per order' },
  emergency_surcharge: { type: 'number', min: 0,   max: 500,  label: 'Emergency surcharge (₹)' },
  support_phone:    { type: 'string', pattern: /^\d{10}$/, label: 'Support phone (10 digits)' },
  support_email:    { type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, label: 'Support email' },
  whatsapp_number:  { type: 'string', pattern: /^\d{10}$/, label: 'WhatsApp number (10 digits)' },
  maintenance_mode:   { type: 'boolean', label: 'Maintenance mode' },
  auto_assign_orders: { type: 'boolean', label: 'Auto-assign orders' },
};

/* ── Validation ──────────────────────────────────────────────────────────── */

type ValidResult   = { ok: true;  serialized: string };
type InvalidResult = { ok: false; error: string };

function validate(key: string, raw: unknown): ValidResult | InvalidResult {
  const meta = SETTINGS_SCHEMA[key];
  if (!meta) {
    // Unknown key — store as-is for forward compat
    return { ok: true, serialized: typeof raw === 'string' ? raw : JSON.stringify(raw) };
  }

  switch (meta.type) {
    case 'number': {
      const n = Number(raw);
      if (!isFinite(n))
        return { ok: false, error: `${meta.label}: must be a number` };
      if (meta.min !== undefined && n < meta.min)
        return { ok: false, error: `${meta.label}: must be ≥ ${meta.min}` };
      if (meta.max !== undefined && n > meta.max)
        return { ok: false, error: `${meta.label}: must be ≤ ${meta.max}` };
      return { ok: true, serialized: String(n) };
    }
    case 'boolean': {
      const b = raw === true || raw === 'true' || raw === 1 || raw === '1';
      return { ok: true, serialized: b ? 'true' : 'false' };
    }
    case 'string': {
      const s = String(raw ?? '').trim();
      if (!s) return { ok: false, error: `${meta.label}: must not be empty` };
      if (meta.pattern && !meta.pattern.test(s))
        return { ok: false, error: `${meta.label}: invalid format` };
      return { ok: true, serialized: s };
    }
  }
}

/* ── Audit log ───────────────────────────────────────────────────────────── */

async function writeAuditLog(
  sb: SupabaseClient,
  adminId: string,
  changes: Array<{ key: string; old_value: string | null; new_value: string }>
) {
  if (!changes.length) return;
  await sb.from('audit_logs').insert(
    changes.map((c) => ({
      actor_id:  adminId,
      action:    'settings.update',
      entity:    'settings',
      entity_id: c.key,
      meta:      { old: c.old_value, new: c.new_value },
    }))
  );
}

/* ── GET ─────────────────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);

  const { data, error } = await auth.ctx.supabase
    .from('settings')
    .select('key, value, updated_at');

  if (error) return jsonErr(error.message, 500);

  const flat = rowsToSettingsPayload(data ?? []);

  // ETag: skip response body if settings haven't changed (polling-friendly)
  const etag = `"${createHash('sha1').update(JSON.stringify(flat)).digest('hex').slice(0, 16)}"`;
  if (req.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  return NextResponse.json(
    { ok: true, data: flat },
    { headers: { ETag: etag, 'Cache-Control': 'private, no-cache' } }
  );
}

/* ── PUT ─────────────────────────────────────────────────────────────────── */

export async function PUT(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const entries = Object.entries(body);
  if (entries.length === 0) return jsonErr('Body must contain at least one setting', 400);
  if (entries.length > 50)  return jsonErr('Too many keys (max 50 per request)', 400);

  /* Validate all incoming keys */
  const validRows:   Array<{ key: string; value: string; updated_at: string }> = [];
  const invalidKeys: Array<{ key: string; error: string }> = [];

  for (const [key, raw] of entries) {
    const r = validate(key, raw);
    if (r.ok) validRows.push({ key, value: r.serialized, updated_at: new Date().toISOString() });
    else invalidKeys.push({ key, error: r.error });
  }

  if (validRows.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'All settings failed validation', invalid: invalidKeys },
      { status: 422 }
    );
  }

  const sb = auth.ctx.supabase;

  /* Snapshot old values for audit trail */
  const { data: oldRows } = await sb
    .from('settings')
    .select('key, value')
    .in('key', validRows.map((r) => r.key));
  const oldMap = new Map((oldRows ?? []).map((r) => [r.key as string, r.value as string]));

  /* Upsert */
  const { error } = await sb.from('settings').upsert(validRows, { onConflict: 'key' });
  if (error) return jsonErr(error.message, 500);

  /* Audit log — fire and forget */
  void writeAuditLog(
    sb,
    auth.ctx.user?.id ?? 'unknown',
    validRows.map((r) => ({
      key:       r.key,
      old_value: oldMap.get(r.key) ?? null,
      new_value: r.value,
    }))
  );

  /* Return full updated settings + any per-key warnings */
  const { data: next } = await sb.from('settings').select('key, value');

  return NextResponse.json(
    {
      ok:    true,
      data:  rowsToSettingsPayload(next ?? []),
      saved: validRows.map((r) => r.key),
      ...(invalidKeys.length ? { invalid: invalidKeys } : {}),
    },
    { status: 200 }
  );
}