import { NextRequest } from 'next/server';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { isSupabaseConfigured } from '@/lib/db/supabase';
import { createSupabaseAnonClient } from '@/lib/db/supabase-server';
import { createServiceClient } from '@/utils/supabase/server';
import { getSiteUrl } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';

const EMAIL_PATTERN = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/;
const PHONE_PATTERN = /^[6-9]\\d{9}$/;
const SYNTHETIC_EMAIL_DOMAIN = '@users.aurotap.in';

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(req: NextRequest) {
  const rateCheck = checkRateLimit(`forgot-password:${getClientIp(req)}`);
  if (!rateCheck.allowed) {
    return jsonErr(
      `Too many attempts — please wait ${rateCheck.retryAfter} seconds`,
      429,
      'RATE_LIMITED',
    );
  }

  if (!isSupabaseConfigured()) {
    return jsonErr('Password recovery is temporarily unavailable. Please try again later.', 503, 'MISCONFIG_ENV');
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
  let email = rawEmail;

  if (rawPhone || (rawEmail && !rawEmail.includes('@'))) {
    const phone = rawPhone || rawEmail.replace(/\\D/g, '');
    if (!PHONE_PATTERN.test(phone)) {
      return jsonErr('Enter a valid email address or 10-digit Indian mobile number.', 400);
    }

    // Phone logins use synthetic Supabase emails, which cannot receive mail.
    // Resolve the account's real contact email from the profile before sending
    // recovery. Never send reset links to the synthetic login address.
    try {
      const admin = createServiceClient();
      const { data: profile, error } = await admin
        .from('profiles')
        .select('email')
        .eq('phone', phone)
        .maybeSingle();

      if (error) {
        console.error('[auth/forgot-password] Phone lookup failed:', error.message);
      } else if (typeof profile?.email === 'string') {
        const profileEmail = profile.email.trim().toLowerCase();
        if (EMAIL_PATTERN.test(profileEmail) && !profileEmail.endsWith(SYNTHETIC_EMAIL_DOMAIN)) {
          email = profileEmail;
        } else {
          // No deliverable email is registered for this phone account.
          email = '';
        }
      } else {
        email = '';
      }
    } catch (error) {
      console.error(
        '[auth/forgot-password] Phone recovery lookup unavailable:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      email = '';
    }
  }

  if (email && !EMAIL_PATTERN.test(email)) {
    return jsonErr('Enter a valid email address or 10-digit Indian mobile number.', 400);
  }

  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim() || getSiteUrl();
  const origin = configuredOrigin.replace(/\\/$/, '');
  const redirectTo = `${origin}/auth/update-password`;

  // Generic response for unknown accounts and phone accounts without a
  // deliverable contact email prevents account enumeration.
  if (email) {
    try {
      const sb = createSupabaseAnonClient();
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        console.error('[auth/forgot-password] Supabase reset request failed:', error.message);
      }
    } catch (error) {
      console.error(
        '[auth/forgot-password] Reset request failed:',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  return jsonOk({
    sent: true as const,
    message: 'If an account exists and has a registered recovery email, recovery instructions have been sent.',
  });
}
