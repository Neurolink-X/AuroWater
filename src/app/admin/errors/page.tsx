'use client';
import { useCallback, useEffect, useState } from 'react';
import { adminPlatformErrorsList } from '@/lib/api-client';
import { ERROR_GROUPS } from '@/lib/observability/platform-errors';
type ErrorRow = {id:number;title:string;guidance:string;code:string;route_group:string;route_path:string;http_status:number;source:string;occurrences:number;first_seen:string;last_seen:string};
type Result = {events:ErrorRow[];has_more:boolean};
export default function PlatformErrorsPage() {
  const [group,setGroup]=useState(''); const [page,setPage]=useState(0);
  const [result,setResult]=useState<Result>({events:[],has_more:false}); const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [revision,setRevision]=useState(0);
  const refresh=useCallback(()=>setRevision(v=>v+1),[]);
  useEffect(()=>{
    let active=true;
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!active) return;
      setLoading(true); setError('');
      return adminPlatformErrorsList<Result>(page, group, controller.signal);
    })
      .then(data=>{if(active && data)setResult(data);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load errors');}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;controller.abort();};
  },[group,page,revision]);
  useEffect(()=>{
    const visibleRefresh=()=>{if(!loading && document.visibilityState==='visible') refresh();};
    const timer=window.setInterval(visibleRefresh,30_000);
    window.addEventListener('focus',visibleRefresh);
    return()=>{window.clearInterval(timer);window.removeEventListener('focus',visibleRefresh);};
  },[loading,refresh]);
  return <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-8"><div className="mx-auto max-w-6xl space-y-5">
    <header><h1 className="text-2xl font-bold">Platform errors</h1><p className="mt-2 text-sm text-slate-600">Admin-only diagnostics across public, customer, supplier and technician pages. Last 30 days; repeated events are grouped per minute. Browser reports are diagnostic signals, not verified incidents.</p></header>
    <div className="flex flex-wrap gap-3"><label>Area <select className="rounded-lg border bg-white p-2" value={group} onChange={e=>{setGroup(e.target.value);setPage(0);}}><option value="">All areas</option>{ERROR_GROUPS.map(g=><option key={g}>{g}</option>)}</select></label><button type="button" onClick={refresh} disabled={loading} className="rounded-lg bg-cyan-800 px-4 py-2 font-semibold text-white disabled:opacity-50">{loading?'Loading…':'Refresh errors'}</button></div>
    {error&&<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">{error}</p>}
    {!loading&&!error&&!result.events.length&&<p className="rounded-xl border bg-white p-5">No recorded errors in this view. This does not prove every platform operation succeeded.</p>}
    {!error&&result.events.map(row=><article key={row.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold text-red-900">{row.title}</h2><span className="text-sm">{row.occurrences} occurrence(s)</span></div><p className="mt-2 break-all font-mono text-sm">{row.route_group} · {row.route_path} {row.http_status?`· HTTP ${row.http_status}`:''}</p><p className="mt-2 text-sm text-slate-700">{row.guidance}</p><p className="mt-3 text-xs text-slate-500">{row.source==='server'?'Server exception':'Browser report'} · {row.code} · First {new Date(row.first_seen).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST · Last {new Date(row.last_seen).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} IST</p></article>)}
    <nav className="flex items-center gap-4" aria-label="Error history pages"><button type="button" disabled={page===0||loading} onClick={()=>setPage(v=>v-1)}>Previous</button><span>Page {page+1}</span><button type="button" disabled={!result.has_more||loading||!!error} onClick={()=>setPage(v=>v+1)}>Next</button></nav>
    <p className="text-xs text-slate-600">Raw messages, stack traces, customer details and query strings are not stored here. Use deployment logs for exact server causes. Reports may be absent when JavaScript, the network, or telemetry storage is unavailable. Refreshes every 30 seconds while this page is visible.</p>
  </div></main>;
}
