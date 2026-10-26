import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Read supplier-owned profile and dispatch settings without exposing other suppliers. */
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const db = createServiceClient();
  const supplierId = auth.ctx.profile.id;
  const [profileRes, settingsRes, coverageRes] = await Promise.all([
    db.from('profiles')
      .select('id, full_name, email, phone, city, business_name, status, is_active, created_at')
      .eq('id', supplierId)
      .maybeSingle(),
    db.from('supplier_settings').select('*').eq('user_id', supplierId).maybeSingle(),
    // supplier_zones is keyed by supplier_id (not user_id). Keep this query
    // separate from service_zones so a missing PostgREST relationship cache
    // cannot make the whole profile unavailable.
    db.from('supplier_zones').select('zone_id, service_keys').eq('supplier_id', supplierId),
  ]);
  const zoneIds = (coverageRes.data ?? [])
    .map((row) => row.zone_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  const zonesRes = zoneIds.length
    ? await db.from('service_zones').select('id, city, name, status, pincodes').in('id', zoneIds)
    : { data: [], error: null };
  const zonesById = new Map((zonesRes.data ?? []).map((zone) => [String(zone.id), zone]));
  const coverage = (coverageRes.data ?? []).map((row) => ({
    ...row,
    service_zones: zonesById.get(String(row.zone_id)) ?? null,
  }));
  if (profileRes.error || settingsRes.error || coverageRes.error || zonesRes.error) {
    console.error('[supplier/profile] load failed', profileRes.error ?? settingsRes.error ?? coverageRes.error ?? zonesRes.error);
    return jsonErr('Supplier profile is temporarily unavailable.', 502);
  }
  return jsonOk({
    profile: profileRes.data,
    settings: settingsRes.data,
    coverage,
  });
}

/** Profile edits are proposed for admin review; suppliers cannot self-approve verification or service coverage. */
export async function PATCH(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  let body: unknown;
  try { body = await req.json(); } catch { return jsonErr('Invalid JSON body', 400); }
  if (!isRecord(body)) return jsonErr('Request body must be an object.', 400);

  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const businessName = typeof body.business_name === 'string' ? body.business_name.trim() : '';
  const city = typeof body.city === 'string' ? body.city.trim() : '';
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  const pincode = typeof body.pincode === 'string' ? body.pincode.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : '';

  if (!fullName || fullName.length > 100) return jsonErr('Enter a valid full name (1–100 characters).', 422);
  if (phone && !/^[+0-9() -]{7,20}$/.test(phone)) return jsonErr('Enter a valid phone number.', 422);
  if (!city || city.length > 100) return jsonErr('Enter a valid city.', 422);
  if (pincode && !/^\d{6}$/.test(pincode)) return jsonErr('PIN code must contain exactly 6 digits.', 422);
  if (!address || address.length > 300) return jsonErr('Enter a valid business/service address.', 422);

  const db = createServiceClient();
  const supplierId = auth.ctx.profile.id;
  const { data: profile, error: profileError } = await db.from('profiles')
    .select('full_name, phone, business_name, city').eq('id', supplierId).maybeSingle();
  if (profileError || !profile) {
    console.error('[supplier/profile] profile read failed', profileError);
    return jsonErr('Could not verify your current profile.', 502);
  }
  const { data: settings, error: settingsError } = await db.from('supplier_settings')
    .select('*').eq('user_id', supplierId).maybeSingle();
  if (settingsError) {
    console.error('[supplier/profile] settings read failed', settingsError);
    return jsonErr('Could not verify your current service address.', 502);
  }

  const requested = {
    full_name: fullName, phone: phone || null, business_name: businessName || null,
    city, address, pincode, reason: reason || null,
  };
  const current = {
    full_name: profile.full_name ?? '', phone: profile.phone ?? '',
    business_name: profile.business_name ?? '', city: profile.city ?? '',
    address: String(settings?.business_address ?? settings?.address ?? ''),
    pincode: String(settings?.pincode ?? ''),
  };
  if (JSON.stringify(requested) === JSON.stringify({ ...current, reason: reason || null })) {
    return jsonErr('No profile changes to request.', 422);
  }

  const { error } = await db.from('supplier_profile_change_requests').insert({
    supplier_id: supplierId, requested_changes: requested, status: 'PENDING',
  });
  if (error) {
    console.error('[supplier/profile] change request save failed', error);
    return jsonErr('Could not submit your profile change request. Contact support if the issue continues.', 502);
  }
  return jsonOk({ status: 'PENDING', message: 'Profile change request sent to admin for review.' });
}
