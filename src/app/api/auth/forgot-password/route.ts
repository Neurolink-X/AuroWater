import { NextRequest } from 'next/server';

import {
  jsonErr,
  jsonOk,
} from '@/lib/api/json-response';

import {
  createSupabaseAnonClient,
  isSupabaseConfigured,
} from '@/lib/db/supabase';

import { getSiteUrl } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function getClientIp(
  req: NextRequest,
): string {
  const forwarded =
    req.headers.get('x-forwarded-for');

  if (forwarded) {
    return (
      forwarded
        .split(',')[0]
        ?.trim() || 'unknown'
    );
  }

  return (
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

export async function POST(
  req: NextRequest,
) {
  const ip = getClientIp(req);

  const rateCheck =
    checkRateLimit(
      `forgot-password:${ip}`,
    );

  if (!rateCheck.allowed) {
    return jsonErr(
      `Too many attempts — please wait ${rateCheck.retryAfter} seconds`,
      429,
      'RATE_LIMITED',
    );
  }

  if (!isSupabaseConfigured()) {
    return jsonErr(
      'Supabase is not configured on the server',
      503,
      'MISCONFIG_ENV',
    );
  }

  let body: Record<
    string,
    unknown
  >;

  try {
    body =
      (await req.json()) as Record<
        string,
        unknown
      >;
  } catch {
    return jsonErr(
      'Invalid JSON body',
      400,
    );
  }

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return jsonErr(
      'Invalid JSON body',
      400,
    );
  }

  const email =
    typeof body.email === 'string'
      ? body.email
          .trim()
          .toLowerCase()
      : '';

  if (!email) {
    return jsonErr(
      'Email is required',
      400,
    );
  }

  if (
    !EMAIL_PATTERN.test(email)
  ) {
    return jsonErr(
      'Enter a valid email address',
      400,
    );
  }

  /*
   * Always use the configured application
   * URL for the password-reset callback.
   *
   * Do not trust an arbitrary Origin header
   * as the redirect destination.
   */
  const configuredOrigin =
    process.env
      .NEXT_PUBLIC_APP_URL
      ?.trim() ||
    getSiteUrl();

  const origin =
    configuredOrigin.replace(
      /\/$/,
      '',
    );

  const redirectTo =
    `${origin}/auth/update-password`;

  const sb =
    createSupabaseAnonClient();

  const { error } =
    await sb.auth.resetPasswordForEmail(
      email,
      {
        redirectTo,
      },
    );

  /*
   * Do not reveal whether the email
   * exists in Supabase.
   *
   * This prevents account enumeration.
   */
  if (error) {
    console.error(
      '[auth/forgot-password]',
      error.message,
    );
  }

  return jsonOk({
    sent: true as const,
    message:
      'If an account exists for this email, a password reset link has been sent.',
  });
}
