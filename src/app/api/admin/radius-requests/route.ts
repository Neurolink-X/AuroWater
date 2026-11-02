import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSupabaseAuth, requireAdmin } from '@/lib/api/supabase-request';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { createServiceClient } from '@/utils/supabase/server';
export const dynamic = 'force-dynamic';
const review = z.object({ request_id:z.string().uuid(), decision:z.enum(['APPROVED','REJECTED']), note:z.string().trim().max(500).default('') });
async function gate(req:NextRequest) {
  const auth=await requireSupabaseAuth(req);
  if(!auth.ok) return {response:auth.response} as const;
  if(!requireAdmin(auth.ctx)) return {response:jsonErr('Admin only',403)} as const;
  return {id:auth.ctx.profile.id} as const;
}
export async function GET(req:NextRequest) {
  const g=await gate(req);if('response' in g)return g.response;
  const {data,error}=await createServiceClient().from('partner_radius_requests')
    .select('id,provider_id,service_key,requested_radius_km,previous_radius_km,reason,status,admin_note,created_at,reviewed_at')
    .order('created_at',{ascending:false}).limit(100);
  if(error)return jsonErr('Radius approval queue unavailable',503);
  const res=jsonOk(data??[]);res.headers.set('Cache-Control','private, no-store');return res;
}
export async function PATCH(req:NextRequest) {
  const g=await gate(req);if('response' in g)return g.response;
  const parsed=review.safeParse(await req.json().catch(()=>null));
  if(!parsed.success)return jsonErr('Invalid review',422);
  if(parsed.data.decision==='REJECTED' && parsed.data.note.length<3) return jsonErr('Provide a rejection reason',422);
  const {data,error}=await createServiceClient().rpc('review_partner_radius_request',{
    p_request_id:parsed.data.request_id,p_admin_id:g.id,p_decision:parsed.data.decision,p_note:parsed.data.note
  });
  if(error)return jsonErr('Review failed. Request may already be handled or settings changed.',409);
  return jsonOk(data);
}
