import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
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

const newCitySchema=z.object({
  name:z.string().trim().min(2).max(80),
  state:z.string().trim().min(2).max(80),
  lat:z.number().finite().min(-90).max(90),
  lng:z.number().finite().min(-180).max(180),
  radius_km:z.number().int().min(1).max(100),
}).strict();

export async function POST(req:NextRequest) {
  const auth=await requireSupabaseAuth(req);
  if(!auth.ok) return auth.response;
  if(!requireAdmin(auth.ctx)) return jsonErr('Forbidden',403);
  const parsed=newCitySchema.safeParse(await req.json().catch(()=>null));
  if(!parsed.success) return jsonErr('Valid city, state, latitude, longitude and radius are required.',422);
  const {name,state,lat,lng,radius_km}=parsed.data;
  const slug=name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  if(!slug) return jsonErr('City name cannot produce a valid URL slug.',422);
  // New cities never become bookable automatically.
  const db=createServiceClient();
  const {data,error}=await db.from('cities').insert({
    name,state,slug,lat,lng,radius_km,status:'waitlist',is_featured:false,sort_order:99,
  }).select('id,name,status').single();
  if(error){
    if(error.code==='23505')return jsonErr('City or URL slug already exists.',409);
    console.error('[admin/cities] create failed',{code:error.code});
    return jsonErr('Could not add city.',503);
  }
  const audit=await db.from('audit_logs').insert({
    actor_id:auth.ctx.user.id,action:'city.create',entity:'cities',
    entity_id:data.id,meta:{name,state,slug,status:'waitlist'},
  });
  if(audit.error)console.error('[admin/cities] audit failed',{code:audit.error.code});
  revalidatePath('/service-areas');
  revalidatePath('/');
  return jsonOk(data,201);
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

  // An explicit admin launch accepts bookings; provider capacity controls dispatch independently.

  const {data,error}=await db.from('cities').update({status:parsed.data.status})
    .eq('id',city.id).eq('status',city.status).select('id,name,status').maybeSingle();
  if(error){console.error('[admin/cities] status update failed',{code:error.code});return jsonErr('City update failed.',503);}
  if(!data) return jsonErr('City changed during review. Refresh before saving.',409);
  const audit=await db.from('audit_logs').insert({
    actor_id:auth.ctx.user.id,action:'city.status_change',entity:'cities',
    entity_id:data.id,meta:{name:data.name,from:city.status,to:data.status},
  });
  if(audit.error) console.error('[admin/cities] audit logging failed',{code:audit.error.code});
  // Public service area and home pages must not keep the pre-activation RSC snapshot.
  revalidatePath('/service-areas');
  revalidatePath('/');
  revalidatePath('/services');
  revalidatePath('/book');
  return jsonOk(data);
}
