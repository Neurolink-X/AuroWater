import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { createServiceClient } from '@/utils/supabase/server';
export const dynamic = 'force-dynamic';
const schema=z.object({supplierId:z.string().uuid()});
/** A customer explicitly confirms their original referring supplier, once.
 * Existing order customers cannot be retroactively claimed by a supplier.
 */
export async function POST(req:NextRequest){
 const auth=await requireSupabaseAuth(req);
 if(!auth.ok)return auth.response;
 if(auth.ctx.profile.role!=='customer')return jsonErr('Customer account required',403,'FORBIDDEN');
 const parsed=schema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return jsonErr('Invalid referral',400,'VALIDATION_ERROR');
 const customerId=auth.ctx.user.id,supplierId=parsed.data.supplierId;
 if(customerId===supplierId)return jsonErr('Self-referral not allowed',400,'VALIDATION_ERROR');
 const db=createServiceClient();
 const {data,error}=await db.rpc('confirm_customer_supplier_referral',{p_customer:customerId,p_supplier:supplierId});
 if(error){console.error('[referral] confirmation failed',error.code);return jsonErr('Referral cannot be confirmed. Check eligibility and try again.',409,'REFERRAL_NOT_ELIGIBLE');}
 const result=data?.[0];
 if(!result)return jsonErr('Referral confirmation unavailable',503,'DB_ERROR');
 return jsonOk({supplierId:result.supplier_id,priorityExpiresAt:result.priority_expires_at,alreadyConfirmed:result.already_confirmed});
}
