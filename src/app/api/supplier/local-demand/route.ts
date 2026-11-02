import { NextRequest } from 'next/server';
import {jsonErr,jsonOk} from '@/lib/api/json-response';
import {requireSupabaseAuth,requireRole} from '@/lib/api/supabase-request';
import {createServiceClient} from '@/utils/supabase/server';
export const dynamic='force-dynamic';
/** Privacy-preserving demand report: no individual customer, building, contact, or address data. */
export async function GET(req:NextRequest){
 const a=await requireSupabaseAuth(req);if(!a.ok)return a.response;
 if(!requireRole(a.ctx,'supplier'))return jsonErr('Supplier only',403);
 const city=String(a.ctx.profile.city??'').trim();
 if(!city)return jsonErr('Registered city needed',422);
 const db=createServiceClient();
 const since=new Date(Date.now()-30*86400000).toISOString();
 const {data:zones,error:ze}=await db.from('service_zones').select('id,name,city,status,services')
  .ilike('city',city).in('status',['AVAILABLE','LIMITED']).limit(300);
 if(ze)return jsonErr('Zone intelligence temporarily unavailable',503);
 const zoneIds=(zones??[]).filter(z=>z.services===null||z.services.includes('water_can')).map(z=>z.id);
 if(!zoneIds.length)return jsonOk({period_days:30,areas:[]});
 const {data:orders,error}=await db.from('orders').select('zone_id,customer_id,can_count,status')
  .in('zone_id',zoneIds).eq('service_type','water_can').gte('created_at',since).limit(2001);
 if(error)return jsonErr('Demand intelligence unavailable',503);
 // Never publish misleading partial data; also prevent inference of individual residents.
 if((orders?.length??0)>2000)return jsonOk({period_days:30,areas:[],note:'Demand sample exceeds safe reporting limit.'});
 const counts=new Map<string,{customers:Set<string>;orders:number;cans:number}>();
 for(const o of orders??[]){
  if(!o.zone_id||!o.customer_id||o.status==='FAILED')continue;
  const x=counts.get(o.zone_id)??{customers:new Set<string>(),orders:0,cans:0};
  x.customers.add(o.customer_id);x.orders++;x.cans+=Math.max(0,Math.min(500,Number(o.can_count??0)));
  counts.set(o.zone_id,x);
 }
 const areas=(zones??[]).flatMap(z=>{const x=counts.get(z.id);
  if(!x||x.customers.size<5||x.orders<5)return [];
  return [{area:z.name,orders_30d:x.orders,cans_30d:x.cans,city:z.city}];
 }).sort((a,b)=>b.orders_30d-a.orders_30d).slice(0,25);
 const res=jsonOk({period_days:30,areas,note:'Aggregated historical demand only. Not a promise of future orders or PIN approval.'});
 res.headers.set('Cache-Control','private, no-store');return res;
}
