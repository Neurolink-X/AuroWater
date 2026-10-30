import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const categories = new Set(['forgot_password', 'lost_email_access', 'change_email', 'account_blocked', 'account_access', 'other']);
const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || req.headers.get('x-real-ip') || 'unknown';
  const rateSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rateSecret) return jsonErr('Account support is temporarily unavailable.', 503);
  const keyHash = createHash('sha256').update(`${rateSecret}:account-recovery:${ip}`).digest('hex');

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonErr('Invalid request.', 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return jsonErr('Invalid request.', 400);

  const name = clean(body.name, 100);
  const email = clean(body.email, 254).toLowerCase();
  const phone = clean(body.phone, 20);
  const category = clean(body.category, 40);
  const message = clean(body.message, 2000);
  if (name.length < 2 || !emailPattern.test(email) || !categories.has(category) || message.length < 10) {
    return jsonErr('Please check your name, email, request type and message.', 422);
  }
  if (phone && !/^[0-9+()\-\s]{7,20}$/.test(phone)) return jsonErr('Enter a valid contact number.', 422);

  let userId: string | null = null;
  const token = req.headers.get('authorization');
  if (token) {
    const auth = await requireSupabaseAuth(req);
    if (!auth.ok) return auth.response;
    userId = auth.ctx.user.id;
    if (auth.ctx.profile.role !== 'customer') return jsonErr('Only customer accounts can submit this request.', 403);
  }

  try {
    const db = createServiceClient();
    const { data: rateRows, error: rateError } = await db.rpc('consume_account_recovery_rate_limit', {
      p_key_hash: keyHash, p_max: 5, p_window_seconds: 3600,
    });
    if (rateError || !Array.isArray(rateRows) || !rateRows[0]) {
      console.error('[account-recovery] durable rate limit unavailable', rateError);
      return jsonErr('Account support is temporarily unavailable.', 503);
    }
    if (!rateRows[0].allowed) {
      return jsonErr('Too many requests. Please try again later.', 429, 'RATE_LIMITED');
    }
    const { data, error } = await db.rpc('submit_account_recovery_request', {
      p_user_id: userId, p_contact_name: name, p_contact_email: email,
      p_contact_phone: phone || null, p_category: category, p_message: message,
    });
    const request = Array.isArray(data) ? data[0] : data;
    if (error || !request) {
      console.error('[account-recovery] request create failed', error);
      return jsonErr('We could not submit your request. Please try again later.', 503);
    }
    return jsonOk({ request, message: 'Your account help request has been received.' }, 201);
  } catch (error) {
    console.error('[account-recovery] service unavailable', error);
    return jsonErr('Account support is temporarily unavailable.', 503);
  }
}
