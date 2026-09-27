import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { createSupabaseAnonClient, isSupabaseConfigured } from '@/lib/db/supabase';
import { getSiteUrl } from '@/lib/env';
import { phoneToAuthEmail } from '@/lib/auth/roles';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  const rateCheck = checkRateLimit(`forgot:${ip}`);
  if (!rateCheck.allowed) {
    return jsonErr(`Too many attempts — please wait ${rateCheck.retryAfter} seconds`, 429);
  }

  if (!isSupabaseConfigured()) {
    return jsonErr('Supabase is not configured on the server', 503, 'MISCONFIG_ENV');
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const emailRaw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '').slice(-10) : '';
  const email = emailRaw || (/^[6-9]\d{9}$/.test(phone) ? phoneToAuthEmail(phone) : '');

  if (!email || !email.includes('@')) {
    return jsonErr('Enter a valid email or 10-digit mobile number', 400);
  }

  const origin =
    req.headers.get('origin') ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    getSiteUrl();
  const redirectTo = `${origin.replace(/\/$/, '')}/auth/update-password`;

  const sb = createSupabaseAnonClient();
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    return jsonErr(error.message, 400);
  }

  return jsonOk({ sent: true as const });
}
