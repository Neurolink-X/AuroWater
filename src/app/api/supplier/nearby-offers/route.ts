import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonErr,jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth,requireRole } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
export const dynamic='force-dynamic';
const claim=z.object({offer_id:z.string().uuid()});
export async function GET(req:NextRequest){
 const auth=await requireSupabaseAuth(req);if(!auth.ok)return auth.response;
 if(!requireRole(auth.ctx,'supplier'))return jsonErr('Supplier only',403);
 const db=createServiceClient();
 const {data,error}=await db.from('order_supplier_offers')
 .select('id,order_id,distance_km,expires_at,created_at').eq('supplier_id',auth.ctx.profile.id)
 .eq('status','OPEN').gt('expires_at',new Date().toISOString()).order('expires_at',{ascending:true}).limit(20);
 if(error)return jsonErr('Nearby offers unavailable',503);
 const res=jsonOk(data??[]);res.headers.set('Cache-Control','private, no-store');return res;
}
export async function POST(req:NextRequest){
 const auth=await requireSupabaseAuth(req);if(!auth.ok)return auth.response;
 if(!requireRole(auth.ctx,'supplier'))return jsonErr('Supplier only',403);
 const p=claim.safeParse(await req.json().catch(()=>null));
 if(!p.success)return jsonErr('Invalid offer',422);
 const db=createServiceClient();
 const {data,error}=await db.rpc('claim_parallel_water_offer',{p_offer_id:p.data.offer_id,p_supplier_id:auth.ctx.profile.id});
 if(error){console.error('[supplier/nearby-offers] atomic claim failed',error.code);return jsonErr('Could not verify availability and stock; try another order',409);}
 if(!data)return jsonErr('Already accepted by another supplier, expired, or no longer eligible',409);
 return jsonOk({claimed:true,message:'Order assigned. Open Orders to accept delivery.'});
}
