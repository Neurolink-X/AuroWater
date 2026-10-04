/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import { parseZoneInput, slugify } from '@/lib/zones';

/** Admin only. Role is verified server-side, then the service client performs the read/write. */

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'admin')) return jsonErr('Forbidden', 403);

  const db: any = createServiceClient();
  const { data: zones, error } = await db.from('service_zones').select('*').order('city').order('name');
  if (error) {
    console.error('[admin/zones] list failed:', error);
    return jsonErr('Could not load zones', 500);
  }

  const { data: links } = await db.from('supplier_zones').select('zone_id');
  const counts = new Map<string, number>();
  for (const l of (links ?? []) as { zone_id: string }[]) {
    counts.set(l.zone_id, (counts.get(l.zone_id) ?? 0) + 1);
  }

  return jsonOk(((zones ?? []) as any[]).map((z) => ({ ...z, supplier_count: counts.get(z.id) ?? 0 })));
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'admin')) return jsonErr('Forbidden', 403);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const parsed = parseZoneInput(body, false);
  if (!parsed.ok) return jsonErr(parsed.error, 422);

  const v = parsed.value;
  const row = {
    status: 'COMING_SOON',
    pincodes: [],
    ...v,
    slug: slugify(`${String(v.city)}-${String(v.name)}`),
  };

  const db: any = createServiceClient();
  const { data, error } = await db.from('service_zones').insert(row).select('*').single();
  if (error) {
    if (error.code === '23505') return jsonErr('A zone with this name already exists in that city', 409);
    console.error('[admin/zones] create failed:', error);
    return jsonErr('Could not create the zone', 500);
  }

  await db.from('audit_logs').insert({
    actor_id: auth.ctx.profile.id,
    action: 'zone.create',
    entity: 'service_zones',
    entity_id: String(data.id),
    meta: { city: data.city, name: data.name, status: data.status },
  });

  return jsonOk(data, 201);
}
