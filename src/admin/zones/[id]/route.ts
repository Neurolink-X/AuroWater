/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

/** GET: every supplier, flagged if assigned to this zone.  PUT: replace the zone's supplier set. */

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'admin')) return jsonErr('Forbidden', 403);

  const { id } = await ctx.params;
  const db: any = createServiceClient();

  const [supRes, linkRes] = await Promise.all([
    db
      .from('profiles')
      .select('id, full_name, phone, city, status, is_active')
      .eq('role', 'supplier')
      .order('full_name')
      .limit(500),
    db.from('supplier_zones').select('supplier_id').eq('zone_id', id),
  ]);

  if (supRes.error || linkRes.error) {
    console.error('[admin/zones/suppliers] load failed:', supRes.error ?? linkRes.error);
    return jsonErr('Could not load suppliers', 500);
  }

  const assigned = new Set(((linkRes.data ?? []) as { supplier_id: string }[]).map((r) => String(r.supplier_id)));
  return jsonOk({
    suppliers: ((supRes.data ?? []) as any[]).map((s) => ({ ...s, assigned: assigned.has(String(s.id)) })),
  });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'admin')) return jsonErr('Forbidden', 403);

  const { id } = await ctx.params;

  let body: { supplier_ids?: unknown };
  try {
    body = (await req.json()) as { supplier_ids?: unknown };
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }
  if (!Array.isArray(body.supplier_ids) || body.supplier_ids.length > 500 || body.supplier_ids.some((x) => typeof x !== 'string')) {
    return jsonErr('supplier_ids must be a list of supplier IDs', 422);
  }
  const wanted = [...new Set(body.supplier_ids as string[])];

  const db: any = createServiceClient();

  const { data: zone } = await db.from('service_zones').select('id, name').eq('id', id).maybeSingle();
  if (!zone) return jsonErr('Zone not found', 404);

  // Only real suppliers may be assigned
  if (wanted.length) {
    const { data: valid } = await db.from('profiles').select('id').eq('role', 'supplier').in('id', wanted);
    const ok = new Set(((valid ?? []) as { id: string }[]).map((r) => String(r.id)));
    if (wanted.some((w) => !ok.has(w))) return jsonErr('One or more IDs are not suppliers', 422);
  }

  const { data: current } = await db.from('supplier_zones').select('supplier_id').eq('zone_id', id);
  const have = new Set(((current ?? []) as { supplier_id: string }[]).map((r) => String(r.supplier_id)));
  const toAdd = wanted.filter((w) => !have.has(w));
  const toRemove = [...have].filter((h) => !wanted.includes(h));

  if (toRemove.length) {
    const { error } = await db.from('supplier_zones').delete().eq('zone_id', id).in('supplier_id', toRemove);
    if (error) {
      console.error('[admin/zones/suppliers] remove failed:', error);
      return jsonErr('Could not update suppliers', 500);
    }
  }
  if (toAdd.length) {
    const { error } = await db
      .from('supplier_zones')
      .upsert(toAdd.map((supplier_id) => ({ supplier_id, zone_id: id })), { onConflict: 'supplier_id,zone_id' });
    if (error) {
      console.error('[admin/zones/suppliers] add failed:', error);
      return jsonErr('Could not update suppliers', 500);
    }
  }

  await db.from('audit_logs').insert({
    actor_id: auth.ctx.profile.id,
    action: 'zone.suppliers_update',
    entity: 'service_zones',
    entity_id: id,
    meta: { zone: zone.name, added: toAdd.length, removed: toRemove.length },
  });

  return jsonOk({ assigned: wanted.length, added: toAdd.length, removed: toRemove.length });
}
