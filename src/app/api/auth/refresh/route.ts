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

function getClientIp(
  req: NextRequest,
): string {
  const forwarded =
    req.headers.get(
      'x-forwarded-for',
    );

  if (forwarded) {
    return (
      forwarded
        .split(',')[0]
        ?.trim() || 'unknown'
    );
  }

  return (
    req.headers.get(
      'x-real-ip',
    ) ?? 'unknown'
  );
}

export async function POST(
  req: NextRequest,
) {
  const ip =
    getClientIp(req);

  const rateCheck =
    checkRateLimit(
      `refresh:${ip}`,
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

  const refreshToken =
    typeof body.refresh_token ===
    'string'
      ? body.refresh_token.trim()
      : '';

  if (!refreshToken) {
    return jsonErr(
      'refresh_token is required',
      400,
    );
  }

  /*
   * Supabase refresh tokens are opaque.
   * Do not try to decode or validate them
   * locally. Supabase is the source of truth.
   */
  const sb =
    createSupabaseAnonClient();

  const {
    data,
    error,
  } =
    await sb.auth.refreshSession({
      refresh_token:
        refreshToken,
    });

  if (
    error ||
    !data.session?.access_token
  ) {
    return jsonErr(
      'Session expired. Please sign in again.',
      401,
      'SESSION_EXPIRED',
    );
  }

  return jsonOk({
    access_token:
      data.session.access_token,

    refresh_token:
      data.session.refresh_token ??
      refreshToken,

    expires_at:
      data.session.expires_at ??
      null,
  });
}
