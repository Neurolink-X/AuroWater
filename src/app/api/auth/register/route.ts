import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import {
  ensureProfileForUser,
  isProfilesSchemaMissingError,
  profileTableUnavailableMessage,
} from '@/lib/auth/ensure-profile';
import { seedSupplierRegistrationDefaults } from '@/lib/auth/seed-supplier-registration';
import { createSupabaseAnonClient, createSupabaseUserClient, isSupabaseConfigured } from '@/lib/db/supabase';
import { createServiceClient } from '@/utils/supabase/server';
import type { ProfileRow } from '@/lib/db/types';

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
  const full_name = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const roleRaw = typeof body.role === 'string' ? body.role.toLowerCase() : 'customer';
  const role =
    roleRaw === 'technician' || roleRaw === 'supplier' || roleRaw === 'admin'
      ? roleRaw
      : 'customer';

  if (role === 'admin') {
    const expected = process.env.ADMIN_INVITE_CODE?.trim();
    const provided = typeof body.invite_code === 'string' ? body.invite_code.trim() : '';
    if (!expected || provided !== expected) {
      return jsonErr('Admin registration requires a valid invite code', 403);
    }
  }

  if (!email || !password || !full_name) {
    return jsonErr('full_name, email, and password are required', 400);
  }
  if (password.length < 6) {
    return jsonErr('Password must be at least 6 characters', 400);
  }

  const sb = createSupabaseAnonClient();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name,
        phone,
        role,
      },
    },
  });

  if (error) {
    return jsonErr(error.message, 400);
  }

  const session = data.session;
  if (!session?.access_token) {
    return jsonOk(
      {
        needsEmailConfirmation: true as const,
        email,
      },
      201
    );
  }

  const userSb = createSupabaseUserClient(session.access_token);
  const { data: profile, error: pErr } = await userSb
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  if (pErr) {
    const code = (pErr as { code?: string }).code;
    if (code === '42501') {
      return jsonErr(pErr.message || 'Forbidden', 403);
    }
    if (isProfilesSchemaMissingError(pErr)) {
      return jsonErr(
        `${profileTableUnavailableMessage(pErr)} Then register again.`,
        503,
        'DB_NOT_READY'
      );
    }
    return jsonErr(pErr.message || 'Could not load profile', 502);
  }

  let resolved = profile as ProfileRow | null;
  if (!resolved) {
    resolved = await ensureProfileForUser(session.user);
  }

  if (!resolved) {
    try {
      createServiceClient();
    } catch {
      return jsonErr(
        'Account created but profile could not be finalized. Set SUPABASE_SERVICE_ROLE_KEY on the server, then sign in.',
        503,
        'SERVICE_ROLE_MISSING'
      );
    }
    return jsonErr(
      'Account created but profile could not be created. Apply migrations (001–006) and sql/004_functions.sql, then sign in.',
      404
    );
  }

  if (resolved.role === 'supplier') {
    await seedSupplierRegistrationDefaults(resolved.id);
  }

  return jsonOk(
    {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at ?? null,
      profile: resolved,
    },
    201
  );
}
