'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Section = 'orders' | 'inventory' | 'earnings' | 'settings' | 'analytics' | 'support';
const config: Record<Section, {title:string;subtitle:string;endpoint:string}> = {
  orders: {title:'Order management',subtitle:'Assigned water orders, schedules and status. New assignments appear when dispatch eligibility is met.',endpoint:'/api/supplier/orders'},
  inventory: {title:'Inventory control',subtitle:'Current stock and reservations from the existing supplier stock API.',endpoint:'/api/supplier/stock'},
  earnings: {title:'Earnings & payouts',subtitle:'Earnings summary from the existing earnings RPC and payout request history.',endpoint:'/api/supplier/earnings?period=month'},
  settings: {title:'Dispatch settings',subtitle:'Your online status, service radius and dispatch location.',endpoint:'/api/supplier/settings'},
  analytics: {title:'Performance overview',subtitle:'Live operational data from existing orders and earnings. No fabricated metrics.',endpoint:'/api/supplier/orders'},
  support: {title:'Supplier support',subtitle:'Support centre. Use the contact options configured for your account; a ticketing backend is not currently assumed.',endpoint:'/api/supplier/settings'},
};

export default function SupplierSectionPage() {
  const params = useParams<{section:string}>();
  const section = params.section as Section;
  const meta = config[section];
  const [data,setData] = useState<unknown>(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState('');
  const [amount,setAmount] = useState('');
  const [method,setMethod] = useState<'upi'|'bank'>('upi');
  const [upi,setUpi] = useState('');
  const [account,setAccount] = useState('');
  const [ifsc,setIfsc] = useState('');
  const [online,setOnline] = useState(false);
  const [radius,setRadius] = useState('5');
  const supabase = createClient();

  const load = useCallback(async () => {
    if (!meta) return;
    setError('');
    const {data: sessionData} = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setError('Your session has expired. Sign in again to continue.'); return; }
    try {
      const response = await fetch(meta.endpoint, {headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? body?.message ?? 'Unable to load this page.');
      setData(body?.data ?? body);
      if (section === 'settings' && body?.data) {
        setOnline(Boolean(body.data.is_online));
        setRadius(String(body.data.zone_radius_km ?? 5));
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load this page.'); }
  }, [meta,section,supabase]);

  useEffect(()=>{void load();},[load]);

  async function send(path:string, methodName:string, payload:Record<string,unknown>) {
    setBusy(true); setNotice(''); setError('');
    try {
      const {data: sessionData} = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Your session has expired. Sign in again.');
      const response = await fetch(path,{method:methodName,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const body=await response.json();
      if(!response.ok) throw new Error(body?.error ?? body?.message ?? 'Request failed.');
      setNotice(body?.data?.message ?? 'Saved successfully.');
      await load();
    } catch(e) {setError(e instanceof Error?e.message:'Request failed.');}
    finally {setBusy(false);}
  }

  if(!meta) return <main style={shell}><h1>Supplier page not found</h1><Link href="/supplier/dashboard" style={link}>Back to dashboard</Link></main>;
  const rows = Array.isArray(data) ? data as Record<string,unknown>[] : [];
  const obj = data && typeof data==='object'&&!Array.isArray(data) ? data as Record<string,unknown> : {};
  const money=(v:unknown)=>'₹'+Number(v??0).toLocaleString('en-IN',{maximumFractionDigits:2});
  return <main style={shell}>
    <div style={eyebrow}>AUROTAP · SUPPLIER PORTAL</div>
    <h1 style={heading}>{meta.title}</h1><p style={sub}>{meta.subtitle}</p>
    <div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'18px 0 24px'}}>
      <button style={button} onClick={()=>void load()} disabled={busy}>↻ Refresh</button>
      <Link href="/supplier/dashboard" style={link}>← Dashboard</Link>
    </div>
    {error && <div role="alert" style={errorBox}>{error}</div>}
    {notice && <div role="status" style={successBox}>{notice}</div>}
    {section==='orders' && <section style={grid}>
      {rows.length===0?<Empty title="No assigned orders yet" text="New requests appear after dispatch assigns an eligible order to your supplier account. Go online in Dispatch settings, confirm location/radius and stock, then refresh."/>:rows.map((o,i)=><article key={String(o.id??i)} style={card}>
        <div style={row}><b>Order #{String(o.order_number??o.id??'').slice(0,10)}</b><span style={badge}>{String(o.status??'').replaceAll('_',' ')}</span></div>
        <p>{String(o.service_type_label??o.service_type??'Water/service order')}</p><p>{String(o.customer_name??'Customer')} · {String(o.customer_phone??'Phone unavailable')}</p>
        <p>{String(o.address_line??o.address??'Address on order')} · {String(o.city??o.customer_city??'')}</p>
        <p>{String(o.scheduled_date??o.scheduled_at??'Schedule pending')} {String(o.time_slot??o.scheduled_slot??'')}</p><strong>{money(o.final_amount??o.total_amount??o.amount)}</strong>
      </article>)}
    </section>}
    {section==='inventory' && <section style={grid}>
      <Metric label="Available cans" value={String(obj.cans_available??'—')}/><Metric label="Reserved cans" value={String(obj.reserved_cans??'—')}/><Metric label="Low-stock alert" value={String(obj.low_stock_alert??'—')}/><Metric label="Reservation buffer" value={String(obj.reservation_buffer_cans??'—')}/>
      <article style={card}><h2>Adjust stock</h2><p>Positive adds stock; negative records offline sales. Server-side reservation checks still apply.</p><div style={row}><input id="stock-delta" type="number" step="1" placeholder="e.g. 10 or -1" style={input}/><button disabled={busy} style={button} onClick={()=>{const el=document.getElementById('stock-delta') as HTMLInputElement|null;const n=Number(el?.value);if(!Number.isInteger(n)||n===0){setError('Enter a non-zero whole number.');return;}void send('/api/supplier/stock','PUT',{stock_delta:n});}}>Update stock</button></div></article>
    </section>}
    {section==='earnings' && <section style={grid}>
      <Metric label="Completed eligible orders" value={String(obj.order_count??'—')}/><Metric label="Gross earnings" value={money(obj.gross_amount)}/><Metric label="Pending payout" value={money(obj.pending_payout)}/>
      <article style={card}><h2>Request a payout</h2><p>Submitting a request does not transfer money. Admin/provider processing is still required.</p>
        <label style={label}>Amount (INR)<input style={input} value={amount} onChange={e=>setAmount(e.target.value)} type="number" min="1" step="0.01"/></label>
        <label style={label}>Payout method<select style={input} value={method} onChange={e=>setMethod(e.target.value as 'upi'|'bank')}><option value="upi">UPI</option><option value="bank">Bank account</option></select></label>
        {method==='upi'?<label style={label}>UPI ID<input style={input} value={upi} onChange={e=>setUpi(e.target.value)} placeholder="name@bank"/></label>:<><label style={label}>Bank account number<input style={input} value={account} onChange={e=>setAccount(e.target.value)} inputMode="numeric"/></label><label style={label}>IFSC<input style={input} value={ifsc} onChange={e=>setIfsc(e.target.value.toUpperCase())}/></label></>}
        <button style={button} disabled={busy} onClick={()=>{const n=Number(amount);if(!Number.isFinite(n)||n<=0){setError('Enter a valid amount.');return;}void send('/api/supplier/payouts','POST',method==='upi'?{amount:n,method,upi_id:upi}:{amount:n,method,bank_account:account,ifsc});}}>Submit payout request</button>
      </article>
    </section>}
    {section==='settings' && <section style={grid}>
      <article style={card}><h2>Dispatch availability</h2><p>Online suppliers may receive eligible new orders. Existing pending orders are retried when you switch online.</p><div style={row}><span style={badge}>{online?'ONLINE':'OFFLINE'}</span><button style={button} disabled={busy} onClick={()=>void send('/api/supplier/settings','PUT',{is_online:!online})}>{online?'Go offline':'Go online'}</button></div>
      <label style={label}>Service radius (km)<input style={input} type="number" min="1" max="100" value={radius} onChange={e=>setRadius(e.target.value)}/></label><button style={button} disabled={busy} onClick={()=>{const n=Number(radius);if(!Number.isInteger(n)||n<1||n>100){setError('Radius must be 1–100 km.');return;}void send('/api/supplier/settings','PUT',{zone_radius_km:n});}}>Save radius</button>
      <p>Set a dispatch location from the main dashboard using the location button. Orders are only offered when eligibility, distance and stock checks pass.</p></article>
      <article style={card}><h2>Current dispatch configuration</h2><pre style={pre}>{JSON.stringify(obj,null,2)}</pre></article>
    </section>}
    {section==='analytics' && <section style={grid}>
      <Metric label="Assigned orders in list" value={String(rows.length)}/><Metric label="Completed in list" value={String(rows.filter(o=>['COMPLETED','DELIVERED'].includes(String(o.status).toUpperCase())).length)}/><Metric label="Active in list" value={String(rows.filter(o=>['ASSIGNED','IN_PROGRESS'].includes(String(o.status).toUpperCase())).length)}/>
      <article style={card}><h2>Data integrity note</h2><p>These figures reflect the current order API response. For authoritative revenue and payout figures, use the earnings RPC; never treat a browser-derived estimate as an accounting ledger.</p><Link href="/supplier/earnings" style={link}>Open earnings →</Link></article>
    </section>}
    {section==='support' && <section style={grid}><article style={card}><h2>Need assistance?</h2><p>Support ticket creation is not wired to a verified ticket backend in this change. Do not enter customer payment or banking secrets in general messages.</p><p>For dispatch issues, first check online status, location, service radius, stock, and the Orders page. If a valid order still fails to assign, provide the order ID to the platform administrator for dispatch-log review.</p><Link href="/supplier/settings" style={link}>Check dispatch settings →</Link></article></section>}
    <p style={{...sub,marginTop:28}}>Data is loaded from authenticated supplier APIs. If an endpoint or schema is unavailable, this page displays an error rather than inventing values.</p>
  </main>;
}

function Metric({label,value}:{label:string;value:string}){return <article style={card}><div style={eyebrow}>{label}</div><div style={{fontSize:30,fontWeight:850,marginTop:14}}>{value}</div></article>}
function Empty({title,text}:{title:string;text:string}){return <article style={{...card,gridColumn:'1/-1',textAlign:'center',padding:38}}><div style={{fontSize:22,fontWeight:800}}>{title}</div><p style={sub}>{text}</p><Link href="/supplier/settings" style={link}>Open dispatch settings →</Link></article>}
const shell:React.CSSProperties={minHeight:'70vh',background:'#08111b',color:'#f1f5f9',padding:'clamp(20px,4vw,56px)',fontFamily:'Arial,sans-serif'};
const eyebrow:React.CSSProperties={color:'#5eead4',fontWeight:800,fontSize:12,letterSpacing:2,textTransform:'uppercase'};
const heading:React.CSSProperties={fontSize:'clamp(30px,4vw,44px)',fontWeight:850,letterSpacing:-1,margin:'12px 0'};
const sub:React.CSSProperties={color:'#9aa9b8',lineHeight:1.7,maxWidth:850};
const grid:React.CSSProperties={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,280px),1fr))',gap:16};
const card:React.CSSProperties={background:'#0d1925',border:'1px solid #233544',borderRadius:18,padding:22,minWidth:0};
const row:React.CSSProperties={display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'};
const badge:React.CSSProperties={fontSize:11,fontWeight:800,color:'#5eead4',background:'#123c3a',borderRadius:999,padding:'6px 10px'};
const button:React.CSSProperties={background:'#07966c',color:'#fff',fontWeight:800,border:0,borderRadius:10,padding:'11px 15px',cursor:'pointer'};
const link:React.CSSProperties={display:'inline-block',color:'#7dd3fc',textDecoration:'none',fontWeight:750,border:'1px solid #24516a',borderRadius:10,padding:'10px 14px'};
const input:React.CSSProperties={display:'block',width:'100%',boxSizing:'border-box',background:'#07111b',border:'1px solid #2b4050',borderRadius:10,color:'#f8fafc',padding:12,marginTop:8};
const label:React.CSSProperties={display:'block',fontSize:13,color:'#cbd5e1',margin:'14px 0',fontWeight:700};
const errorBox:React.CSSProperties={background:'#431d24',border:'1px solid #9f3345',padding:14,borderRadius:12,marginBottom:16,color:'#fecdd3'};
const successBox:React.CSSProperties={background:'#123c3a',border:'1px solid #21796b',padding:14,borderRadius:12,marginBottom:16,color:'#99f6e4'};
const pre:React.CSSProperties={whiteSpace:'pre-wrap',wordBreak:'break-word',color:'#b6c6d5',fontSize:12};
