import {NextRequest} from 'next/server';
import {requireSupabaseAuth} from '@/lib/api/supabase-request';
import {jsonErr,jsonOk} from '@/lib/api/json-response';
import {createServiceClient} from '@/utils/supabase/server';
import {planNearbyRoute,type RouteStop} from '@/lib/routing/slot-safe-route';
export const dynamic='force-dynamic';
/** Provider-only schedule suggestions. Never sends an unaccepted order address. */
export async function GET(req:NextRequest){
 const auth=await requireSupabaseAuth(req);if(!auth.ok)return auth.response;
 const role=String(auth.ctx.profile.role??'');
 if(!['supplier','technician','plumber'].includes(role))return jsonErr('Provider only',403);
 const id=auth.ctx.profile.id,db=createServiceClient();
 const field=role==='supplier'?'supplier_id':'technician_id';
 const since=new Date(Date.now()-20*60_000).toISOString();
 const until=new Date(Date.now()+48*3600_000).toISOString();
 const {data:orders,error}=await db.from('orders')
  .select('id,status,service_type,scheduled_at,accepted_at,address_id,can_count')
  .eq(field,id).in('status',['ASSIGNED','IN_PROGRESS'])
  .gte('scheduled_at',since).lte('scheduled_at',until)
  .order('scheduled_at',{ascending:true}).limit(31);
 if(error)return jsonErr('Schedule temporarily unavailable',503);
 if((orders??[]).length>30)return jsonOk({stops:[],note:'More than 30 active stops. View individual orders while the route is refreshed.',limited:true});
 const accepted=(orders??[]).filter(o=>o.accepted_at||o.status==='IN_PROGRESS');
 if(!accepted.length)return jsonOk({stops:[],note:'Accept your assigned orders to see a suggested route.'});
 const ids=[...new Set(accepted.map(o=>o.address_id).filter((x):x is string=>typeof x==='string'&&x.length>0))];
 if(!ids.length)return jsonOk({stops:[],note:'Order locations are not verified.'});
 const {data:addresses,error:addressError}=await db.from('addresses')
  .select('id,lat,lng,pincode,area,city').in('id',ids).limit(30);
 if(addressError)return jsonErr('Verified locations unavailable',503);
 const addr=new Map((addresses??[]).map(a=>[a.id,a]));
 const now=new Date();
 const jobs:RouteStop[]=accepted.map(o=>{
  const a=addr.get(o.address_id);
  const start=o.scheduled_at?Date.parse(o.scheduled_at):NaN;
  const duration=o.service_type==='water_can'?8:
   o.service_type==='borewell'?120:o.service_type==='tank_cleaning'?90:45;
  return{id:o.id,lat:a?.lat==null?null:Number(a.lat),
    lng:a?.lng==null?null:Number(a.lng),
    scheduledAt:Number.isFinite(start)?new Date(start).toISOString():null,
    // A point-in-time booking does not prove a full slot window. Show a
    // conservative risk estimate, never promise an unverified customer ETA.
    slotEndAt:Number.isFinite(start)?new Date(start+60*60_000).toISOString():null,
    serviceMinutes:duration,label:[a?.area,a?.pincode].filter(Boolean).join(' · ')||'Assigned location'};
 });
 const result=planNearbyRoute(jobs,now);
 const res=jsonOk({stops:result.stops.map(s=>({
  order_id:s.id,sequence:s.sequence,area:s.label,
  estimated_arrival:s.estimatedArrival,estimated_travel_km:s.travelKm,
  scheduled_at:s.scheduledAt,late_risk:s.lateRisk
 })),excluded_count:result.excluded.length,mode:'advisory',
 note:'Nearby route suggestion only. Distance is straight-line; traffic and actual time-slot boundaries are not verified. Always fulfil confirmed customer slots and check live navigation.'});
 res.headers.set('Cache-Control','private, no-store');return res;
}
