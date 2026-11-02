'use client';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
export default function CustomerReferralPage(){
 const supplierId=useSearchParams().get('supplier');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const valid=Boolean(supplierId&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(supplierId));
 async function confirm(){
  if(!valid||busy)return;
  setBusy(true);setError('');setMessage('');
  try{
   const {data:{session}}=await createClient().auth.getSession();
   if(!session?.access_token)throw new Error('Sign in or create your customer account first, then open this invitation again.');
   const res=await fetch('/api/customer/referral',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({supplierId})});
   const json=await res.json();
   if(!res.ok)throw new Error(json.error??json.message??'Unable to confirm referral');
   setMessage(json.data?.alreadyConfirmed?'Your original referral was already registered.':'Referral confirmed. You can now order on AuroTap.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to confirm referral')}finally{setBusy(false)}
 }
 return <main className="mx-auto max-w-xl px-4 py-10"><h1 className="text-2xl font-bold">Supplier invitation</h1>
 <p className="mt-3 text-slate-600">If you are new to AuroTap, confirm who introduced you. That supplier receives first priority on eligible orders for 90 days. You can still choose another supplier, and AuroTap automatically finds alternatives when needed. No referral payment or discount is promised.</p>
 {!valid?<p role="alert" className="mt-5 text-red-700">This invitation link is invalid.</p>:<button disabled={busy} onClick={()=>void confirm()} className="mt-6 rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy?'Confirming…':'Confirm supplier referral'}</button>}
 {error&&<p role="alert" className="mt-4 text-red-700">{error}</p>}{message&&<p role="status" className="mt-4 text-emerald-700">{message}</p>}
 </main>;
}
