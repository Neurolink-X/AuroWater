'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/api-client';

type City = { id:string;name:string;slug:string;status:string;state:string|null };
type Readiness = {
  city:string;platform_status:string;zones:number;available_zones:number;
  approved_suppliers:number;online_stocked_assigned_suppliers:number;
  zones_missing_pincodes:{id:string;name:string}[];operational_signal:boolean;
};
type Report = {cities:Readiness[];checked_at:string;note:string};
const choices=['active','coming_soon','waitlist'] as const;

export default function ExpansionCenterPage(){
  const [cities,setCities]=useState<City[]>([]);
  const [report,setReport]=useState<Report|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState<string|null>(null);
  const [drafts,setDrafts]=useState<Record<string,string>>({});
  const [revision,setRevision]=useState(0);
  async function request<T>(url:string,init?:RequestInit):Promise<T>{
    const token=await getToken();
    if(!token) throw new Error('Admin sign-in required.');
    const response=await fetch(url,{...init,cache:'no-store',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...init?.headers}});
    const body=await response.json().catch(()=>null);
    if(!response.ok||!body||!('data' in body))throw new Error(body?.error??`Request failed (HTTP ${response.status})`);
    return body.data as T;
  }
  useEffect(()=>{
    let active=true;
    const controller=new AbortController();
    const fetchData=async()=>{
      try{
        const [directory,readiness]=await Promise.all([
          request<City[]>('/api/admin/cities',{signal:controller.signal}),
          request<Report>('/api/admin/city-readiness',{signal:controller.signal}),
        ]);
        if(!active)return;
        setCities(directory);setReport(readiness);setDrafts(Object.fromEntries(directory.map(c=>[c.id,c.status])));setError('');
      }catch(cause){
        if(active&&!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Unable to load expansion data.');
      }finally{if(active)setLoading(false);}
    };
    void fetchData();
    return()=>{active=false;controller.abort();};
  },[revision]);
  async function changeStatus(city:City){
    const status=drafts[city.id];
    if(!status||status===city.status)return;
    if(!window.confirm(`Change ${city.name} status from ${city.status} to ${status}? This can affect customer discovery and booking.`))return;
    setSaving(city.id);setError('');setNotice('');
    try{
      await request('/api/admin/cities',{method:'PATCH',body:JSON.stringify({id:city.id,status})});
      setNotice(`${city.name} status updated. Recheck downstream serviceability.`);
      setLoading(true);setRevision(v=>v+1);
    }catch(cause){setError(cause instanceof Error?cause.message:'Could not update city.');}
    finally{setSaving(null);}
  }
  const byName=new Map((report?.cities??[]).map(c=>[c.city.toLowerCase().trim(),c]));
  return <main className="mx-auto max-w-7xl space-y-6 bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><Link href="/admin/dashboard" className="text-sm font-semibold text-cyan-800">← Admin dashboard</Link>
        <h1 className="mt-2 text-3xl font-extrabold">Expansion Control Center</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">One city directory, linked service-zone operations and conservative supplier-readiness signals. Never assume an active city means every address is serviceable.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/zones" className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Manage zones & suppliers</Link>
        <Link href="/admin/city-readiness" className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold">Readiness report</Link>
        <button type="button" onClick={()=>{setLoading(true);setRevision(v=>v+1);}} disabled={loading} className="rounded-xl border bg-white px-4 py-3 text-sm font-semibold disabled:opacity-50">Refresh</button>
      </div>
    </header>
    {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-950">{error}</p>}
    {notice&&<p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">{notice}</p>}
    {loading&&<p role="status" className="rounded-xl bg-white p-6 text-sm">Loading city operations…</p>}
    {!loading&&report&&<div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Directory cities</p><p className="mt-2 text-3xl font-bold">{cities.length}</p></div>
      <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Active city status</p><p className="mt-2 text-3xl font-bold">{cities.filter(c=>c.status==='active').length}</p></div>
      <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Operational capacity signal</p><p className="mt-2 text-3xl font-bold">{report.cities.filter(c=>c.operational_signal).length}</p></div>
    </div>}
    {!loading&&<div className="grid gap-4 lg:grid-cols-2">{cities.map(city=>{
      const readiness=byName.get(city.name.toLowerCase().trim());
      const ready=readiness?.operational_signal??false;
      return <section key={city.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-xl font-bold">{city.name}</h2><p className="mt-1 text-xs text-slate-500">{city.state??'India'} · /cities/{city.slug}</p></div>
          <span className={ready?'rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900':'rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900'}>
            {ready?'Capacity signal available':'Not operationally verified'}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
          <div><p className="text-slate-500">Service zones</p><p className="font-bold">{readiness?.zones??0}</p></div>
          <div><p className="text-slate-500">Available with PIN codes</p><p className="font-bold">{readiness?.available_zones??0}</p></div>
          <div><p className="text-slate-500">Approved suppliers</p><p className="font-bold">{readiness?.approved_suppliers??0}</p></div>
          <div><p className="text-slate-500">Online, stocked & assigned</p><p className="font-bold">{readiness?.online_stocked_assigned_suppliers??0}</p></div>
        </div>
        {!!readiness?.zones_missing_pincodes.length&&<p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Missing zone PIN coverage: {readiness.zones_missing_pincodes.map(z=>z.name).join(', ')}</p>}
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4">
          <label className="flex-1 text-sm font-semibold">City directory status
            <select aria-label={`${city.name} status`} className="mt-1 w-full rounded-xl border p-3 font-normal" value={drafts[city.id]??city.status} onChange={e=>setDrafts(prev=>({...prev,[city.id]:e.target.value}))}>
              {choices.map(status=><option key={status} value={status}>{status.replaceAll('_',' ')}</option>)}
            </select>
          </label>
          <button type="button" disabled={saving!==null||drafts[city.id]===city.status} onClick={()=>void changeStatus(city)} className="rounded-xl bg-cyan-800 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">Save status</button>
        </div>
        <p className="mt-3 text-xs text-slate-500">Activation requires verified service PINs and an eligible supplier with assigned zones and free stock. Detailed address eligibility remains a separate checkout gate.</p>
      </section>;
    })}</div>}
    {!loading&&report&&<p className="rounded-xl border bg-white p-4 text-sm text-slate-600">{report.note}</p>}
  </main>;
}
