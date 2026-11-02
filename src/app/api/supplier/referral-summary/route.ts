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
 const {data,error}=await createServiceClient().from('supplier_customer_relationships')
 .select('status,priority_expires_at,created_at').eq('supplier_id',auth.ctx.user.id).limit(1000);
 if(error)return jsonErr('Unable to load referral summary',503,'DB_ERROR');
 const rows=data??[];
 return jsonOk({referred:rows.length,active:rows.filter(r=>r.status==='active' && r.priority_expires_at>now).length,
 expired:rows.filter(r=>r.status==='expired'||(r.priority_expires_at && r.priority_expires_at<=now)).length,
 // Never expose unassigned customers' contact details to suppliers.
 privacy:'Customer contact details are available only on assigned orders.',
 policy:'Priority for 90 days after customer confirmation, subject to stock, service area, availability and customer choice.'});
}
