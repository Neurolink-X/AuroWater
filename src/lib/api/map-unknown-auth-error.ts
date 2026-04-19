import type { NextResponse } from 'next/server';
import { jsonErr } from '@/lib/api/json-response';
import type { PostgrestErrorLike } from '@/lib/supabase/postgrest-errors';
import {
  isPostgrestTableUnavailableError,
  profileTableUnavailableMessage,
} from '@/lib/supabase/postgrest-errors';

function toPostgrestLike(e: unknown): PostgrestErrorLike {
  if (e && typeof e === 'object' && ('message' in e || 'code' in e)) {
    return e as PostgrestErrorLike;
  }
  return { message: e instanceof Error ? e.message : String(e) };
}

/**
 * Maps unexpected throws in auth-related API routes to stable JSON + HTTP codes.
 */
export function jsonErrFromUnknownAuthError(e: unknown, logLabel: string): NextResponse {
  const like = toPostgrestLike(e);

  if (isPostgrestTableUnavailableError(like)) {
    return jsonErr(profileTableUnavailableMessage(like), 503, 'DB_NOT_READY');
  }

  const msg = String(like.message ?? e);

  if (/SUPABASE_SERVICE_ROLE_KEY|service role.*not set|service_role.*missing/i.test(msg)) {
    return jsonErr('Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is not set.', 503, 'SERVICE_ROLE_MISSING');
  }

  if (/Supabase env missing|not configured on the server|misconfiguration.*Supabase/i.test(msg)) {
    return jsonErr(msg, 503, 'MISCONFIG_ENV');
  }

  console.error(logLabel, msg);
  return jsonErr(msg, 500);
}
