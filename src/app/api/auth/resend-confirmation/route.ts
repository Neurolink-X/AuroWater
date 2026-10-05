import { NextRequest } from 'next/server';

import {
  jsonErr,
  jsonOk,
} from '@/lib/api/json-response';

import {
  createSupabaseAnonClient,
  isSupabaseConfigured,
} from '@/lib/db/supabase';

import {
  checkRateLimit,
} from '@/lib/rate-limit';

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
  const ip =
    getClientIp(req);

  const rateCheck =
    checkRateLimit(
      `resend-confirmation:${ip}`,
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
    typeof body.email ===
    'string'
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

  const sb =
    createSupabaseAnonClient();

  const { error } =
    await sb.auth.resend({
      type: 'signup',
      email,
    });

  /*
   * Do not expose detailed Supabase
   * errors that could help enumerate
   * accounts.
   */
  if (error) {
    console.error(
      '[auth/resend-confirmation]',
      error.message,
    );

    return jsonErr(
      'Could not resend the confirmation email. Please try again later.',
      400,
    );
  }

  return jsonOk({
    sent: true as const,
    message:
      'If confirmation is required, a new email has been sent.',
  });
}
