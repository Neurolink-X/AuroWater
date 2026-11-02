import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSupabaseAuth, requireRole } from '@/lib/api/supabase-request';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { createServiceClient } from '@/utils/supabase/server';

const requestSchema = z.object({ radius_km: z.number().int().min(31).max(50), reason: z.string().trim().min(15).max(500) });
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx,'supplier')) return jsonErr('Supplier only',403);
  const {data,error} = await createServiceClient().from('partner_radius_requests')
    .select('id,requested_radius_km,status,reason,admin_note,created_at,reviewed_at')
    .eq('provider_id',auth.ctx.profile.id).eq('service_key','water_can')
    .order('created_at',{ascending:false}).limit(10);
  if (error) return jsonErr('Radius requests unavailable',503);
  const res = jsonOk(data ?? []);
  res.headers.set('Cache-Control','private, no-store');
  return res;
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx,'supplier')) return jsonErr('Supplier only',403);
  const parsed = requestSchema.safeParse(await req.json().catch(()=>null));
  if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid radius request',422);
  const db = createServiceClient();
  const {data: current,error:currentError} = await db.from('supplier_settings')
    .select('zone_radius_km').eq('user_id',auth.ctx.profile.id).single();
  if (currentError || !current) return jsonErr('Supplier settings unavailable',503);
  const {data:existing,error:existingError} = await db.from('partner_radius_requests')
    .select('id').eq('provider_id',auth.ctx.profile.id).eq('service_key','water_can')
    .eq('status','PENDING').maybeSingle();
  if(existingError) return jsonErr('Could not check pending requests',503);
  if(existing) return jsonErr('A radius request is already awaiting admin review',409);
  const {data,error} = await db.from('partner_radius_requests').insert({
    provider_id:auth.ctx.profile.id,service_key:'water_can',
    previous_radius_km:Number(current.zone_radius_km ?? 10),
    requested_radius_km:parsed.data.radius_km,reason:parsed.data.reason
  }).select('id,status,requested_radius_km').single();
  if(error) return jsonErr(error.code==='23505'?'A request is already pending':'Could not submit radius request',error.code==='23505'?409:503);
  return jsonOk(data,201);
}
