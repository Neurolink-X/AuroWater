import { NextRequest, NextResponse } from 'next/server';
import { jsonErr } from '@/lib/api/json-response';
import {
  ensureProfileForUser,
  isProfilesSchemaMissingError,
  profileTableUnavailableMessage,
} from '@/lib/auth/ensure-profile';
import { createSupabaseAnonClient, createSupabaseUserClient, isSupabaseConfigured } from '@/lib/db/supabase';
import type { ProfileRow } from '@/lib/db/types';
import { getSupabaseServiceRoleKey } from '@/lib/env/supabase-service-role';
import { createServiceClient } from '@/utils/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  const rateCheck = checkRateLimit(`login:${ip}`);
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

  const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const phone = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '').slice(-10) : '';

  let email = emailRaw;
  if (!email && /^\d{10}$/.test(phone)) {
    email = `${phone}@users.aurotap.in`;
  }
  const city = typeof body.city === 'string' ? body.city.trim() : '';

  if (!email || !password) {
    return jsonErr('Phone or email, and password, are required', 400);
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

  if (resolved.status === 'suspended' || resolved.status === 'banned') {
    return jsonErr('Account suspended. Contact support.', 403, 'ACCOUNT_SUSPENDED');
  }
  if (resolved.status === 'rejected') {
    return jsonErr(
      resolved.rejection_reason
        ? `Application rejected: ${resolved.rejection_reason}`
        : 'Application was rejected. Contact support.',
      403,
      'ACCOUNT_REJECTED'
    );
  }
  if (
    (resolved.status === 'pending' || resolved.status === 'pending_approval') &&
    (resolved.role === 'supplier' || resolved.role === 'technician')
  ) {
    return jsonErr('Your account is still under review.', 403, 'PENDING_APPROVAL');
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

  const responseBody = {
    data: {
      token: data.session.access_token,
      role: resolved.role,
      user: { id: resolved.id, email: resolved.email },
    },
    message: 'Login successful',
  };

  const cookieSecure = req.nextUrl.protocol === 'https:';
  const response = NextResponse.json(responseBody);
  response.cookies.set('aw_session', '1', {
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    secure: cookieSecure,
  });
  response.cookies.set('aw_role', resolved.role, {
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
    secure: cookieSecure,
  });

  return response;
}
