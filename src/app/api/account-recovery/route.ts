// PATH: src/app/api/account-recovery/route.ts
import { NextRequest } from 'next/server';
import { createHmac } from 'node:crypto';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import { firstIssue, recoveryRequestSchema } from '@/lib/account-recovery/shared';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 16 * 1024;
const WINDOW_SECONDS = 3600;
const LIMIT_PER_IP = 5;
const LIMIT_PER_EMAIL = 3;

/** Prefer headers the platform sets itself (hard to spoof) over client-supplied X-Forwarded-For. */
function clientIp(req: NextRequest): string {
  const h = req.headers;
  return (
    h.get('cf-connecting-ip') ||
    h.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

/** HMAC (not a bare hash) so keys cannot be brute-forced back to IPs/emails. Always 64 hex chars. */
const rateKey = (secret: string, scope: 'ip' | 'email', value: string) =>
  createHmac('sha256', secret).update(`account-recovery:${scope}:${value}`).digest('hex');

function limited(retryAfter: number) {
  const res = jsonErr('Too many requests. Please try again later.', 429, 'RATE_LIMITED');
  res.headers.set('Retry-After', String(Math.max(1, retryAfter)));
  return res;
}

export async function POST(req: NextRequest) {
  const secret = process.env.ACCOUNT_RECOVERY_RATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    console.error('[account-recovery] rate-limit secret missing');
    return jsonErr('Account support is temporarily unavailable.', 503);
  }

  // Cheap rejections first: they never touch the database or burn quota.
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return jsonErr('Request is too large.', 413);

  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return jsonErr('Request is too large.', 413);
    raw = JSON.parse(text);
  } catch { return jsonErr('Invalid request.', 400); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return jsonErr('Invalid request.', 400);

  const parsed = recoveryRequestSchema.safeParse(raw);
  if (!parsed.success) return jsonErr(firstIssue(parsed.error, 'Please check your name, email, request type and message.'), 422);
  const { name, email, phone, category, message, website } = parsed.data;

  // Honeypot tripped: pretend success so bots learn nothing, store nothing.
  if (website) return jsonOk({ request: { request_number: 'received' }, message: 'Your account help request has been received.' }, 201);

  // Optional auth: a stale/invalid token must not block someone who is locked out, so fall back to anonymous.
  let userId: string | null = null;
  if (req.headers.get('authorization')) {
    const auth = await requireSupabaseAuth(req);
    if (auth.ok) {
      if (auth.ctx.profile.role !== 'customer') return jsonErr('Only customer accounts can submit this request.', 403);
      userId = auth.ctx.user.id;
    }
  }

  try {
    const db = createServiceClient();

    // Two independent limits: per network address and per target email (stops distributed spam of one victim).
    for (const [scope, value, max] of [
      ['ip', clientIp(req), LIMIT_PER_IP],
      ['email', email, LIMIT_PER_EMAIL],
    ] as const) {
      const { data, error } = await db.rpc('consume_account_recovery_rate_limit', {
        p_key_hash: rateKey(secret, scope, value), p_max: max, p_window_seconds: WINDOW_SECONDS,
      });
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) {
        console.error('[account-recovery] durable rate limit unavailable', error); // fail closed
        return jsonErr('Account support is temporarily unavailable.', 503);
      }
      if (!row.allowed) return limited(Number(row.retry_after) || 60);
    }

    const { data, error } = await db.rpc('submit_account_recovery_request', {
      p_user_id: userId, p_contact_name: name, p_contact_email: email,
      p_contact_phone: phone || null, p_category: category, p_message: message,
    });
    const request = Array.isArray(data) ? data[0] : data;
    if (error || !request) {
      console.error('[account-recovery] request create failed', error);
      // 22023 = the database rejected the input; anything else is on us.
      return error?.code === '22023'
        ? jsonErr('Please check your details and try again.', 422)
        : jsonErr('We could not submit your request. Please try again later.', 503);
    }

    const res = jsonOk({ request, message: 'Your account help request has been received.' }, 201);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (error) {
    console.error('[account-recovery] service unavailable', error);
    return jsonErr('Account support is temporarily unavailable.', 503);
  }
}








// import { NextRequest } from 'next/server';
// import { createHash } from 'node:crypto';
// import { jsonErr, jsonOk } from '@/lib/api/json-response';
// import { requireSupabaseAuth } from '@/lib/api/supabase-request';
// import { createServiceClient } from '@/utils/supabase/server';

// export const dynamic = 'force-dynamic';

// const categories = new Set(['forgot_password', 'lost_email_access', 'change_email', 'account_blocked', 'account_access', 'other']);
// const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
// const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// export async function POST(req: NextRequest) {
//   const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
//   const ip = forwarded || req.headers.get('x-real-ip') || 'unknown';
//   const rateSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
//   if (!rateSecret) return jsonErr('Account support is temporarily unavailable.', 503);
//   const keyHash = createHash('sha256').update(`${rateSecret}:account-recovery:${ip}`).digest('hex');

//   let body: Record<string, unknown>;
//   try { body = await req.json(); } catch { return jsonErr('Invalid request.', 400); }
//   if (!body || typeof body !== 'object' || Array.isArray(body)) return jsonErr('Invalid request.', 400);

//   const name = clean(body.name, 100);
//   const email = clean(body.email, 254).toLowerCase();
//   const phone = clean(body.phone, 20);
//   const category = clean(body.category, 40);
//   const message = clean(body.message, 2000);
//   if (name.length < 2 || !emailPattern.test(email) || !categories.has(category) || message.length < 10) {
//     return jsonErr('Please check your name, email, request type and message.', 422);
//   }
//   if (phone && !/^[0-9+()\-\s]{7,20}$/.test(phone)) return jsonErr('Enter a valid contact number.', 422);

//   let userId: string | null = null;
//   const token = req.headers.get('authorization');
//   if (token) {
//     const auth = await requireSupabaseAuth(req);
//     if (!auth.ok) return auth.response;
//     userId = auth.ctx.user.id;
//     if (auth.ctx.profile.role !== 'customer') return jsonErr('Only customer accounts can submit this request.', 403);
//   }

//   try {
//     const db = createServiceClient();
//     const { data: rateRows, error: rateError } = await db.rpc('consume_account_recovery_rate_limit', {
//       p_key_hash: keyHash, p_max: 5, p_window_seconds: 3600,
//     });
//     if (rateError || !Array.isArray(rateRows) || !rateRows[0]) {
//       console.error('[account-recovery] durable rate limit unavailable', rateError);
//       return jsonErr('Account support is temporarily unavailable.', 503);
//     }
//     if (!rateRows[0].allowed) {
//       return jsonErr('Too many requests. Please try again later.', 429, 'RATE_LIMITED');
//     }
//     const { data, error } = await db.rpc('submit_account_recovery_request', {
//       p_user_id: userId, p_contact_name: name, p_contact_email: email,
//       p_contact_phone: phone || null, p_category: category, p_message: message,
//     });
//     const request = Array.isArray(data) ? data[0] : data;
//     if (error || !request) {
//       console.error('[account-recovery] request create failed', error);
//       return jsonErr('We could not submit your request. Please try again later.', 503);
//     }
//     return jsonOk({ request, message: 'Your account help request has been received.' }, 201);
//   } catch (error) {
//     console.error('[account-recovery] service unavailable', error);
//     return jsonErr('Account support is temporarily unavailable.', 503);
//   }
// }
