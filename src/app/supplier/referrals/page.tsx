'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Summary={referred:number;active:number;expired:number;policy:string;privacy:string};
export default function SupplierReferralsPage(){
 const [summary,setSummary]=useState<Summary|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const {data:{session}}=await createClient().auth.getSession();
   if(!session?.access_token)throw new Error('Please sign in as a supplier.');
   const response=await fetch('/api/supplier/referral-summary',{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store'});
   const body=await response.json();
   if(!response.ok)throw new Error(body.error||'Could not load referrals.');
   setSummary(body.data);
  }catch(e){setError(e instanceof Error?e.message:'Unable to load referrals');}
  finally{setLoading(false)}
 },[]);
 useEffect(()=>{void refresh()},[refresh]);
 return <main className="mx-auto max-w-3xl px-4 py-8">
  <h1 className="text-2xl font-bold text-slate-900">My Customer Network</h1>
  <p className="mt-2 text-sm text-slate-600">Customer relationships are managed by AuroTap. No referral fees or commissions.</p>
  {loading&&<p role="status" className="mt-5">Loading referral summary…</p>}
  {error&&<div role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-rose-800">{error}<button onClick={()=>void refresh()} className="ml-3 underline">Retry</button></div>}
  {summary&&<><div className="mt-6 grid grid-cols-3 gap-3">{[['Referred',summary.referred],['Protected',summary.active],['Expired',summary.expired]].map(([label,value])=><div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-2xl font-bold text-slate-900">{value}</div><div className="text-xs text-slate-600">{label}</div></div>)}</div>
   <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">How priority works</h2><p className="mt-2 text-sm text-slate-600">{summary.policy}</p><p className="mt-3 text-sm text-slate-600">{summary.privacy}</p><p className="mt-3 text-sm text-slate-600">All bookings, subscriptions, delivery updates and support remain available through AuroTap.</p></section></>}
 </main>
}
