import { NextRequest } from 'next/server';

import {
  jsonErr,
  jsonOk,
} from '@/lib/api/json-response';

import { isSupabaseConfigured } from '@/lib/db/supabase';
import { createSupabaseAnonClient } from '@/lib/db/supabase-server';
import { phoneToAuthEmail } from '@/lib/auth/roles';

import { getSiteUrl } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';

const EMAIL_PATTERN = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/;
const PHONE_PATTERN = /^[6-9]\\d{9}$/;

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');

  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }

  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateCheck = checkRateLimit(`forgot-password:${ip}`);

  if (!rateCheck.allowed) {
    return jsonErr(
      `Too many attempts — please wait ${rateCheck.retryAfter} seconds`,
      429,
      'RATE_LIMITED',
    );
  }

  if (!isSupabaseConfigured()) {
    return jsonErr(
      'Password recovery is temporarily unavailable. Please try again later.',
      503,
      'MISCONFIG_ENV',
    );
  }

  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr('Invalid request. Please try again.', 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonErr('Invalid request. Please try again.', 400);
  }

  const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const rawPhone = typeof body.phone === 'string' ? body.phone.replace(/\\D/g, '') : '';

  // Phone-based accounts are stored in Supabase Auth using the same synthetic
  // email convention as sign-up/login. Never attempt an SMS flow for these
  // accounts: recovery is delivered to their registered email only if one exists.
  let email = rawEmail;
  if (rawPhone) {
    if (!PHONE_PATTERN.test(rawPhone)) {
      return jsonErr('Enter a valid 10-digit Indian mobile number.', 400);
    }
    email = phoneToAuthEmail(rawPhone);
  } else if (rawEmail && !rawEmail.includes('@')) {
    const digits = rawEmail.replace(/\\D/g, '');
    if (!PHONE_PATTERN.test(digits)) {
      return jsonErr('Enter a valid email address or 10-digit mobile number.', 400);
    }
    email = phoneToAuthEmail(digits);
  }

  if (!email) {
    return jsonErr('Enter your registered email or 10-digit mobile number.', 400);
  }

  if (!EMAIL_PATTERN.test(email)) {
    return jsonErr('Enter a valid email address or 10-digit mobile number.', 400);
  }

  /*
   * Use the configured application URL rather than trusting an arbitrary
   * Origin header. Supabase must also allow this exact callback URL.
   */
  const configuredOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || getSiteUrl();
  const origin = configuredOrigin.replace(/\\/$/, '');
  const redirectTo = `${origin}/auth/update-password`;

  try {
    const sb = createSupabaseAnonClient();
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });

    // Do not reveal whether an account exists; also avoid leaking provider errors.
    if (error) {
      console.error('[auth/forgot-password] Supabase reset request failed:', error.message);
    }
  } catch (error) {
    console.error(
      '[auth/forgot-password] Request failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    // Preserve the generic response to avoid account enumeration.
  }

  return jsonOk({
    sent: true as const,
    message: 'If an account exists for this email or phone login, recovery instructions have been sent to the registered email.',
  });
}
