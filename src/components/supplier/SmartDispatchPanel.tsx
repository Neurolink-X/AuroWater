'use client';
import {useCallback,useEffect,useState} from 'react';
import {createClient} from '@/utils/supabase/client';
type Offer={id:string;order_id:string;distance_km:number;expires_at:string};
type Area={area:string;orders_30d:number;cans_30d:number;city:string};
export default function SmartDispatchPanel(){
 const [offers,setOffers]=useState<Offer[]>([]);const [areas,setAreas]=useState<Area[]>([]);
 const [message,setMessage]=useState('');const [busy,setBusy]=useState('');
 const load=useCallback(async()=>{
  try{const {data}=await createClient().auth.getSession();if(!data.session)return;
   const headers={Authorization:'Bearer '+data.session.access_token};
   const [a,b]=await Promise.all([fetch('/api/supplier/nearby-offers',{headers,cache:'no-store'}),fetch('/api/supplier/local-demand',{headers,cache:'no-store'})]);
   if(a.ok){const x=await a.json();setOffers(x.data??[])}if(b.ok){const x=await b.json();setAreas(x.data?.areas??[])}
  }catch{setMessage('Demand or offers cannot be refreshed right now. Existing orders are unaffected.')}
 },[]);
 useEffect(()=>{void load();const id=setInterval(()=>{if(document.visibilityState==='visible')void load()},15000);return()=>clearInterval(id)},[load]);
 const claim=async(o:Offer)=>{setBusy(o.id);try{const{data}=await createClient().auth.getSession();if(!data.session)throw Error('Sign in again');
  const r=await fetch('/api/supplier/nearby-offers',{method:'POST',headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({offer_id:o.id})});
  const x=await r.json();if(!r.ok)throw Error(x.error||'Offer unavailable');
  setMessage('Order assigned. Open Orders to confirm delivery.');await load();
 }catch(e){setMessage(e instanceof Error?e.message:'Offer already claimed');await load()}finally{setBusy('')}};
 return <section className="space-y-4">
  <article className="rounded-xl border border-white/20 p-4"><h2 className="font-bold">Nearby order opportunities</h2>
   <p className="text-sm opacity-75">Several eligible suppliers may see an offer. Only one can claim it; stock is reserved once.</p>
   {offers.length===0?<p className="mt-2 text-sm">No active nearby offers.</p>:offers.map(o=><div key={o.id} className="mt-3 rounded-lg border border-white/20 p-3">
    <p>{o.distance_km.toFixed(1)} km away · Expires {new Date(o.expires_at).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata'})} IST</p>
    <button disabled={!!busy} onClick={()=>void claim(o)} className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-white">Claim order</button>
   </div>)}
   {message&&<p role="status" className="mt-2 text-sm">{message}</p>}
  </article>
  <article className="rounded-xl border border-white/20 p-4"><h2 className="font-bold">Area-wise demand · Last 30 days</h2>
   <p className="text-sm opacity-75">Historical aggregated demand; exact residences and customer identities are never shown.</p>
   {areas.length===0?<p className="mt-2 text-sm">No sufficiently verified area demand to show.</p>:<div className="mt-3 grid gap-2 sm:grid-cols-2">{areas.map(a=><div key={a.area} className="rounded-lg border border-white/20 p-3">
    <p className="font-semibold">{a.area}</p><p className="text-sm">{a.orders_30d} orders · {a.cans_30d} cans / 30 days</p>
   </div>)}</div>}
  </article>
 </section>
}
