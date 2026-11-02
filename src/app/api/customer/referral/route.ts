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
 const {data:existing,error:existingError}=await db.from('supplier_referral_attributions').select('supplier_id,priority_expires_at').eq('customer_id',customerId).maybeSingle();
 if(existingError)return jsonErr('Unable to verify referral',503,'DB_ERROR');
 if(existing)return jsonOk({supplierId:existing.supplier_id,priorityExpiresAt:existing.priority_expires_at,alreadyConfirmed:true});
 const {data:supplier,error:supplierError}=await db.from('profiles').select('id,role,status,is_active').eq('id',supplierId).maybeSingle();
 if(supplierError||!supplier||supplier.role!=='supplier'||supplier.status!=='active'||supplier.is_active===false)return jsonErr('Supplier unavailable',404,'NOT_FOUND');
 const {data:priorOrders,error:orderError}=await db.from('orders').select('id').eq('customer_id',customerId).limit(1);
 if(orderError)return jsonErr('Unable to verify customer eligibility',503,'DB_ERROR');
 if(priorOrders?.length)return jsonErr('Referral registration is available before your first order',409,'ALREADY_CUSTOMER');
 const {data:inserted,error}=await db.from('supplier_referral_attributions').insert({customer_id:customerId,supplier_id:supplierId}).select('supplier_id,priority_expires_at').single();
 if(error){if(error.code==='23505')return jsonErr('Referral already registered',409,'ALREADY_REFERRED');return jsonErr('Unable to confirm referral',503,'DB_ERROR')}
 return jsonOk({supplierId:inserted.supplier_id,priorityExpiresAt:inserted.priority_expires_at,alreadyConfirmed:false});
}
