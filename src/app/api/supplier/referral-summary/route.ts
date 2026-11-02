import { NextRequest } from 'next/server';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { jsonErr,jsonOk } from '@/lib/api/json-response';
import { createServiceClient } from '@/utils/supabase/server';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest) {
 const auth=await requireSupabaseAuth(req);
 if(!auth.ok)return auth.response;
 if(auth.ctx.profile.role!=='supplier')return jsonErr('Supplier account required',403,'FORBIDDEN');
 const now=new Date().toISOString();
 const client=createServiceClient();
 const {data:attributions,error}=await client.from('supplier_referral_attributions')
 .select('priority_expires_at').eq('supplier_id',auth.ctx.user.id).limit(1000);
 if(error)return jsonErr('Unable to load referral summary',503,'DB_ERROR');
 const rows=attributions??[];
 return jsonOk({referred:rows.length,active:rows.filter(r=>r.priority_expires_at>now).length,
 expired:rows.filter(r=>r.priority_expires_at<=now).length,
 referralUrl:`https://www.aurotap.in/customer/referral?supplier=${encodeURIComponent(auth.ctx.user.id)}`,
 privacy:'Customer contact details are available only on assigned orders.',
 policy:'First-time customers can confirm your referral before their first order. Eligible orders prioritize you for 90 days. Customer choice, stock, service area and availability always take precedence.'});
}
