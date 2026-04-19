import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { ensureProfileForUser, isProfilesSchemaMissingError } from '@/lib/auth/ensure-profile';
import { createSupabaseAnonClient, createSupabaseUserClient, isSupabaseConfigured } from '@/lib/db/supabase';
import type { ProfileRow } from '@/lib/db/types';

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return jsonErr('Supabase is not configured on the server', 503);
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

  if (pErr && isProfilesSchemaMissingError(pErr)) {
    return jsonErr(
      'Database not ready: run sql/001_core_schema.sql through sql/005_notifications_dedup.sql in the Supabase SQL Editor, then retry.',
      503
    );
  }
  if (pErr) {
    return jsonErr(pErr.message || 'Could not load profile', 500);
  }

  let resolved = profile as ProfileRow | null;
  if (!resolved) {
    resolved = await ensureProfileForUser(data.session.user);
  }

  if (!resolved) {
    return jsonErr(
      'Profile not found for this account. Ensure migrations and trigger sql/004_functions.sql are applied, and SUPABASE_SERVICE_ROLE_KEY is set on the server.',
      404
    );
  }

  if (!resolved.is_active) {
    return jsonErr('This account is disabled', 403);
  }

  return jsonOk({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at ?? null,
    profile: resolved,
  });
}
