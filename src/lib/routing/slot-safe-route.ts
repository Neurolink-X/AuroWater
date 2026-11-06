export type RouteStop={id:string;lat:number|null;lng:number|null;scheduledAt:string|null;slotEndAt?:string|null;serviceMinutes?:number;label?:string};
export type PlannedStop=RouteStop&{sequence:number;travelKm:number|null;estimatedArrival:string;lateRisk:boolean};
export type RoutePlan={stops:PlannedStop[];excluded:string[];totalStraightLineKm:number;mode:'advisory'};
const earth=6371;
export function distanceKm(a:{lat:number;lng:number},b:{lat:number;lng:number}){
 const r=Math.PI/180,dLat=(b.lat-a.lat)*r,dLng=(b.lng-a.lng)*r;
 const h=Math.sin(dLat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLng/2)**2;
 return earth*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
const valid=(s:RouteStop):s is RouteStop&{lat:number;lng:number}=>{
 const {lat,lng}=s;
 return lat!==null&&lng!==null&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;
};
const time=(s:string|null|undefined)=>s?Date.parse(s):NaN;
/**
 * Conservative rolling plan for already accepted/assigned stops only.
 * Straight-line distance is a LOWER bound, not actual ETA. Route planning
 * cannot delay a customer's scheduled deadline or dispatch other providers' jobs.
 * Every provider is planned separately, at most 30 stops for linear scanning.
 */
export function planNearbyRoute(stops:readonly RouteStop[],now=new Date(),start?:{lat:number;lng:number}):RoutePlan{
 const filtered=stops.filter(valid).filter(s=>Number.isFinite(time(s.scheduledAt))&&
  (!s.slotEndAt||Number.isFinite(time(s.slotEndAt))));
 const included=new Set<RouteStop>(filtered);
 const excluded=stops.filter(s=>!included.has(s)).map(s=>s.id);
 const pending=[...filtered].slice(0,30);
 excluded.push(...filtered.slice(30).map(s=>s.id));
 const result:PlannedStop[]=[];
 let position=start??null, clock=now.getTime(),kmTotal=0;
 while(pending.length){
  // Deadline is the hard first key. Only optimize geographically within a
  // safe 30-minute deadline window so A->B->C can beat A->D->A.
  pending.sort((a,b)=>(time(a.slotEndAt)||time(a.scheduledAt))-(time(b.slotEndAt)||time(b.scheduledAt))||a.id.localeCompare(b.id));
  const deadline=time(pending[0].slotEndAt)||time(pending[0].scheduledAt);
  const eligible=pending.filter(s=>(time(s.slotEndAt)||time(s.scheduledAt))<=deadline+30*60_000);
  const next=eligible.sort((a,b)=>{
   const da=position?distanceKm(position,{lat:a.lat,lng:a.lng}):0;
   const db=position?distanceKm(position,{lat:b.lat,lng:b.lng}):0;
   return da-db||(time(a.slotEndAt)||time(a.scheduledAt))-(time(b.slotEndAt)||time(b.scheduledAt))||a.id.localeCompare(b.id);
  })[0];
  pending.splice(pending.findIndex(s=>s.id===next.id),1);
  const km=position?distanceKm(position,{lat:next.lat,lng:next.lng}):null;
  if(km!==null)kmTotal+=km;
  // 12km/h pessimistic URBAN planning speed plus 8 min per stop; actual
  // travel-time must be checked externally, so routes are advisory only.
  const travelMs=km===null?0:Math.ceil(km/12*3_600_000);
  const arrival=Math.max(clock+travelMs,time(next.scheduledAt));
  const end=time(next.slotEndAt);
  result.push({...next,sequence:result.length+1,travelKm:km===null?null:Math.round(km*10)/10,
   estimatedArrival:new Date(arrival).toISOString(),lateRisk:Number.isFinite(end)&&arrival>end});
  clock=arrival+Math.max(5,Math.min(180,next.serviceMinutes??8))*60000;
  position={lat:next.lat,lng:next.lng};
 }
 return {stops:result,excluded,totalStraightLineKm:Math.round(kmTotal*10)/10,mode:'advisory'};
}
