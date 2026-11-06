'use client';
import {useCallback,useEffect,useState} from 'react';
import {createClient} from '@/utils/supabase/client';
type Request={id:string;provider_id:string;service_key:string;previous_radius_km:number;requested_radius_km:number;status:string;reason:string;admin_note?:string|null;created_at:string};
export default function RadiusApprovalsPage(){
 const [items,setItems]=useState<Request[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState('');
 const authFetch=useCallback(async(method:'GET'|'PATCH',body?:unknown)=>{
  const sb=createClient();const {data}=await sb.auth.getSession();
  if(!data.session)throw Error('Sign in to review radius requests');
  const res=await fetch('/api/admin/radius-requests',{method,cache:'no-store',headers:{Authorization:'Bearer '+data.session.access_token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const json=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(json.error??'Request failed');
  return json.data??json;
 },[]);
 const reload=useCallback(async()=>{try{setError('');const d=await authFetch('GET');setItems(Array.isArray(d)?d:[])}catch(e){setError(e instanceof Error?e.message:'Could not load')}finally{setLoading(false)}},[authFetch]);
 useEffect(() => {
  const initial = window.setTimeout(() => { void reload(); }, 0);
  return () => window.clearTimeout(initial);
 }, [reload]);
 const review=async(r:Request,decision:'APPROVED'|'REJECTED')=>{
  const note=window.prompt(decision==='APPROVED'?'Review supplier capacity, approved PIN zones and reliable delivery, then enter your review note:':'Explain rejection:');
  if(note===null)return;
  if(decision==='REJECTED' && note.trim().length<3){setError('Rejection requires an explanation');return;}
  setBusy(r.id);try{await authFetch('PATCH',{request_id:r.id,decision,note});await reload()}catch(e){setError(e instanceof Error?e.message:'Review failed')}finally{setBusy('')}
 };
 return <main className="mx-auto max-w-5xl space-y-5 p-5 text-slate-900">
 <header><h1 className="text-2xl font-bold">Partner delivery radius approvals</h1><p className="text-sm text-slate-600">Radius does not approve PIN codes, cities, skills or customer orders. Review the supplier capacity and service commitments before expansion.</p></header>
 {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
 <button className="rounded-xl bg-slate-900 px-4 py-2 text-white" onClick={()=>void reload()}>Refresh</button>
 {loading?<p>Loading requests…</p>:items.filter(x=>x.status==='PENDING').length===0?<p>No pending radius requests.</p>:
 items.filter(x=>x.status==='PENDING').map(r=><article key={r.id} className="space-y-2 rounded-xl border bg-white p-5">
 <h2 className="font-bold">{r.service_key.replaceAll('_',' ')} · {r.previous_radius_km} → {r.requested_radius_km} km</h2>
 <p className="break-all text-xs text-slate-600">Provider ID: {r.provider_id}</p><p className="text-sm">{r.reason}</p>
 <p className="text-xs text-slate-500">Submitted {new Date(r.created_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}</p>
 <div className="flex flex-wrap gap-3"><button disabled={!!busy} onClick={()=>void review(r,'APPROVED')} className="rounded-xl bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">Approve</button><button disabled={!!busy} onClick={()=>void review(r,'REJECTED')} className="rounded-xl bg-red-800 px-4 py-2 text-white disabled:opacity-50">Reject</button></div>
 </article>)}
 <p className="text-xs text-slate-600">Decisions use an atomic server-side review, retaining original coverage until approval. Existing orders are unchanged.</p>
 </main>
}
