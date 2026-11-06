'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {createClient} from '@/lib/supabase/client';
type Stop={order_id:string;sequence:number;area:string;estimated_arrival:string;scheduled_at:string;estimated_travel_km:number|null;late_risk:boolean;status:string;service:string;slot_end_verified:boolean};
type Stats={awaiting_acceptance:number;accepted:number;in_progress:number;without_verified_location:number;without_schedule:number;limited:boolean};
export default function NearbyRoutePanel({role}:{role:'supplier'|'technician'}){
 const [stops,setStops]=useState<Stop[]>([]),[note,setNote]=useState(''),[stats,setStats]=useState<Stats|null>(null);
 const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[checkedAt,setCheckedAt]=useState('');
 const inFlight=useRef(false),mounted=useRef(true);
 const refresh=useCallback(async()=>{
  if(inFlight.current)return;
  inFlight.current=true;setRefreshing(true);
  try{
   const{data}=await createClient().auth.getSession();
   if(!data.session){setNote('Sign in to view your route');return;}
   const res=await fetch('/api/partner/route-plan',{cache:'no-store',headers:{Authorization:'Bearer '+data.session.access_token}});
   const body=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(body.error??'Route unavailable');
   if(!mounted.current)return;
   setStops(body.data?.stops??[]);setNote(body.data?.note??'');setStats(body.data?.stats??null);setCheckedAt(body.data?.checked_at??'');
  }catch(e){if(mounted.current)setNote(e instanceof Error?e.message:'Route temporarily unavailable');}
  finally{inFlight.current=false;if(mounted.current){setLoading(false);setRefreshing(false);}}
 },[]);
 useEffect(()=>{mounted.current=true;
   const initial = window.setTimeout(() => { void refresh(); }, 0);
  const onVisible=()=>{if(document.visibilityState==='visible'&&navigator.onLine)void refresh()};
  const timer=window.setInterval(onVisible,30000);
  document.addEventListener('visibilitychange',onVisible);window.addEventListener('online',onVisible);
  return()=>{mounted.current=false;window.clearTimeout(initial);window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('online',onVisible)};
 },[refresh]);
 const timing=(iso:string)=>new Date(iso).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'});
 return <section className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 sm:p-5">
 <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Nearby jobs · Suggested route</h2>
  <button type="button" onClick={()=>void refresh()} disabled={refreshing} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{refreshing?'Refreshing…':'Refresh'}</button></div>
 <p className="mt-1 text-sm text-slate-600">Accepted jobs only. Geographic advice never changes promised delivery slots or customer assignment.</p>
 {stats&&<div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
  <p className="rounded-lg bg-slate-100 p-2">Accepted: <strong>{stats.accepted}</strong></p>
  <p className="rounded-lg bg-slate-100 p-2">In progress: <strong>{stats.in_progress}</strong></p>
  <p className="rounded-lg bg-slate-100 p-2">Awaiting response: <strong>{stats.awaiting_acceptance}</strong></p>
  <p className="rounded-lg bg-slate-100 p-2">Location missing: <strong>{stats.without_verified_location}</strong></p>
 </div>}
 {loading?<p className="mt-3 text-sm">Loading route…</p>:stops.length===0?<p className="mt-3 text-sm">No accepted stops with verified location and schedule.</p>:
  <ol className="mt-3 space-y-2">{stops.map(s=><li key={s.order_id} className="rounded-xl border p-3">
   <p className="font-semibold">{s.sequence}. {s.area||'Assigned area'} · {s.status.replaceAll('_',' ')}</p>
   <p className="text-xs text-slate-600">{s.service.replaceAll('_',' ')} · Scheduled: {timing(s.scheduled_at)} IST · Planning estimate: {timing(s.estimated_arrival)} IST · Straight-line: {s.estimated_travel_km??'Not estimated'} km</p>
   <Link className="mt-2 inline-block text-sm font-semibold text-blue-700 underline" href={role==='supplier'?'/supplier/orders':`/technician/job/${encodeURIComponent(s.order_id)}`}>Open assigned order</Link>
  </li>)}</ol>}
 {note&&<p role="status" className="mt-3 text-xs text-slate-600">{note}</p>}
 {checkedAt&&<p className="mt-2 text-xs text-slate-500">Last updated {timing(checkedAt)} IST</p>}
 </section>;
}
