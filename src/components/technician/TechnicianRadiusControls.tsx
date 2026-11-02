'use client';
import {useEffect,useState} from 'react';
import {createClient} from '@/utils/supabase/client';
type Service={service_key:string;radius_km:number;max_km:number};
export default function TechnicianRadiusControls(){
 const [services,setServices]=useState<Service[]>([]);
 const [values,setValues]=useState<Record<string,string>>({});
 const [message,setMessage]=useState('');
 useEffect(()=>{let live=true;void (async()=>{try{
 const {data}=await createClient().auth.getSession();if(!data.session)return;
 const response=await fetch('/api/technician/service-radii',{headers:{Authorization:'Bearer '+data.session.access_token}});
 const json=await response.json();if(!response.ok)throw Error(json.error||'Could not load radii');
 if(live){const rows=json.data?.services??[];setServices(rows);setValues(Object.fromEntries(rows.map((r:Service)=>[r.service_key,String(r.radius_km)])));}
 }catch(e){if(live)setMessage(e instanceof Error?e.message:'Radius unavailable')}})();return()=>{live=false}},[]);
 async function save(r:Service){const n=Number(values[r.service_key]);if(!Number.isInteger(n)||n<1||n>r.max_km){setMessage('Invalid radius');return;}
 if(n>25&&!window.confirm('Confirm you can reliably complete accepted jobs at this distance.'))return;
 const threshold=['borewell','tank_cleaning'].includes(r.service_key)?50:30;
 const reason=n>threshold?window.prompt('Explain your delivery capacity (15+ characters):'):undefined;
 if(n>threshold&&(!reason||reason.trim().length<15))return;
 try{const {data}=await createClient().auth.getSession();if(!data.session)throw Error('Sign in again');
 const res=await fetch('/api/technician/service-radii',{method:'PUT',headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({service_key:r.service_key,radius_km:n,reason})});
 const json=await res.json();if(!res.ok)throw Error(json.error||'Save failed');
 if(!json.data?.review_required)setServices(old=>old.map(s=>s.service_key===r.service_key?{...s,radius_km:n}:s));
 setMessage(json.data?.review_required?'Request sent for admin review. Current radius remains active.':'Radius saved. Service and city approvals remain required.');
 }catch(e){setMessage(e instanceof Error?e.message:'Save failed')}}
 return <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-bold">Service-wise delivery radius</h2><p className="text-sm text-slate-600">Plumber, RO and pump default to 15 km. Borewell and tank cleaning default to 50 km. Larger ranges require admin approval.</p>{message&&<p role="status" className="p-3 text-amber-800">{message}</p>}<div className="grid gap-3 sm:grid-cols-2">{services.map(r=><label key={r.service_key} className="rounded-xl border p-3">{r.service_key.replaceAll('_',' ')} (max {r.max_km} km)<input className="my-2 w-full rounded-lg border p-2" type="number" min={1} max={r.max_km} value={values[r.service_key]??''} onChange={e=>setValues(v=>({...v,[r.service_key]:e.target.value}))}/><button type="button" onClick={()=>void save(r)} className="rounded-lg bg-emerald-700 px-4 py-2 text-white">Save radius</button></label>)}</div></section>
}
