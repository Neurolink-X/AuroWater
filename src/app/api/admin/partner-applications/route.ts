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
 const db=createServiceClient();
 // Both supplier and specialist requests belong to the existing Pending Approvals inbox.
 // Recent new requests should appear without older pending requests hiding them.
 const {data,error}=await db.from('applications')
  .select('id,user_id,type,status,payload,created_at')
  .in('type',['technician','supplier'])
  .in('status',['pending','pending_approval'])
  .order('created_at',{ascending:false}).limit(150);
 if(error)return jsonErr('Could not load partner applications',503);
 const userIds=[...new Set((data??[]).map(a=>a.user_id).filter((id):id is string=>Boolean(id)))];
 const [{data:profiles,error:profileError},{data:docs,error:docError}]=await Promise.all([
  userIds.length?db.from('profiles').select('id,full_name,email,phone,role,city,status').in('id',userIds):Promise.resolve({data:[],error:null}),
  userIds.length?db.from('user_files').select('owner_user_id,document_slot,review_status,created_at').in('owner_user_id',userIds).not('document_slot','is',null).order('created_at',{ascending:false}).limit(1000):Promise.resolve({data:[],error:null}),
 ]);
 if(profileError||docError)return jsonErr('Partner verification summary unavailable',503);
 const byId=new Map((profiles??[]).map(p=>[p.id,p]));
 const readiness=new Map<string,Set<string>>();
 const seen=new Set<string>();
 // Later rejected replacements override previously approved KYC evidence.
 for(const file of docs??[]){
  if(!file.document_slot)continue;
  const key=file.owner_user_id+':'+file.document_slot;
  if(seen.has(key))continue;
  seen.add(key);
  if(file.review_status!=='approved')continue;
  const slots=readiness.get(file.owner_user_id)??new Set<string>();
  slots.add(file.document_slot);
  readiness.set(file.owner_user_id,slots);
 }
 const rows=(data??[]).map(app=>({
  ...app,
  applicant:byId.get(app.user_id)??null,
  approved_document_slots:[...(readiness.get(app.user_id)??new Set<string>())],
  // Supplier approval is handled by its established account/KYC process, never technician RPC.
  review_supported:app.type==='technician',
 }));
 const res=jsonOk(rows);res.headers.set('Cache-Control','private, no-store');return res;
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
