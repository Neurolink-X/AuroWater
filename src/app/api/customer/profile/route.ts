/**
 * Customer profile API  (GET / PUT / PATCH)
 *
 * Put this at the SAME path as your current file (the one you pasted).
 *
 * Upgrades over the old version:
 *  - Strict, typed validation with clear per-field error messages
 *  - Name is whitespace-normalised and restricted to real-name characters (Hindi/Unicode OK)
 *  - `settings` is a known-keys whitelist and is MERGED into the stored value
 *    (old version replaced the whole object, wiping other preferences)
 *  - Body-size guard (413) and a best-effort per-user rate limit (429)
 *  - Database errors are logged server-side, never leaked to the client
 *  - `no-store` caching so the profile is never served stale
 *  - GET returns `profile_completion` + `missing` for "complete your profile" UI
 *  - PATCH is supported as an alias of PUT (partial update)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

export const dynamic = 'force-dynamic';

const PROFILE_COLUMNS = 'id, full_name, city, phone, created_at, settings';
const MAX_BODY_BYTES = 8 * 1024;
const MAX_SETTINGS_BYTES = 4 * 1024;
const RATE_LIMIT = 20;          // updates
const RATE_WINDOW_MS = 60_000;  // per minute, per user (per server instance)

/* ───────────────────────── validation ───────────────────────── */

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u;
const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

const nameSchema = z
  .string()
  .transform(collapse)
  .pipe(
    z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(80, 'Name must be 80 characters or fewer')
      .regex(NAME_RE, "Name can only contain letters, spaces and . ' -"),
  );

const citySchema = z
  .string()
  .transform(collapse)
  .pipe(z.string().min(2, 'City must be at least 2 characters').max(60, 'City must be 60 characters or fewer'));

/** Known preference keys only. Unknown keys are dropped on write. */
const settingsSchema = z.object({
  notifications: z
    .object({
      whatsapp: z.boolean().optional(),
      sms: z.boolean().optional(),
      email: z.boolean().optional(),
      push: z.boolean().optional(),
    })
    .optional(),
  language: z.enum(['en', 'hi']).optional(),
  default_payment: z.enum(['cash', 'upi', 'online']).optional(),
  marketing_opt_in: z.boolean().optional(),
  default_address_id: z.string().min(1).max(64).nullable().optional(),
});

const bodySchema = z
  .object({
    full_name: nameSchema.optional(),
    city: citySchema.optional(),
    settings: settingsSchema.optional(),
  })
  .strict();

/* ───────────────────────── helpers ───────────────────────── */

type Plain = Record<string, unknown>;
const isPlain = (v: unknown): v is Plain => typeof v === 'object' && v !== null && !Array.isArray(v);

function mergeSettings(existing: unknown, incoming: Plain): Plain {
  const base: Plain = isPlain(existing) ? existing : {};
  const out: Plain = { ...base, ...incoming };
  if (isPlain(base.notifications) && isPlain(incoming.notifications)) {
    out.notifications = { ...base.notifications, ...incoming.notifications };
  }
  return out;
}

function noStore<T extends Response>(res: T): T {
  try {
    res.headers.set('Cache-Control', 'no-store');
  } catch {
    /* immutable headers — ignore */
  }
  return res;
}

function withMeta(row: Plain | null) {
  if (!row) return null;
  const checks: Array<[string, boolean]> = [
    ['full_name', typeof row.full_name === 'string' && row.full_name.trim().length >= 2],
    ['city', typeof row.city === 'string' && row.city.trim().length >= 2],
    ['phone', typeof row.phone === 'string' && row.phone.trim().length > 0],
  ];
  const missing = checks.filter(([, ok]) => !ok).map(([k]) => k);
  const profile_completion = Math.round(((checks.length - missing.length) / checks.length) * 100);
  return { ...row, profile_completion, missing };
}

/** Best-effort limiter (in-memory, resets per serverless instance). */
const hits = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(userId, recent);
    return true;
  }
  recent.push(now);
  hits.set(userId, recent);
  if (hits.size > 5_000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(k);
  }
  return false;
}

