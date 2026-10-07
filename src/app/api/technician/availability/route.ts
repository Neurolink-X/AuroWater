import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

const schema = z.object({
  online: z.boolean(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
});

export async function PUT(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'technician')) return jsonErr('Forbidden', 403);

  const profile = auth.ctx.profile as unknown as {
    is_active?: boolean;
    status?: string | null;
    verification_status?: string | null;
  };

  if (profile.is_active !== true || String(profile.status ?? '').toLowerCase() !== 'active') {
    return jsonErr('Your technician account is not active', 403);
  }

  if (
    profile.verification_status !== undefined &&
    profile.verification_status !== null &&
    String(profile.verification_status).toLowerCase() !== 'approved'
  ) {
    return jsonErr('Your technician account is not approved', 403);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid availability', 422);

  const update: Record<string, unknown> = {
    is_online: parsed.data.online,
    availability_status: parsed.data.online ? 'available' : 'offline',
    last_seen_at: new Date().toISOString(),
  };

  if (parsed.data.lat !== undefined || parsed.data.lng !== undefined) {
    if (parsed.data.lat === null || parsed.data.lng === null) {
      return jsonErr('Latitude and longitude must be provided together', 400);
    }
    update.current_lat = parsed.data.lat;
    update.current_lng = parsed.data.lng;
  }

  const { data, error } = await auth.ctx.supabase
    .from('profiles')
    .update(update)
    .eq('id', auth.ctx.profile.id)
    .eq('role', 'technician')
    .select('id, is_online, availability_status, current_lat, current_lng, last_seen_at')
    .single();

  if (error || !data) return jsonErr(error?.message ?? 'Availability update failed', 409);
  return jsonOk(data);
}
