import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';
const bodySchema = z.object({
  id:z.string().uuid(),
  status:z.enum(['active','coming_soon','waitlist']),
}).strict();

export async function GET(req:NextRequest) {
  const auth=await requireSupabaseAuth(req);
  if(!auth.ok) return auth.response;
  if(!requireAdmin(auth.ctx)) return jsonErr('Forbidden',403);
  const {data,error}=await createServiceClient().from('cities')
    .select('id,name,slug,status,is_featured,sort_order,state').order('sort_order').limit(500);
  if(error) { console.error('[admin/cities] list failed',{code:error.code});return jsonErr('City directory unavailable.',503); }
  return jsonOk(data??[]);
}

/** City-status mutations are reviewed, audited and fail closed for activation. */
export async function PATCH(req:NextRequest) {
  const auth=await requireSupabaseAuth(req);
  if(!auth.ok) return auth.response;
  if(!requireAdmin(auth.ctx)) return jsonErr('Forbidden',403);
  const parsed=bodySchema.safeParse(await req.json().catch(()=>null));
  if(!parsed.success) return jsonErr('Invalid city or status.',422);
  const db=createServiceClient();
  const {data:city,error:cityError}=await db.from('cities')
    .select('id,name,status').eq('id',parsed.data.id).maybeSingle();
  if(cityError) return jsonErr('Could not verify city.',503);
  if(!city) return jsonErr('City not found.',404);
  if(city.status===parsed.data.status) return jsonOk({city,unchanged:true});

  if(parsed.data.status==='active'){
    const {data:zones,error:zoneError}=await db.from('service_zones')
      .select('id,pincodes,status').ilike('city',city.name).eq('status','AVAILABLE').limit(100);
    if(zoneError) return jsonErr('Cannot verify operational zones.',503);
    const eligible=(zones??[]).filter(z=>Array.isArray(z.pincodes)&&z.pincodes.length>0);
    if(!eligible.length) return jsonErr('Cannot activate city: no available zones with verified PIN codes.',409);
    const {data:links,error:linksError}=await db.from('supplier_zones')
      .select('supplier_id').in('zone_id',eligible.map(z=>z.id)).limit(1000);
    if(linksError) return jsonErr('Cannot verify supplier assignments.',503);
    const ids=[...new Set((links??[]).map(l=>l.supplier_id))];
    if(!ids.length) return jsonErr('Cannot activate city: no suppliers assigned to service zones.',409);
    const [profiles,settings,stock]=await Promise.all([
      db.from('profiles').select('id,city').in('id',ids).eq('role','supplier').eq('is_active',true).eq('verification_status','approved'),
      db.from('supplier_settings').select('user_id,is_online').in('user_id',ids).eq('is_online',true),
      db.from('supplier_stock').select('supplier_id,cans_available,reserved_cans,reservation_buffer_cans').in('supplier_id',ids),
    ]);
    if(profiles.error||settings.error||stock.error) return jsonErr('Cannot verify live supplier capacity.',503);
    const online=new Set((settings.data??[]).map(x=>x.user_id));
    const stocked=new Set((stock.data??[]).filter(x=>Number(x.cans_available??0)>Number(x.reserved_cans??0)+Number(x.reservation_buffer_cans??0)).map(x=>x.supplier_id));
    const good=(profiles.data??[]).some(x=>x.city?.toLowerCase().trim()===city.name.toLowerCase().trim()&&online.has(x.id)&&stocked.has(x.id));
    if(!good) return jsonErr('Cannot activate city: no assigned, approved, online supplier with available stock.',409);
  }

  const {data,error}=await db.from('cities').update({status:parsed.data.status})
    .eq('id',city.id).eq('status',city.status).select('id,name,status').maybeSingle();
  if(error){console.error('[admin/cities] status update failed',{code:error.code});return jsonErr('City update failed.',503);}
  if(!data) return jsonErr('City changed during review. Refresh before saving.',409);
  const audit=await db.from('audit_logs').insert({
    actor_id:auth.ctx.user.id,action:'city.status_change',entity:'cities',
    entity_id:data.id,meta:{name:data.name,from:city.status,to:data.status},
  });
  if(audit.error) console.error('[admin/cities] audit logging failed',{code:audit.error.code});
  return jsonOk(data);
}
