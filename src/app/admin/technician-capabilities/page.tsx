'use client';
import {useCallback,useEffect,useState} from 'react';
import {toast} from 'sonner';
import {createClient} from '@/utils/supabase/client';
type Application={id:string;user_id:string;type:string;status:string;created_at:string;payload:Record<string,unknown>|null};
type Capability={technician_id:string;service_key:string;status:string};
const SERVICES=['plumbing','borewell','tank_cleaning','motor_pump','ro_service','installation','maintenance'];
async function request(path:string,method='GET',body?:unknown){
 const {data:{session}}=await createClient().auth.getSession();
 const res=await fetch(path,{method,headers:{'Content-Type':'application/json',...(session?.access_token?{Authorization:`Bearer ${session.access_token}`}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const json=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(String(json.error??json.message??'Request failed'));
 return json.data??json;
}
export default function SpecialistReviewPage(){
 const [apps,setApps]=useState<Application[]>([]);
 const [caps,setCaps]=useState<Capability[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState('');
 const [manualId,setManualId]=useState('');
 const [service,setService]=useState('tank_cleaning');
 const [reason,setReason]=useState('');
 const refresh=useCallback(async()=>{
  setLoading(true);
  try{
   const [applications,capabilities]=await Promise.all([
    request('/api/admin/partner-applications'),request('/api/admin/technician-capabilities')
   ]);
   setApps(Array.isArray(applications)?applications:[]);
   setCaps(Array.isArray(capabilities)?capabilities:[]);
  }catch(e){toast.error(e instanceof Error?e.message:'Could not load specialist approvals')}
  finally{setLoading(false)}
 },[]);
 useEffect(() => {
  const initial = window.setTimeout(() => { void refresh(); }, 0);
  return () => window.clearTimeout(initial);
 }, [refresh]);
 async function review(id:string,status:'approved'|'rejected'){
  const note=window.prompt(status==='approved'
    ? 'Describe identity check and actual trade experience/reference reviewed (20+ characters). Never approve based on a blank or prefilled statement.'
    : 'Why was this application rejected?');
  if(!note||note.trim().length<(status==='approved'?20:3)){
    if(note!==null)toast.error(status==='approved'?'Explain the actual identity and experience check (20+ characters)':'Give a rejection reason');
    return;
  }
  setBusy(id);
  try{
   await request('/api/admin/partner-applications','PATCH',{application_id:id,decision:status,note});
   toast.success(status==='approved'?'Specialist approved':'Application rejected');await refresh();
  }catch(e){toast.error(e instanceof Error?e.message:'Review failed')}finally{setBusy('')}
 }
 async function changeCapability(status:'approved'|'suspended'|'rejected'){
  if(!manualId.trim()||!reason.trim())return toast.error('Technician UUID and review reason are required');
  setBusy('cap');
  try{
   await request('/api/admin/technician-capabilities','PATCH',{technician_id:manualId.trim(),service_key:service,status,reason});
   toast.success('Specialist capability updated');await refresh();
  }catch(e){toast.error(e instanceof Error?e.message:'Review failed')}finally{setBusy('')}
 }
 return <main className="mx-auto max-w-5xl space-y-6 p-4 text-slate-100 sm:p-8">
  <header><a href="/admin/orders" className="text-cyan-300 underline">Back to Orders</a><h1 className="mt-3 text-2xl font-bold">Specialist applications & service approvals</h1>
  <p className="mt-2 text-sm text-slate-300">Private operations only. A plumber cannot receive borewell or tank-cleaning jobs without separately approved qualifications. Document verification is mandatory.</p></header>
  <div className="flex gap-2"><button onClick={()=>void refresh()} disabled={loading} className="rounded-lg bg-cyan-400 px-4 py-2 text-slate-950">{loading?'Loading…':'Refresh'}</button><a className="rounded-lg border p-2" href="/admin/verification">Verify required ID & photo</a></div>
  <section className="space-y-3"><h2 className="text-xl font-semibold">Pending registration requests</h2>
   {!apps.some(x=>['pending','pending_approval'].includes(x.status))&&<p className="text-slate-300">No pending specialist applications.</p>}
   {apps.filter(x=>['pending','pending_approval'].includes(x.status)).map(a=><article key={a.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
    <p className="font-semibold">{String(a.payload?.full_name??'Applicant')} · {String(a.payload?.role??a.type)}</p><p className="text-sm text-slate-300">City: {String(a.payload?.city??'Not provided')} · Skills: {Array.isArray(a.payload?.skills)?a.payload.skills.join(', '):'Not provided'}</p>
    <p className="mt-2 rounded-lg bg-white/10 p-3 text-sm text-slate-200">Requested locality: {String(a.payload?.working_area ?? 'Not provided (legacy request)')} · PIN: {String(a.payload?.working_pincode ?? 'Not provided')} · Radius: {String(a.payload?.requested_radius_km ?? 'Not specified')} km. Verify documents, city and service capability before approval.</p>
    <p className="mt-1 text-xs text-slate-400">Application ID: {a.id} · Applicant ID: {a.user_id}</p>
    <div className="mt-3 flex gap-2"><button disabled={Boolean(busy)} onClick={()=>void review(a.id,'approved')} className="rounded-lg bg-emerald-500 px-4 py-2 text-slate-950">Approve qualified specialist</button><button disabled={Boolean(busy)} onClick={()=>void review(a.id,'rejected')} className="rounded-lg border border-rose-400 px-4 py-2 text-rose-200">Reject</button></div>
   </article>)}
  </section>
  <section className="space-y-3"><h2 className="text-xl font-semibold">Additional skill approval / suspension</h2>
   <label className="block text-sm">Technician UUID<input value={manualId} onChange={e=>setManualId(e.target.value)} placeholder="Registered technician UUID" className="mt-1 w-full rounded-lg border bg-slate-900 p-3"/></label>
   <label className="block text-sm">Service<select value={service} onChange={e=>setService(e.target.value)} className="mt-1 w-full rounded-lg border bg-slate-900 p-3">{SERVICES.map(s=><option key={s}>{s}</option>)}</select></label>
   <label className="block text-sm">Verification reason<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Evidence reviewed or reason for suspension" className="mt-1 w-full rounded-lg border bg-slate-900 p-3"/></label>
   <div className="flex flex-wrap gap-2"><button disabled={Boolean(busy)} onClick={()=>void changeCapability('approved')} className="rounded-lg bg-emerald-500 px-4 py-2 text-slate-950">Approve</button><button disabled={Boolean(busy)} onClick={()=>void changeCapability('suspended')} className="rounded-lg border px-4 py-2">Suspend</button><button disabled={Boolean(busy)} onClick={()=>void changeCapability('rejected')} className="rounded-lg border px-4 py-2">Reject</button></div>
  </section>
  <section className="space-y-2"><h2 className="text-xl font-semibold">Reviewed specializations</h2>{caps.map(c=><p key={c.technician_id+c.service_key} className="rounded-lg border border-white/10 p-2 text-sm">{c.technician_id} · {c.service_key} · {c.status}</p>)}</section>
 </main>
}
