'use client';
import { useCallback,useEffect,useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
type Relationship={supplier_id:string;status:string;priority_expires_at:string};
export default function PreferredSupplierPage(){
 const params=useSearchParams();
 const incoming=params.get('supplier');
 const [items,setItems]=useState<Relationship[]>([]);
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const call=useCallback(async(method:'GET'|'POST'|'DELETE',supplierId?:string)=>{
  const {data:{session}}=await createClient().auth.getSession();
  if(!session?.access_token)throw new Error('Please sign in to manage your supplier preference.');
  const res=await fetch('/api/customer/preferred-supplier',{method,headers:{Authorization:`Bearer ${session.access_token}`,...(supplierId?{'Content-Type':'application/json'}:{})},body:supplierId?JSON.stringify({supplierId}):undefined,cache:'no-store'});
  const json=await res.json();
  if(!res.ok)throw new Error(json.error||'Request failed');
  return json.data;
 },[]);
 const refresh=useCallback(async()=>{try{const result=await call('GET');setItems(result.relationships??[])}catch(e){setError(e instanceof Error?e.message:'Unable to load preference')}},[call]);
 useEffect(()=>{void refresh()},[refresh]);
 async function change(method:'POST'|'DELETE',supplierId:string){if(busy)return;setBusy(true);setError('');setNotice('');try{await call(method,supplierId);setNotice(method==='POST'?'Supplier preference saved. All orders remain managed by AuroTap.':'Supplier preference removed.');await refresh()}catch(e){setError(e instanceof Error?e.message:'Unable to save')}finally{setBusy(false)}}
 return <main className="mx-auto max-w-2xl px-4 py-8"><h1 className="text-2xl font-bold text-slate-900">Preferred supplier</h1>
 <p className="mt-2 text-sm text-slate-600">Choose who gets first priority for your eligible water deliveries. If they cannot fulfill your slot, AuroTap can assign another verified supplier. You can change your choice anytime.</p>
 {error&&<p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-rose-800">{error}</p>}
 {notice&&<p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-emerald-800">{notice}</p>}
 {incoming&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(incoming)&&<section className="mt-6 rounded-xl border p-4"><h2 className="font-semibold">Supplier invitation</h2><p className="mt-2 text-sm">Confirm this supplier as your preferred delivery partner. This does not guarantee assignment if stock, coverage or availability checks fail.</p><button disabled={busy} onClick={()=>void change('POST',incoming)} className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Confirm preferred supplier</button></section>}
 <section className="mt-6 space-y-3"><h2 className="font-semibold">Your active preferences</h2>{items.length===0?<p className="text-sm text-slate-600">No supplier preference selected. AuroTap will find an eligible supplier for each order.</p>:items.map(item=><div key={item.supplier_id} className="rounded-xl border p-4"><p className="break-all text-sm">Supplier ID: {item.supplier_id}</p><p className="mt-1 text-xs text-slate-600">Priority until {new Date(item.priority_expires_at).toLocaleDateString('en-IN')}</p><button disabled={busy} onClick={()=>void change('DELETE',item.supplier_id)} className="mt-3 rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Remove preference</button></div>)}</section>
 </main>;
}
