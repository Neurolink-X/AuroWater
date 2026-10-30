import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { checkRateLimit } from '@/lib/rate-limit';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const categories = new Set(['forgot_password', 'lost_email_access', 'change_email', 'account_blocked', 'account_access', 'other']);
const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || req.headers.get('x-real-ip') || 'unknown';
  const limit = checkRateLimit(`account-recovery:${ip}`);
  if (!limit.allowed) return jsonErr('Too many requests. Please try again later.', 429, 'RATE_LIMITED');

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
    const { data, error } = await db.from('account_recovery_requests').insert({
      user_id: userId, contact_name: name, contact_email: email, contact_phone: phone || null,
      category, message, status: 'open',
    }).select('id, request_number, status, created_at').single();
    if (error || !data) {
      console.error('[account-recovery] request create failed', error);
      return jsonErr('We could not submit your request. Please try again later.', 503);
    }
    await db.from('account_recovery_audit').insert({
      request_id: data.id, actor_user_id: userId, action: 'request_submitted',
      details: { category, authenticated: Boolean(userId) },
    });
    return jsonOk({ request: data, message: 'Your account help request has been received.' }, 201);
  } catch (error) {
    console.error('[account-recovery] service unavailable', error);
    return jsonErr('Account support is temporarily unavailable.', 503);
  }
}