/* ───────────────────────── handlers ───────────────────────── */

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) return jsonErr('Forbidden', 403);

  const { data, error } = await auth.ctx.supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', auth.ctx.profile.id)
    .maybeSingle();

  if (error) {
    console.error('[customer/profile] GET failed:', error.message);
    return jsonErr('Could not load your profile. Please try again.', 502);
  }
  return noStore(jsonOk(withMeta((data as Plain | null) ?? null)));
}

async function update(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'customer')) return jsonErr('Forbidden', 403);

  const userId = auth.ctx.profile.id;
  if (rateLimited(userId)) return jsonErr('Too many updates. Please wait a minute and try again.', 429);

  const declared = Number(req.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return jsonErr('Request too large', 413);

  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return jsonErr('Request too large', 413);
    raw = JSON.parse(text) as unknown;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.length ? `${issue.path.join('.')}: ` : '';
    return jsonErr(`${field}${issue?.message ?? 'Invalid payload'}`, 422);
  }

  const patch: Plain = {};
  if (parsed.data.full_name !== undefined) patch.full_name = parsed.data.full_name;
  if (parsed.data.city !== undefined) patch.city = parsed.data.city;

  if (parsed.data.settings !== undefined) {
    const { data: current, error: readErr } = await auth.ctx.supabase
      .from('profiles')
      .select('settings')
      .eq('id', userId)
      .maybeSingle();

    if (readErr) {
      console.error('[customer/profile] settings read failed:', readErr.message);
      return jsonErr('Could not save your preferences. Please try again.', 502);
    }

    const merged = mergeSettings((current as Plain | null)?.settings, parsed.data.settings as Plain);
    if (JSON.stringify(merged).length > MAX_SETTINGS_BYTES) {
      return jsonErr('Settings are too large', 413);
    }
    patch.settings = merged;
  }

  if (Object.keys(patch).length === 0) return jsonErr('Nothing to update', 400);

  const { data, error } = await auth.ctx.supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    console.error('[customer/profile] update failed:', error.message);
    return jsonErr('Could not save your profile. Please try again.', 502);
  }
  return noStore(jsonOk(withMeta(data as Plain)));
}

export const PUT = update;
export const PATCH = update;












// import { NextRequest } from 'next/server';
// import { z } from 'zod';

// import { jsonErr, jsonOk } from '@/lib/api/json-response';
// import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

// const schema = z.object({
//   full_name: z.string().min(2).optional(),
//   city: z.string().min(2).optional(),
//   settings: z.record(z.string(), z.unknown()).optional(),
// });

// export async function GET(req: NextRequest) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;
//   if (!requireRole(auth.ctx, 'customer')) return jsonErr('Forbidden', 403);

//   const { data, error } = await auth.ctx.supabase
//     .from('profiles')
//     .select('id, full_name, city, phone, created_at, settings')
//     .eq('id', auth.ctx.profile.id)
//     .maybeSingle();

//   if (error) return jsonErr(error.message, 502);
//   return jsonOk(data ?? null);
// }

// export async function PUT(req: NextRequest) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;
//   if (!requireRole(auth.ctx, 'customer')) return jsonErr('Forbidden', 403);

//   let raw: unknown;
//   try {
//     raw = (await req.json()) as unknown;
//   } catch {
//     return jsonErr('Invalid JSON body', 400);
//   }

//   const parsed = schema.safeParse(raw);
//   if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid payload', 422);

//   const patch: Record<string, unknown> = {};
//   if (typeof parsed.data.full_name === 'string') patch.full_name = parsed.data.full_name;
//   if (typeof parsed.data.city === 'string') patch.city = parsed.data.city;
//   if (parsed.data.settings != null) patch.settings = parsed.data.settings;

//   if (Object.keys(patch).length === 0) {
//     return jsonErr('Nothing to update', 400);
//   }

//   const { data, error } = await auth.ctx.supabase
//     .from('profiles')
//     .update(patch)
//     .eq('id', auth.ctx.profile.id)
//     .select('id, full_name, city, phone, created_at, settings')
//     .single();

//   if (error) return jsonErr(error.message, 502);
//   return jsonOk(data);
// }

