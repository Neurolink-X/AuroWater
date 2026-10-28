'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { getToken } from '@/lib/api-client';

type Config = { water_normal:number; water_chilled:number; water_subscription:number; bulk_can_price:number; bulk_threshold:number; services:Record<string,number>; convenience_fee:number; emergency_surcharge:number; gst_rate:number };
type Version = { id:number; version:number; effective_from:string; reason:string; config:Config; created_at:string; currently_effective?:boolean };
const labels:Record<string,string> = { water_tanker:'Water tanker', ro_service:'RO service', plumbing:'Plumbing labour', borewell:'Borewell', motor_pump:'Motor & pump', tank_cleaning:'Tank cleaning' };
const currency = (v:number) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(v);

async function call<T>(method:'GET'|'POST', body?:unknown):Promise<T> {
 const token = await getToken();
 if (!token) throw new Error('Your session has expired. Sign in again to manage pricing.');
 const res=await fetch('/api/admin/pricing',{
  method,
  credentials:'include',
  headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const envelope=await res.json().catch(()=>({}));
 if (res.status===401) throw new Error('Your session is no longer valid. Sign in again, then reopen pricing.');
 if (res.status===403) throw new Error('Administrator access is required to manage pricing.');
 if(!res.ok||envelope.success===false) throw new Error(envelope.error||'Request failed');
 return envelope.data as T;
}
export default function AdminPricingPage() {
 const [versions,setVersions]=useState<Version[]>([]);
 const [current,setCurrent]=useState<Version|null>(null);
 const [config,setConfig]=useState<Config>({water_normal:20,water_chilled:25,water_subscription:20,bulk_can_price:20,bulk_threshold:50,services:{water_tanker:299,ro_service:349,plumbing:149,borewell:499,motor_pump:299,tank_cleaning:599},convenience_fee:10,emergency_surcharge:30,gst_rate:0});
 const [reason,setReason]=useState(''); const [effective,setEffective]=useState(''); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState('');
 const load=useCallback(async()=>{setLoading(true);setError('');try{const r=await call<{versions:Version[];current:Version|null}>('GET');setVersions(r.versions);setCurrent(r.current);if(r.current?.config)setConfig({...r.current.config,water_normal:Math.max(20,Number(r.current.config.water_normal)||20),water_chilled:Math.max(25,Number(r.current.config.water_chilled)||25),water_subscription:Math.max(20,Number(r.current.config.water_subscription)||20),bulk_can_price:Math.max(20,Number(r.current.config.bulk_can_price)||20)});}catch(e){setError(e instanceof Error?e.message:'Could not load pricing.');}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 const update=(key:keyof Omit<Config,'services'>,v:string)=>setConfig(old=>({...old,[key]:v===''?0:Number(v)}));
 const updateService=(key:string,v:string)=>setConfig(old=>({...old,services:{...old.services,[key]:v===''?0:Number(v)}}));
 const field=(label:string,value:number,onChange:(v:string)=>void,min=0,max=100000,step='0.01')=><label key={label} className="block space-y-1.5 text-sm"><span className="font-semibold text-slate-800">{label}</span><input type="number" min={min} max={max} step={step} value={value} onChange={e=>onChange(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 focus:border-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-700/20"/></label>;
 const publish=async()=>{if(saving)return;if(reason.trim().length<3){setError('Enter a clear reason for this price change.');return;}setSaving(true);setError('');try{await call('POST',{config,reason:reason.trim(),effective_from:effective?new Date(effective).toISOString():new Date().toISOString()});toast.success('New pricing version published');setReason('');setEffective('');await load();}catch(e){const msg=e instanceof Error?e.message:'Publish failed';setError(msg);toast.error(msg);}finally{setSaving(false);}};
 return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8"><div className="mx-auto max-w-6xl space-y-6">
 <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold tracking-[.18em] text-cyan-800">AUROTAP / ADMIN</p><h1 className="mt-2 text-3xl font-extrabold">Versioned pricing</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Publish a new price version with an effective date and audit reason. Water rates cannot go below the current ₹20 single-can supplier payout rule; multi-can payout schedules remain unapproved. Versions are immutable; old orders and payouts must never be recalculated from today&apos;s prices.</p></div><Link href="/admin/dashboard" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold">Back to dashboard</Link></header>
 {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
 <section className="grid gap-4 md:grid-cols-3"><article className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase text-slate-500">Current effective version</p><p className="mt-2 text-2xl font-extrabold">{current?'v'+current.version:'Unavailable'}</p><p className="mt-1 text-sm text-slate-500">{current?new Date(current.effective_from).toLocaleString('en-IN'):'Apply migration 027 to enable versioning.'}</p></article><article className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase text-slate-500">Water pricing</p><p className="mt-2 text-2xl font-extrabold">{currency(config.water_normal)} / {currency(config.water_chilled)}</p><p className="mt-1 text-sm text-slate-500">Normal / chilled per 20L can</p></article><article className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase text-slate-500">Version history</p><p className="mt-2 text-2xl font-extrabold">{versions.length}</p><p className="mt-1 text-sm text-slate-500">Read-only published history</p></article></section>
 <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-xl font-bold">Draft a new version</h2><p className="mt-1 text-sm text-slate-600">Prices are server-validated. The active version is selected by effective date.</p>
 <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
 {field('Normal RO · ₹/can',config.water_normal,v=>update('water_normal',v),20,500)}
 {field('Chilled RO · ₹/can',config.water_chilled,v=>update('water_chilled',v),25,500)}
 {field('Subscription RO · ₹/can',config.water_subscription,v=>update('water_subscription',v),20,500)}
 {field('Bulk RO · ₹/can',config.bulk_can_price,v=>update('bulk_can_price',v),20,500)}
 {field('Bulk threshold · cans',config.bulk_threshold,v=>update('bulk_threshold',v),2,200,'1')}
 {field('Convenience fee · ₹',config.convenience_fee,v=>update('convenience_fee',v),0,500)}
 {field('Emergency surcharge · ₹',config.emergency_surcharge,v=>update('emergency_surcharge',v),0,5000)}
 {field('GST rate · decimal',config.gst_rate,v=>update('gst_rate',v),0,1,'0.01')}
 {Object.keys(config.services).sort().map(k=>field((labels[k]??k.replace(/_/g,' '))+' · ₹ base',config.services[k],v=>updateService(k,v),1,100000))}
 </div>
 <div className="mt-5 grid gap-4 md:grid-cols-2"><label className="space-y-1.5 text-sm"><span className="font-semibold">Effective from (optional)</span><input type="datetime-local" value={effective} min={new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)} onChange={e=>setEffective(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5"/><span className="block text-xs text-slate-500">Blank means immediately.</span></label><label className="space-y-1.5 text-sm"><span className="font-semibold">Reason (required)</span><textarea value={reason} maxLength={500} onChange={e=>setReason(e.target.value)} rows={3} placeholder="e.g. approved supplier cost revision" className="w-full rounded-xl border border-slate-300 px-3 py-2.5"/><span className="block text-xs text-slate-500">{reason.length}/500 characters</span></label></div>
 <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-5"><p className="max-w-2xl text-xs leading-5 text-amber-800">Publishing is not the same as deploying. Ensure order APIs have been wired to read the version and save snapshots before relying on live checkout pricing.</p><button onClick={()=>void publish()} disabled={saving||loading||!current||reason.trim().length<3} className="rounded-xl bg-cyan-800 px-5 py-3 text-sm font-bold text-white hover:bg-cyan-900 disabled:opacity-50">{saving?'Publishing…':'Publish new version'}</button></div></section>
 <section className="rounded-2xl border bg-white p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Immutable history</h2><button onClick={()=>void load()} disabled={loading} className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50">{loading?'Loading…':'Refresh history'}</button></div><div className="mt-4 divide-y">{versions.map(v=><article key={v.id} className="grid gap-2 py-4 sm:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">Version {v.version}</h3>{v.currently_effective&&<span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">Effective now</span>}</div><p className="mt-1 text-sm text-slate-600">{v.reason}</p><p className="mt-1 text-xs text-slate-500">Effective {new Date(v.effective_from).toLocaleString('en-IN')} · Published {new Date(v.created_at).toLocaleString('en-IN')}</p></div><p className="font-bold">{currency(v.config.water_normal)} / {currency(v.config.water_chilled)}</p></article>)}{!versions.length&&!loading&&<p className="py-6 text-sm text-slate-500">No pricing versions found.</p>}</div></section>
 </div></main>;
}
