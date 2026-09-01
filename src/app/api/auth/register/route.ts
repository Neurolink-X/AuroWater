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
import { needsApproval, phoneToAuthEmail, uiRoleToDb } from '@/lib/auth/roles';

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

  const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const full_name = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.replace(/\D/g, '').slice(-10) : '';
  const city = typeof body.city === 'string' ? body.city.trim() : '';
  const pincode = typeof body.pincode === 'string' ? body.pincode.trim() : '';
  const role = uiRoleToDb(typeof body.role === 'string' ? body.role : 'customer');
  const email = emailRaw || (phone ? phoneToAuthEmail(phone) : '');

  if (role === 'admin') {
    const expected = process.env.ADMIN_INVITE_CODE?.trim();
    const provided = typeof body.invite_code === 'string' ? body.invite_code.trim() : '';
    if (!expected || provided !== expected) {
      return jsonErr('Admin registration requires a valid invite code', 403);
    }
  }

  if (!password || !full_name || !phone) {
    return jsonErr('full_name, phone, and password are required', 400);
  }
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return jsonErr('Enter a valid 10-digit Indian mobile number', 400);
  }
  if (password.length < 8) {
    return jsonErr('Password must be at least 8 characters', 400);
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
        city,
        pincode,
        business_name: typeof body.business_name === 'string' ? body.business_name : undefined,
        business_type: typeof body.business_type === 'string' ? body.business_type : undefined,
        gst_number: typeof body.gst_number === 'string' ? body.gst_number : undefined,
        vehicle_type: typeof body.vehicle_type === 'string' ? body.vehicle_type : undefined,
        license_number: typeof body.license_number === 'string' ? body.license_number : undefined,
      },
    },
  });

  if (error) {
    return jsonErr(error.message, 400);
  }

  const session = data.session;
  const pending = needsApproval(role);

  if (!session?.access_token) {
    return jsonOk(
      {
        needsEmailConfirmation: false as const,
        pending,
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

  if (needsApproval(resolved.role)) {
    const extra: Record<string, unknown> = { status: 'pending_approval' };
    if (city) extra.city = city;
    if (pincode) extra.pincode = pincode;
    if (typeof body.business_name === 'string') extra.business_name = body.business_name;
    if (typeof body.business_type === 'string') extra.business_type = body.business_type;
    if (typeof body.gst_number === 'string') extra.gst_number = body.gst_number;
    if (typeof body.vehicle_type === 'string') extra.vehicle_type = body.vehicle_type;
    if (typeof body.license_number === 'string') extra.license_number = body.license_number;
    await userSb.from('profiles').update(extra).eq('id', resolved.id);
  }

  return jsonOk(
    {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at ?? null,
      profile: resolved,
      pending: needsApproval(resolved.role),
    },
    201
  );
}
