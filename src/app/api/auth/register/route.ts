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
  const full_name = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const roleRaw = typeof body.role === 'string' ? body.role.toLowerCase() : 'customer';
  const role =
    roleRaw === 'technician' || roleRaw === 'supplier' || roleRaw === 'admin'
      ? roleRaw
      : 'customer';

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

  if (pErr && isProfilesSchemaMissingError(pErr)) {
    return jsonErr(
      'Database not ready: run sql/001_core_schema.sql through sql/005_notifications_dedup.sql in the Supabase SQL Editor, then register again.',
      503
    );
  }
  if (pErr) {
    return jsonErr(pErr.message || 'Could not load profile', 500);
  }

  let resolved = profile as ProfileRow | null;
  if (!resolved) {
    resolved = await ensureProfileForUser(session.user);
  }

  if (!resolved) {
    return jsonErr(
      'Account created but profile could not be created. Apply sql/004_functions.sql (auth trigger) or set SUPABASE_SERVICE_ROLE_KEY, then sign in.',
      500
    );
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
