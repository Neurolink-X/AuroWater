import {NextRequest} from 'next/server';
import {z} from 'zod';
import {jsonErr,jsonOk} from '@/lib/api/json-response';
import {requireSupabaseAuth,requireAdmin} from '@/lib/api/supabase-request';
import {createServiceClient} from '@/utils/supabase/server';
export const dynamic='force-dynamic';
const update=z.object({technician_id:z.string().uuid(),service_key:z.enum(['plumbing','ro_service','borewell','motor_pump','tank_cleaning','installation','maintenance']),status:z.enum(['approved','rejected','suspended']),reason:z.string().trim().min(3).max(300)});
async function access(req:NextRequest){const a=await requireSupabaseAuth(req);if(!a.ok)return {response:a.response} as const;if(!requireAdmin(a.ctx))return {response:jsonErr('Forbidden',403)} as const;return {adminId:a.ctx.profile.id} as const}
export async function GET(req:NextRequest){const g=await access(req);if('response' in g)return g.response;const {data,error}=await createServiceClient().from('technician_service_capabilities').select('technician_id,service_key,status,reviewed_at').limit(300);if(error)return jsonErr('Capabilities unavailable',503);const r=jsonOk(data??[]);r.headers.set('Cache-Control','private, no-store');return r}
export async function PATCH(req:NextRequest){
 const g=await access(req);if('response' in g)return g.response;
 let raw:unknown;try{raw=await req.json()}catch{return jsonErr('Invalid JSON',400)}
 const p=update.safeParse(raw);if(!p.success)return jsonErr(p.error.issues[0]?.message??'Invalid input',422);
 const d=p.data,db=createServiceClient();
 const {data:profile,error:profileError}=await db.from('profiles').select('id,role').eq('id',d.technician_id).maybeSingle();
 if(profileError)return jsonErr('Technician lookup unavailable',503);
 if(!profile||profile.role!=='technician')return jsonErr('Technician not found',404);
 const {data:reviewResult,error}=await db.rpc('review_technician_capability',{
   p_admin_id:g.adminId,p_technician_id:d.technician_id,p_service_key:d.service_key,
   p_status:d.status,p_reason:d.reason
 });
 if(error){console.error('[admin/capabilities] atomic review failed',{code:error.code});
  return jsonErr(error.code==='P0001'?error.message:'Unable to review specialist qualification; no partial change saved.',error.code==='P0001'?409:503)}

 return jsonOk(reviewResult);
}
