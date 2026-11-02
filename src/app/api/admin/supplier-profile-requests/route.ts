import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
export const dynamic = 'force-dynamic';
const review=z.object({request_id:z.string().uuid(),status:z.enum(['APPROVED','REJECTED']),admin_note:z.string().trim().max(500).default('')});
async function gate(req:NextRequest) {
 const auth=await requireSupabaseAuth(req);
 if(!auth.ok)return {response:auth.response} as const;
 if(auth.ctx.profile.role!=='admin')return {response:jsonErr('Admin only',403)} as const;
 return {adminId:auth.ctx.profile.id} as const;
}
export async function GET(req:NextRequest) {
 const g=await gate(req);if('response' in g)return g.response;
 const db=createServiceClient();
 const {data,error}=await db.from('supplier_profile_change_requests').select('id,supplier_id,requested_changes,status,admin_note,created_at').order('created_at',{ascending:false}).limit(100);
 if(error)return jsonErr('Shop review queue unavailable',503);
 const ids=[...new Set((data??[]).map(r=>r.supplier_id))];
 const {data:profiles,error:profileError}=ids.length?await db.from('profiles').select('id,full_name,phone,city').in('id',ids):{data:[],error:null};
 if(profileError)return jsonErr('Supplier data unavailable',503);
 const byId=new Map((profiles??[]).map(p=>[p.id,p]));
 const res=jsonOk((data??[]).map(r=>({...r,profiles:byId.get(r.supplier_id)??null})));
 res.headers.set('Cache-Control','private, no-store');return res;
}
export async function PATCH(req:NextRequest) {
 const g=await gate(req);if('response' in g)return g.response;
 let raw:unknown;try{raw=await req.json()}catch{return jsonErr('Invalid JSON',400)}
 const parsed=review.safeParse(raw);if(!parsed.success)return jsonErr('Invalid review request',422);
 const {request_id,status,admin_note}=parsed.data;
 if(status==='REJECTED' && admin_note.length<3)return jsonErr('Explain the rejection',422);
 const {data,error}=await createServiceClient().rpc('review_supplier_shop_change',{p_request_id:request_id,p_admin_id:g.adminId,p_decision:status,p_note:admin_note});
 if(error){console.error('[admin/shop] atomic review failed',{code:error.code});return jsonErr(error.code==='P0001'?'Invalid or already-reviewed request; verify shop city and PIN.':'Shop approval unavailable. No partial changes applied.',error.code==='P0001'?409:503)}
 const res=jsonOk(data);res.headers.set('Cache-Control','private, no-store');return res;
}
