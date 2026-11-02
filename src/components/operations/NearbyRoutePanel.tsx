'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {createClient} from '@/lib/supabase/client';
type Stop={order_id:string;sequence:number;area:string;estimated_arrival:string;scheduled_at:string;estimated_travel_km:number|null;late_risk:boolean};
export default function NearbyRoutePanel({role}:{role:'supplier'|'technician'}){
 const [stops,setStops]=useState<Stop[]>([]),[note,setNote]=useState('');
 const [loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{
  try{
   const{data}=await createClient().auth.getSession();
   if(!data.session){setNote('Sign in to view your route');return;}
   const res=await fetch('/api/partner/route-plan',{cache:'no-store',headers:{Authorization:'Bearer '+data.session.access_token}});
   const body=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(body.error??'Route unavailable');
   setStops(body.data?.stops??[]);setNote(body.data?.note??'');
  }catch(e){setNote(e instanceof Error?e.message:'Route unavailable');}finally{setLoading(false);}
 },[]);
 useEffect(()=>{void refresh();const onFocus=()=>{if(document.visibilityState==='visible')void refresh()};
 document.addEventListener('visibilitychange',onFocus);return()=>document.removeEventListener('visibilitychange',onFocus)},[refresh]);
 return <section className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 sm:p-5">
  <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Nearby jobs · Suggested route</h2>
   <button type="button" onClick={()=>void refresh()} className="rounded-lg border px-3 py-2 text-sm">Refresh</button></div>
  <p className="mt-1 text-sm text-slate-600">Only your accepted orders. Urgent slots before nearby convenience. No automatic rescheduling.</p>
  {loading?<p className="mt-3 text-sm">Loading route…</p>:stops.length===0?<p className="mt-3 text-sm">No accepted stops to plan.</p>:
   <ol className="mt-3 space-y-2">{stops.map(s=><li key={s.order_id} className="rounded-xl border p-3">
    <p className="font-semibold">{s.sequence}. {s.area||'Assigned area'} {s.late_risk?'· Time risk':''}</p>
    <p className="text-xs text-slate-600">Scheduled: {new Date(s.scheduled_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} · Estimated arrival: {new Date(s.estimated_arrival).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata'})} · Straight-line from previous stop: {s.estimated_travel_km??'Not estimated'} km</p>
    <Link className="mt-2 inline-block text-sm font-semibold text-blue-700 underline" href={role==='supplier'?'/supplier/orders':`/technician/job/${encodeURIComponent(s.order_id)}`}>Open assigned order</Link>
   </li>)}</ol>}
  {note&&<p className="mt-3 text-xs text-slate-600">{note}</p>}
 </section>;
}
