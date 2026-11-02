import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSupabaseAuth, requireRole } from '@/lib/api/supabase-request';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { createServiceClient } from '@/utils/supabase/server';
import { TECHNICIAN_RADIUS_DEFAULTS,TECHNICIAN_RADIUS_MAX,technicianRadius } from '@/lib/technician-service-radius';
export const dynamic='force-dynamic';
const payload=z.object({service_key:z.enum(['plumbing','ro_service','motor_pump','borewell','tank_cleaning']),radius_km:z.number().int().min(1).max(75),reason:z.string().trim().max(500).optional()});
async function context(req:NextRequest){
 const auth=await requireSupabaseAuth(req);
 if(!auth.ok)return {response:auth.response} as const;
 if(!requireRole(auth.ctx,'technician'))return {response:jsonErr('Technician only',403)} as const;
 return {id:auth.ctx.profile.id} as const;
}
export async function GET(req:NextRequest){
 const c=await context(req);if('response' in c)return c.response;
 const db=createServiceClient();
 const [caps,radii,requests]=await Promise.all([
  db.from('technician_service_capabilities').select('service_key').eq('technician_id',c.id).eq('status','approved'),
  db.from('technician_service_radii').select('service_key,radius_km').eq('technician_id',c.id),
  db.from('partner_radius_requests').select('id,service_key,requested_radius_km,status,created_at,admin_note').eq('provider_id',c.id).order('created_at',{ascending:false}).limit(20)
 ]);
 if(caps.error||radii.error||requests.error)return jsonErr('Could not load your coverage settings',503);
 const values=new Map((radii.data??[]).map(r=>[r.service_key,r.radius_km]));
 const result=(caps.data??[]).map(c=>({service_key:c.service_key,radius_km:technicianRadius(c.service_key,values.get(c.service_key)),default_km:TECHNICIAN_RADIUS_DEFAULTS[c.service_key],max_km:TECHNICIAN_RADIUS_MAX[c.service_key]}));
 const res=jsonOk({services:result,requests:requests.data??[]});res.headers.set('Cache-Control','private, no-store');return res;
}
export async function PUT(req:NextRequest){
 const c=await context(req);if('response' in c)return c.response;
 const parsed=payload.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return jsonErr('Invalid radius',422);
 const {service_key,radius_km,reason}=parsed.data;
 const db=createServiceClient();
 const {data:cap,error:capError}=await db.from('technician_service_capabilities').select('status').eq('technician_id',c.id).eq('service_key',service_key).eq('status','approved').maybeSingle();
 if(capError)return jsonErr('Could not verify service approval',503);
 if(!cap)return jsonErr('Service is not approved for this account',403);
 const defaultKm=TECHNICIAN_RADIUS_DEFAULTS[service_key];
 const selfMax=service_key==='borewell'||service_key==='tank_cleaning'?50:30;
 if(radius_km>selfMax){
  if(!reason||reason.length<15)return jsonErr('Explain how you will reliably fulfil jobs across this radius (15+ characters)',422);
  const {data:existing,error:existingError}=await db.from('partner_radius_requests').select('id').eq('provider_id',c.id).eq('service_key',service_key).eq('status','PENDING').maybeSingle();
  if(existingError)return jsonErr('Approval queue unavailable',503);
  if(existing)return jsonErr('A request for this service is already pending',409);
  const {data:old,error:oldError}=await db.from('technician_service_radii').select('radius_km').eq('technician_id',c.id).eq('service_key',service_key).maybeSingle();
  if(oldError)return jsonErr('Coverage unavailable',503);
  const {error}=await db.from('partner_radius_requests').insert({provider_id:c.id,service_key,requested_radius_km:radius_km,previous_radius_km:old?.radius_km??defaultKm,reason});
  if(error)return jsonErr('Could not submit approval request',error.code==='23505'?409:503);
  return jsonOk({review_required:true,message:'Radius request submitted to admin. Current coverage remains unchanged.'});
 }
 const {error}=await db.from('technician_service_radii').upsert({technician_id:c.id,service_key,radius_km},{onConflict:'technician_id,service_key'});
 if(error)return jsonErr('Could not save radius',503);
 return jsonOk({service_key,radius_km,review_required:false});
}
