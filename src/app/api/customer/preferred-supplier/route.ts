import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { createServiceClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';
const schema = z.object({ supplierId: z.string().uuid() });
const db = () => createServiceClient();

/** Explicit customer consent. Never trust a supplier's claim to customer ownership. */
export async function POST(req: NextRequest) {
 const auth = await requireSupabaseAuth(req);
 if (!auth.ok) return auth.response;
 if (auth.ctx.profile.role !== 'customer') return jsonErr('Customer account required',403,'FORBIDDEN');
 const parsed = schema.safeParse(await req.json().catch(()=>null));
 if (!parsed.success) return jsonErr('Invalid supplier',400,'VALIDATION_ERROR');
 const customerId=auth.ctx.user.id, supplierId=parsed.data.supplierId;
 if(customerId===supplierId) return jsonErr('Invalid relationship',400,'VALIDATION_ERROR');
 const client=db();
 const {data: supplier,error: supplierError}=await client.from('profiles').select('id,role,is_active,status').eq('id',supplierId).maybeSingle();
 if(supplierError || !supplier || supplier.role!=='supplier' || supplier.is_active===false || (supplier.status && supplier.status!=='active')) return jsonErr('Supplier unavailable',404,'NOT_FOUND');
 const {error}=await client.rpc('set_customer_supplier_preference',{p_customer:customerId,p_supplier:supplierId,p_remove:false});
 if(error){console.error('[affinity] atomic save failed',error.code);return jsonErr('Could not save supplier preference',503,'DB_ERROR');}
 return jsonOk({preferredSupplierId:supplierId});

}
export async function GET(req:NextRequest) {
 const auth=await requireSupabaseAuth(req);
 if(!auth.ok)return auth.response;
 if(auth.ctx.profile.role!=='customer')return jsonErr('Customer account required',403,'FORBIDDEN');
 const {data,error}=await db().from('supplier_customer_relationships').select('supplier_id,status,priority_expires_at').eq('customer_id',auth.ctx.user.id).eq('status','active').order('priority_expires_at',{ascending:false}).limit(20);
 if(error)return jsonErr('Unable to load preferences',503,'DB_ERROR');
 return jsonOk({relationships:data??[]});
}
export async function DELETE(req:NextRequest) {
 const auth=await requireSupabaseAuth(req);
 if(!auth.ok)return auth.response;
 if(auth.ctx.profile.role!=='customer')return jsonErr('Customer account required',403,'FORBIDDEN');
 const parsed=schema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return jsonErr('Invalid supplier',400,'VALIDATION_ERROR');
 const {error}=await db().rpc('set_customer_supplier_preference',{p_customer:auth.ctx.user.id,p_supplier:parsed.data.supplierId,p_remove:true});
 if(error)return jsonErr('Unable to remove preference',503,'DB_ERROR');
 return jsonOk({revoked:true});
}
