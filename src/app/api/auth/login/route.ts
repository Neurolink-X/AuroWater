import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import {
  ensureProfileForUser,
  isProfilesSchemaMissingError,
  profileTableUnavailableMessage,
} from '@/lib/auth/ensure-profile';
import { createSupabaseAnonClient, createSupabaseUserClient, isSupabaseConfigured } from '@/lib/db/supabase';
import type { ProfileRow } from '@/lib/db/types';
import { getSupabaseServiceRoleKey } from '@/lib/env/supabase-service-role';
import { createServiceClient } from '@/utils/supabase/server';

function roleDefaultUrl(role: string): string {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'supplier') return '/supplier/dashboard';
  if (role === 'technician') return '/technician/dashboard';
  return '/customer/home';
}

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
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const city = typeof body.city === 'string' ? body.city.trim() : '';

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
    .select('id,email,full_name,role,status,phone,city,avatar_url,aurotap_id,created_at,updated_at')
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
    const { data: inserted, error: insErr } = await userSb
      .from('profiles')
      .insert({
        id: data.session.user.id,
        email: data.session.user.email ?? email,
        full_name:
          (data.session.user.user_metadata?.full_name as string | undefined) ??
          (data.session.user.user_metadata?.name as string | undefined) ??
          '',
        role: 'customer',
        status: 'active',
      })
      .select('id,email,full_name,role,status,phone,city,avatar_url,aurotap_id,created_at,updated_at')
      .maybeSingle();
    if (!insErr && inserted) {
      resolved = inserted as ProfileRow;
    } else {
      resolved = await ensureProfileForUser(data.session.user);
    }
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

  if (resolved.deleted_at) {
    return jsonErr('Account deleted', 403, 'ACCOUNT_DELETED');
  }
  if (resolved.is_active === false) {
    return jsonErr('Account suspended. Contact support.', 403, 'ACCOUNT_SUSPENDED');
  }

  // First-login hydration: store phone/city on the profile if provided.
  if ((phone || city) && (resolved.phone !== phone || resolved.city !== city)) {
    try {
      const patch: Record<string, string> = {};
      if (phone) patch.phone = phone;
      if (city) patch.city = city;
      const { data: updated, error: uErr } = await userSb
        .from('profiles')
        .update(patch)
        .eq('id', resolved.id)
        .select('id,email,full_name,role,status,phone,city,avatar_url,aurotap_id,created_at,updated_at')
        .maybeSingle();
      if (!uErr && updated) resolved = updated as ProfileRow;
    } catch (e) {
      console.error('profiles update (phone/city) failed', e);
    }
  }

  if (resolved.status === 'suspended') {
    return jsonErr('Account suspended', 403, 'ACCOUNT_SUSPENDED');
  }
  if (
    resolved.status === 'pending' &&
    (resolved.role === 'supplier' || resolved.role === 'technician')
  ) {
    return jsonErr('Application pending approval', 403, 'APPLICATION_PENDING');
  }

  // Fire-and-forget: update last_seen_at (never block login response).
  try {
    void userSb
      .from('profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', resolved.id);
  } catch {
    /* ignore */
  }

  const response = jsonOk({
    ok: true as const,
    role: resolved.role,
    redirectTo: roleDefaultUrl(resolved.role),
    user: { id: resolved.id, email: resolved.email, full_name: resolved.full_name },
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at ?? null,
    profile: resolved,
  });

  response.cookies.set('aw_session', '1', {
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  });
  response.cookies.set('aw_role', resolved.role, {
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
