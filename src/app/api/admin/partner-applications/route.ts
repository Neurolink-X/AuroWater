import {NextRequest} from 'next/server';
import {z} from 'zod';
import {jsonErr,jsonOk} from '@/lib/api/json-response';
import {requireSupabaseAuth,requireAdmin} from '@/lib/api/supabase-request';
import {createServiceClient} from '@/utils/supabase/server';
export const dynamic='force-dynamic';
const decision=z.object({application_id:z.string().uuid(),decision:z.enum(['approved','rejected']),note:z.string().trim().min(3).max(300)});
async function authorize(req:NextRequest){const a=await requireSupabaseAuth(req);if(!a.ok)return {response:a.response} as const;if(!requireAdmin(a.ctx))return {response:jsonErr('Forbidden',403)} as const;return {id:a.ctx.profile.id} as const;}
export async function GET(req:NextRequest){
 const gate=await authorize(req);if('response' in gate)return gate.response;
 const {data,error}=await createServiceClient().from('applications')
 .select('id,user_id,type,status,payload,created_at').eq('type','technician').order('created_at',{ascending:false}).limit(150);
 if(error)return jsonErr('Could not load specialist applications',503);
 const res=jsonOk(data??[]);res.headers.set('Cache-Control','private, no-store');return res;
}
export async function PATCH(req:NextRequest){
 const gate=await authorize(req);if('response' in gate)return gate.response;
 let body:unknown;try{body=await req.json()}catch{return jsonErr('Invalid JSON',400)}
 const parsed=decision.safeParse(body);if(!parsed.success)return jsonErr(parsed.error.issues[0]?.message??'Invalid review',422);
 const {data,error}=await createServiceClient().rpc('review_partner_technician_application',{
  p_application_id:parsed.data.application_id,p_admin_id:gate.id,p_decision:parsed.data.decision,p_note:parsed.data.note
 });
 if(error){console.error('[admin/partner-applications] review failed',{code:error.code});return jsonErr(error.code==='P0001'?error.message:'Application review unavailable; no partial changes were applied.',error.code==='P0001'?409:503)}
 // The atomic database decision is authoritative. Notify the applicant only
 // after the RPC commits; a failed alert must never roll back approval.
 try {
  const db=createServiceClient();
  const {data:app}=await db.from('applications')
   .select('user_id').eq('id',parsed.data.application_id).maybeSingle();
  if(app?.user_id){
   const status=parsed.data.decision;
   const {error:notifyError}=await db.from('notifications').upsert({
    user_id:app.user_id, type:'system',
    title:status==='approved'?'Professional account approved':'Partner application needs attention',
    message:status==='approved'
      ?'Your verification was approved. Open your professional dashboard to get started.'
      :'Your partner application was not approved. See the reason in your application status page.',
    data:{application_id:parsed.data.application_id,url:'/register/pro/success'},
    is_read:false,
    dedup_key:'partner_'+parsed.data.application_id+'_'+status+'_'+app.user_id,
   },{onConflict:'dedup_key',ignoreDuplicates:true});
   if(notifyError)console.error('[partner-review] applicant notification unavailable',notifyError.code);
  }
 }catch(e){console.error('[partner-review] applicant notification failed',e instanceof Error?e.message:'unknown')}
 return jsonOk(data);
}
