/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import { parseZoneInput } from '@/lib/zones';

/** Admin only. Open/close a zone, edit pincodes/services, with an audit trail. No deployment needed. */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'admin')) return jsonErr('Forbidden', 403);

  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const parsed = parseZoneInput(body, true);
  if (!parsed.ok) return jsonErr(parsed.error, 422);
  if (!Object.keys(parsed.value).length) return jsonErr('Nothing to update', 422);

  const db: any = createServiceClient();
  const { data: before } = await db.from('service_zones').select('id, name, city, status').eq('id', id).maybeSingle();
  if (!before) return jsonErr('Zone not found', 404);

  // Preserve canonical city relationship when an administrator edits a zone's city.
  let canonicalCityId: string | null | undefined;
  if (typeof parsed.value.city === 'string') {
    const { data: canonical, error: cityError } = await db.from('cities')
      .select('id').ilike('name', parsed.value.city.trim()).limit(1).maybeSingle();
    if (cityError) return jsonErr('Could not verify city directory.',503);
    canonicalCityId = canonical?.id ?? null;
  }
  const { data, error } = await db
    .from('service_zones')
    .update({ ...parsed.value, ...(canonicalCityId !== undefined ? {city_id:canonicalCityId} : {}), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') return jsonErr('Another zone already uses that name or catch-all setting', 409);
    console.error('[admin/zones] update failed:', error);
    return jsonErr('Could not update the zone', 500);
  }

  await db.from('audit_logs').insert({
    actor_id: auth.ctx.profile.id,
    action: before.status !== data.status ? 'zone.status_change' : 'zone.update',
    entity: 'service_zones',
    entity_id: id,
    meta: { name: data.name, city: data.city, from: before.status, to: data.status, changed: Object.keys(parsed.value) },
  });

  return jsonOk(data);
}
