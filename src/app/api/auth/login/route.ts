import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import {
  ensureProfileForUser,
  isProfilesSchemaMissingError,
  profileTableUnavailableMessage,
} from '@/lib/auth/ensure-profile';
import { createSupabaseAnonClient, createSupabaseUserClient, isSupabaseConfigured } from '@/lib/db/supabase';
import type { ProfileRow } from '@/lib/db/types';
import { isProfileLoginAllowed } from '@/lib/auth/profile-access';
import { getSupabaseServiceRoleKey } from '@/lib/env/supabase-service-role';
import { createServiceClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return jsonErr('Supabase is not configured on the server', 503, 'MISCONFIG_ENV');
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return jsonErr('email and password are required', 400);
  }

  const sb = createSupabaseAnonClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error || !data.session?.access_token) {
    return jsonErr(error?.message ?? 'Invalid credentials', 401);
  }

  const userSb = createSupabaseUserClient(data.session.access_token);
  const { data: profile, error: pErr } = await userSb
    .from('profiles')
    .select('*')
    .eq('id', data.session.user.id)
    .maybeSingle();

  if (pErr) {
    const code = (pErr as { code?: string }).code;
    if (code === '42501') {
      return jsonErr(pErr.message || 'Forbidden', 403);
    }
    if (isProfilesSchemaMissingError(pErr)) {
      return jsonErr(profileTableUnavailableMessage(pErr), 503, 'DB_NOT_READY');
    }
    return jsonErr(pErr.message || 'Could not load profile', 502);
  }

  let resolved = profile as ProfileRow | null;

  if (!resolved) {
    resolved = await ensureProfileForUser(data.session.user);
  }

  if (!resolved) {
    const sr = getSupabaseServiceRoleKey();
    if (!sr) {
      return jsonErr('Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is not set', 503, 'SERVICE_ROLE_MISSING');
    }
    try {
      const admin = createServiceClient();
      const { data: svcRow, error: svcErr } = await admin
        .from('profiles')
        .select('*')
        .eq('id', data.session.user.id)
        .maybeSingle();
      if (!svcErr && svcRow) {
        resolved = svcRow as ProfileRow;
      }
    } catch {
      /* service client unavailable */
    }
  }

  if (!resolved) {
    return jsonErr(
      'Profile not found for this account. Apply migrations (001–006), auth trigger (004_functions.sql), then retry.',
      404
    );
  }

  if (!isProfileLoginAllowed(resolved)) {
    return jsonErr(
      'This account has been suspended. Contact support if you think this is a mistake.',
      403,
      'ACCOUNT_SUSPENDED'
    );
  }

  return jsonOk({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at ?? null,
    profile: resolved,
  });
}
