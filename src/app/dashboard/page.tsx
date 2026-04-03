'use client';

export const dynamic = 'force-dynamic';

import React, {
  useEffect, useMemo, useRef,
  useState, useCallback,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

/* ═══════════════════════════════════════════════════════════════
   TYPES  (unchanged)
═══════════════════════════════════════════════════════════════ */
type Address = {
  id: string; houseFlat: string; area: string; city: string;
  pincode: string; landmark?: string; label?: string;
  createdAt: number; isDefault?: boolean;
};
type ServiceKey   = 'water_tanker'|'ro_service'|'plumbing'|'borewell'|'motor_pump'|'tank_cleaning';
type OrderStatus  = 'PENDING'|'ASSIGNED'|'IN_PROGRESS'|'COMPLETED'|'CANCELLED';
type StoredOrder  = {
  id: string; status: OrderStatus; createdAt: number; updatedAt: number;
  serviceKey: ServiceKey; subOptionKey: string; address: Address;
  scheduledDate: string; timeKey: string; emergency: boolean;
  total: number; paymentMethod: 'cash'|'online'; paymentStatus: 'unpaid'|'paid';
  technicianName?: string; technicianPhone?: string;
};
type NotifCategory    = 'booking'|'promo'|'system'|'payment';
type NotificationItem = {
  id: string; icon: string; title: string; body: string;
  ts: number; read: boolean; category: NotifCategory; orderId?: string;
};
type Profile     = { name: string; email: string; phone: string; updatedAt?: number };
type Review      = { orderId: string; rating: number; text?: string; createdAt: number };
type ActivityLog = {
  id: string; ts: number;
  type: 'order_placed'|'order_cancelled'|'review_submitted'|'address_added'|'profile_updated'|'payment_made';
  label: string; meta?: string;
};
type TabKey      = 'overview'|'orders'|'notifications'|'addresses'|'activity'|'profile';
type OrderFilter = 'all'|'active'|'completed'|'cancelled';

/* ═══════════════════════════════════════════════════════════════
   STORAGE KEYS
═══════════════════════════════════════════════════════════════ */
const SK = {
  ORDERS:'aw3_orders', ADDRESSES:'aw3_addresses', NOTIFICATIONS:'aw3_notifs',
  PROFILE:'aw3_profile', REVIEWS:'aw3_reviews', REFERRAL:'aw3_referral',
  ACTIVITY:'aw3_activity', SEEDED:'aw3_seeded',
} as const;

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const UP_CITIES = [
  'Delhi','Noida','Ghaziabad','Kanpur','Gorakhpur','Lucknow',
  'Varanasi','Prayagraj','Agra','Meerut','Bareilly','Aligarh','Mathura',
] as const;

const SVC: Record<ServiceKey,{label:string;emoji:string;bg:string;iconBg:string}> = {
  water_tanker: {label:'Water Tanker',  emoji:'🚛',bg:'bg-sky-50',    iconBg:'bg-sky-100'},
  ro_service:   {label:'RO Service',   emoji:'💧',bg:'bg-blue-50',   iconBg:'bg-blue-100'},
  plumbing:     {label:'Plumbing',     emoji:'🔧',bg:'bg-orange-50', iconBg:'bg-orange-100'},
  borewell:     {label:'Borewell',     emoji:'⛏️',bg:'bg-stone-50',  iconBg:'bg-stone-100'},
  motor_pump:   {label:'Motor & Pump', emoji:'⚙️',bg:'bg-violet-50', iconBg:'bg-violet-100'},
  tank_cleaning:{label:'Tank Cleaning',emoji:'🪣',bg:'bg-cyan-50',   iconBg:'bg-cyan-100'},
};

const TECH_DB: Record<ServiceKey,{name:string;phone:string;rating:number;exp:string}> = {
  water_tanker: {name:'Rahul Verma',   phone:'9876-0XXXXX',rating:4.9,exp:'6 yrs'},
  ro_service:   {name:'Mohit Gupta',   phone:'9812-0XXXXX',rating:4.8,exp:'4 yrs'},
  plumbing:     {name:'Sunita Agarwal',phone:'9823-0XXXXX',rating:4.9,exp:'8 yrs'},
  borewell:     {name:'Vikram Tiwari', phone:'9834-0XXXXX',rating:4.9,exp:'10 yrs'},
  motor_pump:   {name:'Kavya Singh',   phone:'9845-0XXXXX',rating:4.7,exp:'5 yrs'},
  tank_cleaning:{name:'Priya Sharma',  phone:'9856-0XXXXX',rating:5.0,exp:'7 yrs'},
};

const STATUS_CFG: Record<OrderStatus,{label:string;dot?:boolean;bg:string;color:string;dot_color:string}> = {
  PENDING:    {label:'Pending',    bg:'#FFF7ED',color:'#C2410C',dot_color:'#FB923C'},
  ASSIGNED:   {label:'Assigned',   bg:'#EFF6FF',color:'#1D4ED8',dot_color:'#60A5FA'},
  IN_PROGRESS:{label:'In Progress',bg:'#EDE9FE',color:'#6D28D9',dot_color:'#8B5CF6',dot:true},
  COMPLETED:  {label:'Completed',  bg:'#ECFDF5',color:'#065F46',dot_color:'#34D399'},
  CANCELLED:  {label:'Cancelled',  bg:'#F9FAFB',color:'#6B7280',dot_color:'#9CA3AF'},
};

const TL_STEPS = ['Placed','Confirmed','Assigned','In Progress','Completed'] as const;

const ACT_ICONS: Record<ActivityLog['type'],string> = {
  order_placed:'📦', order_cancelled:'❌', review_submitted:'⭐',
  address_added:'📍', profile_updated:'👤', payment_made:'💳',
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS  (unchanged)
═══════════════════════════════════════════════════════════════ */
const lsGet = (k:string):string|null => {
  if (typeof window==='undefined') return null;
  try { return localStorage.getItem(k); } catch { return null; }
};
const lsSet = (k:string,v:string):void => {
  if (typeof window==='undefined') return;
  try { localStorage.setItem(k,v); } catch { /* noop */ }
};
function sp<T>(raw:string|null):T|null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}
const inr      = (n:number) => '₹'+Math.round(Number.isFinite(n)?n:0).toLocaleString('en-IN');
const uid      = () => `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
const rndCode  = () => 'AW-'+Array.from({length:6},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
const tlIdx    = (s:OrderStatus):number => ({PENDING:0,ASSIGNED:2,IN_PROGRESS:3,COMPLETED:4,CANCELLED:0}[s]??0);
const getIni   = (name:string) => name?.trim().split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase()||'U';
const greet    = () => { if(typeof window==='undefined') return 'Welcome'; const h=new Date().getHours(); return h<12?'Good morning':h<17?'Good afternoon':'Good evening'; };
const relT     = (ts:number) => {
  const d=Date.now()-ts;
  if(d<60_000) return 'Just now';
  if(d<3600_000) return `${Math.floor(d/60_000)}m ago`;
  if(d<86400_000) return `${Math.floor(d/3600_000)}h ago`;
  const days=Math.floor(d/86400_000); return days===1?'Yesterday':`${days}d ago`;
};
const fmtDate  = (ts:number) => new Date(ts).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
const fmtDT    = (ts:number) => new Date(ts).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});

function calcBreakdown(o:StoredOrder) {
  const conv=29, emg=o.emergency?199:0, total=Math.round(o.total);
  for(let base=0;base<=50000;base++){
    const gst=Math.round((base+conv)*0.18);
    if(base+conv+emg+gst===total) return {base,conv,emg,gst,total};
  }
  const gst=Math.round(Math.max(0,total-conv-emg)*0.18);
  return {base:Math.max(0,total-conv-emg-gst),conv,emg,gst,total};
}

/* ═══════════════════════════════════════════════════════════════
   SEED
═══════════════════════════════════════════════════════════════ */
function buildSeed(profileName:string,profileEmail:string) {
  const now=Date.now();
  const firstName=profileName?.trim()?.split(' ')[0]||'Customer';
  const a1:Address={id:'addr_s1',houseFlat:'Flat 402',area:'Bara 8 Cross, Near City Mall',city:'Kanpur',pincode:'208027',landmark:'City Mall Road',createdAt:now-10*86400_000,isDefault:true,label:'Home'};
  const a2:Address={id:'addr_s2',houseFlat:'House No. 19',area:'Sector 62',city:'Noida',pincode:'201301',createdAt:now-5*86400_000,isDefault:false,label:'Office'};
  const orders:StoredOrder[]=[
    {id:'AW-10029841',status:'IN_PROGRESS',createdAt:now-3600_000,updatedAt:now-900_000,serviceKey:'tank_cleaning',subOptionKey:'full',address:a2,scheduledDate:new Date().toISOString().slice(0,10),timeKey:'Morning',emergency:false,total:599,paymentMethod:'online',paymentStatus:'paid',technicianName:TECH_DB.tank_cleaning.name,technicianPhone:TECH_DB.tank_cleaning.phone},
    {id:'AW-10029612',status:'PENDING',createdAt:now-6*86400_000,updatedAt:now-6*86400_000,serviceKey:'ro_service',subOptionKey:'filter',address:a1,scheduledDate:'2026-03-28',timeKey:'Afternoon',emergency:false,total:279,paymentMethod:'cash',paymentStatus:'unpaid'},
    {id:'AW-10028990',status:'COMPLETED',createdAt:now-10*86400_000,updatedAt:now-9*86400_000,serviceKey:'water_tanker',subOptionKey:'standard',address:a1,scheduledDate:'2026-03-20',timeKey:'Morning',emergency:false,total:449,paymentMethod:'cash',paymentStatus:'paid',technicianName:TECH_DB.water_tanker.name,technicianPhone:TECH_DB.water_tanker.phone},
    {id:'AW-10027744',status:'COMPLETED',createdAt:now-20*86400_000,updatedAt:now-19*86400_000,serviceKey:'plumbing',subOptionKey:'pipe',address:a1,scheduledDate:'2026-03-10',timeKey:'Afternoon',emergency:false,total:349,paymentMethod:'online',paymentStatus:'paid',technicianName:TECH_DB.plumbing.name,technicianPhone:TECH_DB.plumbing.phone},
    {id:'AW-10026533',status:'CANCELLED',createdAt:now-15*86400_000,updatedAt:now-14*86400_000,serviceKey:'borewell',subOptionKey:'drill',address:a1,scheduledDate:'2026-03-15',timeKey:'Morning',emergency:false,total:999,paymentMethod:'cash',paymentStatus:'unpaid'},
  ];
  const notifs:NotificationItem[]=[
    {id:uid(),icon:'⚡',title:'Technician En Route',body:`${TECH_DB.tank_cleaning.name} is on the way. ETA ~12 min.`,ts:now-3*60_000,read:false,category:'booking',orderId:'AW-10029841'},
    {id:uid(),icon:'✅',title:'Order Confirmed',body:'Your RO service is confirmed for Mar 28, Afternoon slot.',ts:now-2*3600_000,read:false,category:'booking',orderId:'AW-10029612'},
    {id:uid(),icon:'💳',title:'Payment Received',body:'₹599 received for Tank Cleaning (AW-10029841).',ts:now-3600_000,read:true,category:'payment',orderId:'AW-10029841'},
    {id:uid(),icon:'⭐',title:'Rate Your Experience',body:`${firstName}, how was your Water Tanker delivery on Mar 20?`,ts:now-9*86400_000,read:true,category:'booking',orderId:'AW-10028990'},
    {id:uid(),icon:'🎁',title:'Refer & Earn',body:'Share your referral code — earn ₹50 credit per booking.',ts:now-2*86400_000,read:true,category:'promo'},
  ];
  const activity:ActivityLog[]=[
    {id:uid(),ts:now-3600_000,     type:'order_placed',   label:'Booked Tank Cleaning',   meta:'AW-10029841 · ₹599'},
    {id:uid(),ts:now-6*86400_000,  type:'order_placed',   label:'Booked RO Service',      meta:'AW-10029612 · ₹279'},
    {id:uid(),ts:now-9*86400_000,  type:'payment_made',   label:'Paid for Water Tanker',  meta:'₹449 · Cash'},
    {id:uid(),ts:now-10*86400_000, type:'order_placed',   label:'Booked Water Tanker',    meta:'AW-10028990 · ₹449'},
    {id:uid(),ts:now-14*86400_000, type:'order_cancelled',label:'Cancelled Borewell',     meta:'AW-10026533'},
    {id:uid(),ts:now-19*86400_000, type:'payment_made',   label:'Paid for Plumbing',      meta:'₹349 · Online'},
    {id:uid(),ts:now-20*86400_000, type:'order_placed',   label:'Booked Plumbing',        meta:'AW-10027744 · ₹349'},
  ];
  return {orders,addresses:[a1,a2],notifs,activity};
}

/* ═══════════════════════════════════════════════════════════════
   MICRO COMPONENTS
═══════════════════════════════════════════════════════════════ */
function Chip({status}:{status:OrderStatus}) {
  const cfg = STATUS_CFG[status];
  return (
    <span style={{background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.dot_color}44`}}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap">
      {cfg.dot
        ? <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:cfg.dot_color}}/>
        : <span className="w-1.5 h-1.5 rounded-full" style={{background:cfg.dot_color}}/>
      }
      {cfg.label}
    </span>
  );
}

function Count({to}:{to:number}) {
  const [v,setV]=useState(0);
  const r=useRef<number>(0);
  useEffect(()=>{
    const t0=performance.now(),dur=700;
    const tick=(n:number)=>{ const t=Math.min(1,(n-t0)/dur); setV(Math.round(to*(1-Math.pow(1-t,3)))); if(t<1) r.current=requestAnimationFrame(tick); };
    setV(0); r.current=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(r.current);
  },[to]);
  return <>{v}</>;
}

function WaterBg() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1440 320" preserveAspectRatio="none" style={{height:'35vh'}}>
        <defs>
          <linearGradient id="wg1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#DBEAFE" stopOpacity="0.5"/>
            <stop offset="100%" stopColor="#BFDBFE" stopOpacity="0.15"/>
          </linearGradient>
        </defs>
        <path fill="url(#wg1)" d="M0,160L48,170.7C96,181,192,203,288,192C384,181,480,139,576,133.3C672,128,768,160,864,165.3C960,171,1056,149,1152,144C1248,139,1344,149,1392,154.7L1440,160L1440,320L0,320Z">
          <animate attributeName="d" dur="8s" repeatCount="indefinite"
            values="M0,160L48,170.7C96,181,192,203,288,192C384,181,480,139,576,133.3C672,128,768,160,864,165.3C960,171,1056,149,1152,144C1248,139,1344,149,1392,154.7L1440,160L1440,320L0,320Z;M0,192L48,186.7C96,181,192,171,288,176C384,181,480,203,576,197.3C672,192,768,160,864,144C960,128,1056,139,1152,149.3C1248,160,1344,181,1392,192L1440,203L1440,320L0,320Z;M0,160L48,170.7C96,181,192,203,288,192C384,181,480,139,576,133.3C672,128,768,160,864,165.3C960,171,1056,149,1152,144C1248,139,1344,149,1392,154.7L1440,160L1440,320L0,320Z"/>
        </path>
        <path fill="#BFDBFE" fillOpacity="0.2" d="M0,256L48,245.3C96,235,192,213,288,224C384,235,480,277,576,282.7C672,288,768,256,864,240C960,224,1056,224,1152,234.7C1248,245,1344,267,1392,277.3L1440,288L1440,320L0,320Z">
          <animate attributeName="d" dur="11s" repeatCount="indefinite"
            values="M0,256L48,245.3C96,235,192,213,288,224C384,235,480,277,576,282.7C672,288,768,256,864,240C960,224,1056,224,1152,234.7C1248,245,1344,267,1392,277.3L1440,288L1440,320L0,320Z;M0,288L48,277.3C96,267,192,245,288,229.3C384,213,480,203,576,208C672,213,768,235,864,250.7C960,267,1056,277,1152,272C1248,267,1344,245,1392,234.7L1440,224L1440,320L0,320Z;M0,256L48,245.3C96,235,192,213,288,224C384,235,480,277,576,282.7C672,288,768,256,864,240C960,224,1056,224,1152,234.7C1248,245,1344,267,1392,277.3L1440,288L1440,320L0,320Z"/>
        </path>
      </svg>
      {[{s:36,x:'7%',d:'14s',o:0.06,del:'0s'},{s:22,x:'21%',d:'19s',o:0.04,del:'3s'},{s:50,x:'41%',d:'12s',o:0.05,del:'6s'},{s:18,x:'61%',d:'22s',o:0.04,del:'1s'},{s:40,x:'79%',d:'16s',o:0.05,del:'4s'},{s:28,x:'91%',d:'20s',o:0.04,del:'8s'}].map((b,i)=>(
        <div key={i} className="absolute rounded-full bg-blue-400"
          style={{width:b.s,height:b.s,left:b.x,bottom:'-60px',opacity:b.o,animation:`floatUp ${b.d} ${b.del} ease-in-out infinite`}}/>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const router = useRouter();
  const {role:authRole} = useAuth();

  const [hydrated,    setHydrated]    = useState(false);
  const [tab,         setTab]         = useState<TabKey>('overview');
  const [clock,       setClock]       = useState('');
  const [orders,      setOrders]      = useState<StoredOrder[]>([]);
  const [addresses,   setAddresses]   = useState<Address[]>([]);
  const [notifs,      setNotifs]      = useState<NotificationItem[]>([]);
  const [profile,     setProfile]     = useState<Profile>({name:'',email:'',phone:''});
  const [reviews,     setReviews]     = useState<Review[]>([]);
  const [activity,    setActivity]    = useState<ActivityLog[]>([]);
  const [refCode,     setRefCode]     = useState('');
  const [expandedId,  setExpandedId]  = useState<string|null>(null);
  const [cancelId,    setCancelId]    = useState<string|null>(null);
  const [rDrafts,     setRDrafts]     = useState<Record<string,{stars:number;text:string}>>({});
  const [filter,      setFilter]      = useState<OrderFilter>('all');
  const [addErr,      setAddErr]      = useState<string|null>(null);
  const [pEdit,       setPEdit]       = useState(false);
  const [pDraft,      setPDraft]      = useState<Profile>({name:'',email:'',phone:''});
  const [addForm,     setAddForm]     = useState({label:'Home',houseFlat:'',area:'',city:'',pincode:'',landmark:''});
  const [copied,      setCopied]      = useState(false);
  const [lastRefresh, setLastRefresh] = useState(0);
  const [refreshing,  setRefreshing]  = useState(false);

  const roleLabel=({technician:'Technician',supplier:'Supplier',admin:'Admin'} as Record<string,string>)[authRole??'']??'Customer';

  const pOrders  =useCallback((n:StoredOrder[])       =>{setOrders(n);      lsSet(SK.ORDERS,       JSON.stringify(n));}, []);
  const pAddrs   =useCallback((n:Address[])           =>{setAddresses(n);   lsSet(SK.ADDRESSES,    JSON.stringify(n));}, []);
  const pNotifs  =useCallback((n:NotificationItem[])  =>{setNotifs(n);      lsSet(SK.NOTIFICATIONS,JSON.stringify(n));}, []);
  const pReviews =useCallback((n:Review[])            =>{setReviews(n);     lsSet(SK.REVIEWS,      JSON.stringify(n));}, []);
  const pActivity=useCallback((n:ActivityLog[])       =>{setActivity(n);    lsSet(SK.ACTIVITY,     JSON.stringify(n));}, []);

  const logAct=useCallback((type:ActivityLog['type'],label:string,meta?:string,base?:ActivityLog[])=>{
    const log:ActivityLog={id:uid(),ts:Date.now(),type,label,meta};
    const arr=base??activity;
    pActivity([log,...arr].slice(0,100));
  },[activity,pActivity]);

  useEffect(()=>{
    const tick=()=>setClock(new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}));
    tick(); const id=setInterval(tick,1000); return ()=>clearInterval(id);
  },[]);

  useEffect(()=>{
    const h=(e:StorageEvent)=>{
      if(e.key===SK.ORDERS        &&e.newValue) setOrders(sp<StoredOrder[]>(e.newValue)??[]);
      if(e.key===SK.ADDRESSES     &&e.newValue) setAddresses(sp<Address[]>(e.newValue)??[]);
      if(e.key===SK.NOTIFICATIONS &&e.newValue) setNotifs(sp<NotificationItem[]>(e.newValue)??[]);
      if(e.key===SK.REVIEWS       &&e.newValue) setReviews(sp<Review[]>(e.newValue)??[]);
      if(e.key===SK.ACTIVITY      &&e.newValue) setActivity(sp<ActivityLog[]>(e.newValue)??[]);
      if(e.key===SK.PROFILE       &&e.newValue){ const p=sp<Profile>(e.newValue); if(p){setProfile(p);setPDraft(p);} }
    };
    window.addEventListener('storage',h);
    return ()=>window.removeEventListener('storage',h);
  },[]);

  useEffect(()=>{
    const sp2=new URLSearchParams(window.location.search);
    const raw=sp2.get('tab')?.toLowerCase()??'';
    const tabs:TabKey[]=['overview','orders','notifications','addresses','activity','profile'];
    if(tabs.includes(raw as TabKey)) setTab(raw as TabKey);

    const authProfile=sp<Profile>(lsGet('aurowater_profile'))||sp<Profile>(lsGet(SK.PROFILE));
    const realProfile:Profile={name:authProfile?.name||'',email:authProfile?.email||'',phone:authProfile?.phone||'',updatedAt:authProfile?.updatedAt};
    if(realProfile.name){setProfile(realProfile);setPDraft(realProfile);}

    const sO=sp<StoredOrder[]>(lsGet(SK.ORDERS));
    const sA=sp<Address[]>(lsGet(SK.ADDRESSES));
    const sN=sp<NotificationItem[]>(lsGet(SK.NOTIFICATIONS));
    const sR=sp<Review[]>(lsGet(SK.REVIEWS));
    const sAc=sp<ActivityLog[]>(lsGet(SK.ACTIVITY));
    const sRef=lsGet(SK.REFERRAL);
    const seeded=lsGet(SK.SEEDED);

    if(!seeded&&(!Array.isArray(sO)||sO.length===0)){
      const {orders:o,addresses:a,notifs:n,activity:act}=buildSeed(realProfile.name,realProfile.email);
      setOrders(o);setAddresses(a);setNotifs(n);setActivity(act);
      lsSet(SK.ORDERS,JSON.stringify(o));lsSet(SK.ADDRESSES,JSON.stringify(a));
      lsSet(SK.NOTIFICATIONS,JSON.stringify(n));lsSet(SK.ACTIVITY,JSON.stringify(act));
      lsSet(SK.SEEDED,'1');
    } else {
      if(Array.isArray(sO)) setOrders(sO);
      if(Array.isArray(sA)) setAddresses(sA);
      if(Array.isArray(sN)) setNotifs(sN);
    }
    if(Array.isArray(sR))  setReviews(sR);
    if(Array.isArray(sAc)) setActivity(sAc);

    const code=sRef?.trim()||rndCode();
    setRefCode(code);
    if(!sRef) lsSet(SK.REFERRAL,code);
    setLastRefresh(Date.now());
    setHydrated(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const stats=useMemo(()=>{
    const completed=orders.filter(o=>o.status==='COMPLETED');
    const active=orders.filter(o=>o.status!=='COMPLETED'&&o.status!=='CANCELLED');
    const inProgress=orders.find(o=>o.status==='IN_PROGRESS')??null;
    const spent=completed.reduce((s,o)=>s+o.total,0);
    const unread=notifs.filter(n=>!n.read).length;
    const avgRating=reviews.length?reviews.reduce((s,r)=>s+r.rating,0)/reviews.length:null;
    return {total:orders.length,active:active.length,completed:completed.length,
            cancelled:orders.filter(o=>o.status==='CANCELLED').length,spent,unread,avgRating,inProgress};
  },[orders,notifs,reviews]);

  const visibleOrders=useMemo(()=>{
    if(filter==='active')    return orders.filter(o=>o.status!=='COMPLETED'&&o.status!=='CANCELLED');
    if(filter==='completed') return orders.filter(o=>o.status==='COMPLETED');
    if(filter==='cancelled') return orders.filter(o=>o.status==='CANCELLED');
    return orders;
  },[orders,filter]);

  const doRefresh=useCallback(()=>{
    setRefreshing(true);
    const sO=sp<StoredOrder[]>(lsGet(SK.ORDERS)); const sA=sp<Address[]>(lsGet(SK.ADDRESSES));
    const sN=sp<NotificationItem[]>(lsGet(SK.NOTIFICATIONS)); const sAc=sp<ActivityLog[]>(lsGet(SK.ACTIVITY));
    if(Array.isArray(sO)) setOrders(sO); if(Array.isArray(sA)) setAddresses(sA);
    if(Array.isArray(sN)) setNotifs(sN); if(Array.isArray(sAc)) setActivity(sAc);
    setLastRefresh(Date.now()); setTimeout(()=>setRefreshing(false),600);
    toast.success('Dashboard refreshed.');
  },[]);

  const doCancelOrder=useCallback(()=>{
    if(!cancelId) return;
    const now=Date.now();
    pOrders(orders.map(o=>o.id===cancelId?{...o,status:'CANCELLED' as const,updatedAt:now}:o));
    pNotifs([{id:uid(),icon:'❌',title:'Order Cancelled',body:`Order ${cancelId} has been cancelled.`,ts:now,read:false,category:'booking',orderId:cancelId},...notifs]);
    logAct('order_cancelled',`Cancelled ${cancelId}`,cancelId);
    setCancelId(null);setExpandedId(null);
    toast.error('Order cancelled.');
  },[cancelId,orders,notifs,pOrders,pNotifs,logAct]);

  const doReview=useCallback((orderId:string)=>{
    const d=rDrafts[orderId];
    if(!d?.stars){toast.error('Select a star rating first.');return;}
    const rev:Review={orderId,rating:Math.min(5,Math.max(1,d.stars)),text:d.text?.trim()||undefined,createdAt:Date.now()};
    const idx=reviews.findIndex(r=>r.orderId===orderId);
    pReviews(idx>=0?reviews.map((r,i)=>i===idx?rev:r):[rev,...reviews]);
    const o=orders.find(x=>x.id===orderId);
    logAct('review_submitted',`Rated ${SVC[o?.serviceKey??'plumbing'].label}`,`${d.stars}★`);
    toast.success('Review submitted! ⭐');
  },[rDrafts,reviews,orders,pReviews,logAct]);

  const doSetDefault=useCallback((id:string)=>{ pAddrs(addresses.map(a=>({...a,isDefault:a.id===id}))); toast.success('Default address set.'); },[addresses,pAddrs]);

  const doDelAddr=useCallback((id:string)=>{
    const next=addresses.filter(a=>a.id!==id);
    if(next.length&&!next.some(a=>a.isDefault)) next[0].isDefault=true;
    pAddrs(next); toast.success('Address removed.');
  },[addresses,pAddrs]);

  const doSaveAddr=useCallback(()=>{
    setAddErr(null);
    const {houseFlat,area,city,pincode,landmark,label}=addForm;
    if(!houseFlat.trim()||!area.trim()||!city||!pincode.trim()){setAddErr('House/Flat, Area, City and Pincode are required.');return;}
    if(!/^\d{6}$/.test(pincode.trim())){setAddErr('Pincode must be 6 digits.');return;}
    const now=Date.now();
    const na:Address={id:`addr_${uid()}`,houseFlat:houseFlat.trim(),area:area.trim(),city,pincode:pincode.trim(),landmark:landmark.trim()||undefined,label:label||'Home',createdAt:now,isDefault:addresses.length===0};
    pAddrs(addresses.length===0?[na]:[na,...addresses]);
    logAct('address_added',`Added ${label} address`,`${city} - ${pincode}`);
    setAddForm({label:'Home',houseFlat:'',area:'',city:'',pincode:'',landmark:''});
    toast.success('Address saved!');
  },[addForm,addresses,pAddrs,logAct]);

  const doMarkAllRead=useCallback(()=>{ pNotifs(notifs.map(n=>({...n,read:true}))); toast.success('All marked as read.'); },[notifs,pNotifs]);
  const doMarkRead=useCallback((id:string)=>{ pNotifs(notifs.map(n=>n.id===id?{...n,read:true}:n)); },[notifs,pNotifs]);

  const doSaveProfile=useCallback(()=>{
    if(!pDraft.name.trim()){toast.error('Name is required.');return;}
    const p:Profile={...pDraft,updatedAt:Date.now()};
    setProfile(p);setPDraft(p);
    lsSet(SK.PROFILE,JSON.stringify(p));lsSet('aurowater_profile',JSON.stringify(p));
    logAct('profile_updated','Profile updated',pDraft.name);
    setPEdit(false); toast.success('Profile saved!');
  },[pDraft,logAct]);

  const doCopyRef=useCallback(async()=>{
    try{await navigator.clipboard.writeText(refCode);setCopied(true);setTimeout(()=>setCopied(false),2000);toast.success('Referral code copied!');}
    catch{toast.error('Copy failed — copy manually.');}
  },[refCode]);

  type NavIcon = React.ReactElement;
  const NAV:{key:TabKey;label:string;short:string;badge?:number;icon:NavIcon}[]=[
    {key:'overview',      label:'Overview',      short:'Home',
     icon:<svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h4v-5h2v5h4a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>},
    {key:'orders',        label:'My Orders',     short:'Orders',  badge:stats.active||undefined,
     icon:<svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z"/><path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" clipRule="evenodd"/></svg>},
    {key:'notifications', label:'Notifications', short:'Alerts',  badge:stats.unread||undefined,
     icon:<svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg>},
    {key:'addresses',     label:'Addresses',     short:'Places',
     icon:<svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>},
    {key:'activity',      label:'Activity',      short:'Logs',
     icon:<svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/></svg>},
    {key:'profile',       label:'Profile',       short:'Me',
     icon:<svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/></svg>},
  ];

  /* ── Loading screen ── */
  if(!hydrated) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'linear-gradient(135deg,#EFF6FF,#F0F9FF,#E0F2FE)'}}>
      <div className="text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl mb-4 animate-bounce"
          style={{background:'linear-gradient(135deg,#2563EB,#0891B2)',boxShadow:'0 8px 24px rgba(37,99,235,0.35)'}}>💧</div>
        <p style={{fontFamily:"'DM Sans',sans-serif",color:'#1D4ED8',fontWeight:600,fontSize:14}}>Loading your dashboard…</p>
      </div>
    </div>
  );

  const displayName=profile.name?.trim()?.split(' ')[0]||'Customer';

  /* ── Shared mini helpers ── */
  const Section = ({title,sub,right}:{title:string;sub?:string;right?:React.ReactNode}) => (
    <div className="d-section-head">
      <div>
        <h1 className="d-section-title">{title}</h1>
        {sub&&<p className="d-section-sub">{sub}</p>}
      </div>
      {right&&<div className="shrink-0">{right}</div>}
    </div>
  );

  return (
    <>
      {/* ════════════════════════════════════════════════
          GLOBAL STYLES
      ════════════════════════════════════════════════ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@300;400;500;600;700&display=swap');

        /* ── Reset & base ── */
        .d-root *, .d-root *::before, .d-root *::after { box-sizing:border-box; }
        .d-root { font-family:'DM Sans',sans-serif; min-height:100vh; background:#F0F6FF; }
        .d-syne { font-family:'Syne',sans-serif; }

        /* ── Scrollbar ── */
        .d-root ::-webkit-scrollbar { width:4px; }
        .d-root ::-webkit-scrollbar-track { background:transparent; }
        .d-root ::-webkit-scrollbar-thumb { background:#BFDBFE; border-radius:99px; }

        /* ── Keyframes ── */
        @keyframes floatUp    { 0%{transform:translateY(0);opacity:0.06} 50%{transform:translateY(-40vh) scale(1.1);opacity:0.03} 100%{transform:translateY(-80vh) scale(0.8);opacity:0} }
        @keyframes dFadeUp    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dSlideIn   { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
        @keyframes dSpin      { to{transform:rotate(360deg)} }
        @keyframes dPulse     { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes dShimmer   { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        @keyframes dPulseRing { 0%,100%{box-shadow:0 0 0 0 rgba(37,99,235,0.45)} 50%{box-shadow:0 0 0 10px rgba(37,99,235,0)} }

        .d-fade  { animation:dFadeUp  0.25s ease both; }
        .d-slide { animation:dSlideIn 0.22s ease both; }
        .d-spin  { animation:dSpin 0.65s linear infinite; }

        /* ════ SIDEBAR ════════════════════════════════ */
        .d-sidebar {
          position:fixed; top:0; left:0; bottom:0; width:256px;
          background:linear-gradient(180deg,#0A1628 0%,#0F2557 55%,#1A3A8F 100%);
          display:flex; flex-direction:column; z-index:40;
          box-shadow:4px 0 32px rgba(0,0,0,0.2);
        }
        .d-sidebar-logo {
          display:flex; align-items:center; gap:11px;
          padding:20px 20px 18px;
          border-bottom:1px solid rgba(255,255,255,0.08);
        }
        .d-sidebar-logo-icon {
          width:38px; height:38px; border-radius:11px;
          background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.15);
          display:flex; align-items:center; justify-content:center; font-size:18px;
        }
        .d-sidebar-wordmark {
          font-family:'Syne',sans-serif; font-weight:900;
          font-size:1.05rem; color:#fff; letter-spacing:-0.3px; line-height:1;
        }
        .d-sidebar-tagline { font-size:10px; color:rgba(255,255,255,0.38); margin-top:2px; font-weight:500; }

        /* User card in sidebar */
        .d-user-card {
          margin:14px 14px 0;
          background:rgba(255,255,255,0.07);
          border:1px solid rgba(255,255,255,0.12);
          border-radius:16px; padding:14px;
        }
        .d-user-ava {
          width:38px; height:38px; border-radius:11px; flex-shrink:0;
          background:linear-gradient(135deg,#DBEAFE,#BFDBFE);
          color:#1E3A8A; font-family:'Syne',sans-serif; font-weight:900;
          font-size:13px; display:flex; align-items:center; justify-content:center;
        }
        .d-user-name { font-size:13px; font-weight:700; color:#fff; line-height:1.2; }
        .d-user-email { font-size:11px; color:rgba(255,255,255,0.4); margin-top:1px; }
        .d-role-pill {
          font-size:9px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase;
          background:rgba(96,165,250,0.15); border:1px solid rgba(96,165,250,0.25);
          color:#93C5FD; padding:2px 8px; border-radius:99px;
        }
        .d-clock { font-size:10px; color:rgba(255,255,255,0.3); font-weight:500; font-variant-numeric:tabular-nums; }

        /* Nav links */
        .d-nav-link {
          display:flex; align-items:center; gap:10px;
          padding:9px 12px; border-radius:11px;
          font-size:13px; font-weight:500; color:rgba(255,255,255,0.55);
          cursor:pointer; width:100%; text-align:left;
          border:none; background:none; transition:all 0.15s;
          font-family:'DM Sans',sans-serif; border-left:3px solid transparent;
        }
        .d-nav-link:hover { background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.85); }
        .d-nav-link.active {
          background:rgba(255,255,255,0.12); color:#fff; font-weight:700;
          border-left-color:#60A5FA;
        }
        .d-nav-badge {
          font-size:9px; font-weight:800; padding:2px 6px;
          border-radius:99px; min-width:18px; text-align:center;
        }
        .d-nav-badge.active-b { background:rgba(255,255,255,0.2); color:#fff; }
        .d-nav-badge.inactive-b { background:#fff; color:#1D4ED8; }

        /* Sidebar bottom */
        .d-sidebar-bottom { padding:12px; border-top:1px solid rgba(255,255,255,0.08); }
        .d-sidebar-action {
          display:flex; align-items:center; gap:9px;
          padding:9px 12px; border-radius:11px; width:100%;
          font-size:12.5px; font-weight:700; color:rgba(255,255,255,0.7);
          background:none; border:none; cursor:pointer; transition:all 0.15s;
          font-family:'DM Sans',sans-serif;
        }
        .d-sidebar-action:hover { background:rgba(255,255,255,0.1); color:#fff; }
        .d-sidebar-action.cta { background:rgba(255,255,255,0.14); color:#fff; margin-bottom:4px; }

        /* ════ TOPBAR ════════════════════════════════ */
        .d-topbar {
          position:sticky; top:0; z-index:30;
          background:rgba(240,246,255,0.92);
          backdrop-filter:blur(16px) saturate(180%);
          border-bottom:1px solid #DBEAFE;
          transition:box-shadow 0.2s;
        }
        .d-topbar-inner {
          max-width:1040px; margin:0 auto;
          padding:0 20px; height:58px;
          display:flex; align-items:center; gap:10px;
        }
        .d-topbar-title {
          flex:1;
          font-size:13.5px; font-weight:600; color:#1E40AF;
        }
        .d-live-pill {
          display:inline-flex; align-items:center; gap:5px;
          background:#EFF6FF; border:1px solid #BFDBFE;
          color:#1D4ED8; padding:5px 11px; border-radius:99px;
          font-size:10px; font-weight:700; letter-spacing:0.04em;
        }
        .d-icon-btn {
          width:34px; height:34px; border-radius:10px;
          background:#EFF6FF; border:1px solid #DBEAFE;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; transition:all 0.14s; color:#2563EB;
        }
        .d-icon-btn:hover { background:#DBEAFE; border-color:#93C5FD; }
        .d-topbar-book {
          display:inline-flex; align-items:center; gap:6px;
          padding:8px 16px; border-radius:10px;
          background:#2563EB; color:#fff;
          font-family:'DM Sans',sans-serif; font-weight:700; font-size:12.5px;
          border:none; cursor:pointer; transition:all 0.15s;
          box-shadow:0 3px 10px rgba(37,99,235,0.3);
        }
        .d-topbar-book:hover { background:#1D4ED8; box-shadow:0 5px 16px rgba(37,99,235,0.38); transform:translateY(-1px); }

        /* ════ CONTENT AREA ════════════════════════════ */
        .d-content { max-width:1040px; margin:0 auto; padding:22px 20px 80px; }

        /* ── Section head ── */
        .d-section-head {
          display:flex; align-items:center; justify-content:space-between;
          gap:12px; flex-wrap:wrap;
          background:#fff; border-radius:18px;
          border:1px solid #DBEAFE;
          box-shadow:0 1px 3px rgba(0,0,0,0.04);
          padding:18px 22px; margin-bottom:18px;
        }
        .d-section-title { font-family:'Syne',sans-serif; font-weight:900; font-size:1.25rem; color:#0A1628; letter-spacing:-0.5px; margin:0; }
        .d-section-sub   { font-size:13px; color:#64748B; margin-top:3px; }

        /* ── Cards ── */
        .d-card {
          background:#fff; border-radius:18px; border:1px solid #DBEAFE;
          box-shadow:0 1px 3px rgba(0,0,0,0.04),0 4px 16px rgba(37,99,235,0.05);
        }
        .d-card-hover {
          transition:transform 0.2s,box-shadow 0.2s,border-color 0.2s; cursor:pointer;
        }
        .d-card-hover:hover {
          transform:translateY(-2px);
          box-shadow:0 6px 24px rgba(37,99,235,0.12);
          border-color:#93C5FD;
        }

        /* ── Stat cards ── */
        .d-stat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:18px; }
        .d-stat {
          background:#fff; border-radius:18px; border:1px solid #DBEAFE;
          box-shadow:0 1px 3px rgba(0,0,0,0.04),0 4px 16px rgba(37,99,235,0.05);
          padding:18px 20px; position:relative; overflow:hidden;
          animation:dFadeUp 0.4s ease both;
        }
        .d-stat-label { font-size:10px; font-weight:700; color:#94A3B8; text-transform:uppercase; letter-spacing:0.09em; margin-bottom:6px; }
        .d-stat-value { font-family:'Syne',sans-serif; font-weight:900; font-size:1.85rem; letter-spacing:-1px; line-height:1; color:#0A1628; margin-bottom:4px; }
        .d-stat-sub   { font-size:11px; color:#94A3B8; font-weight:500; }
        .d-stat-bar   { position:absolute; bottom:0; left:0; right:0; height:2.5px; }
        .d-stat-dark  { background:linear-gradient(135deg,#0A1628,#1E3A8A); border:none; }
        .d-stat-warn  { background:#FFFBEB; border-color:#FDE68A; }

        /* ── Inputs ── */
        .d-inp {
          width:100%; background:#F8FAFF; border:1.5px solid #DBEAFE;
          border-radius:11px; padding:10px 14px;
          font-size:13.5px; font-weight:500; color:#0A1628;
          font-family:'DM Sans',sans-serif;
          outline:none; transition:all 0.15s;
        }
        .d-inp:focus { border-color:#2563EB; background:#fff; box-shadow:0 0 0 3px rgba(37,99,235,0.1); }
        .d-inp::placeholder { color:#94A3B8; }

        /* ── Buttons ── */
        .d-btn {
          display:inline-flex; align-items:center; justify-content:center; gap:7px;
          border-radius:11px; font-size:13px; font-weight:700; cursor:pointer;
          border:none; transition:all 0.15s; font-family:'DM Sans',sans-serif;
          white-space:nowrap;
        }
        .d-btn:active { transform:scale(0.97); }
        .d-btn-primary {
          background:#2563EB; color:#fff; padding:10px 20px;
          box-shadow:0 3px 12px rgba(37,99,235,0.28);
        }
        .d-btn-primary:hover { background:#1D4ED8; box-shadow:0 5px 18px rgba(37,99,235,0.36); transform:translateY(-1px); }
        .d-btn-outline {
          background:#fff; color:#2563EB; padding:9px 18px;
          border:1.5px solid #BFDBFE;
        }
        .d-btn-outline:hover { background:#EFF6FF; border-color:#60A5FA; }
        .d-btn-danger {
          background:#FEF2F2; color:#DC2626; padding:9px 18px;
          border:1.5px solid #FECACA;
        }
        .d-btn-danger:hover { background:#FEE2E2; }
        .d-btn-dark {
          background:#0A1628; color:#fff; padding:10px 20px;
          box-shadow:0 3px 12px rgba(10,22,40,0.2);
        }
        .d-btn-sm { padding:6px 13px; font-size:12px; border-radius:9px; }

        /* ── Order rows ── */
        .d-order {
          background:#fff; border:1.5px solid #DBEAFE; border-radius:16px;
          cursor:pointer; transition:all 0.18s;
        }
        .d-order:hover { border-color:#93C5FD; background:#FAFCFF; }
        .d-order.open  { border-color:#2563EB; border-width:2px; }

        /* ── Timeline ── */
        .tl-dot {
          width:30px; height:30px; border-radius:50%;
          border:2px solid #DBEAFE; display:flex; align-items:center;
          justify-content:center; font-size:10px; font-weight:800;
          color:#94A3B8; background:#fff; flex-shrink:0;
        }
        .tl-dot.done { background:linear-gradient(135deg,#2563EB,#0891B2); border-color:#2563EB; color:#fff; }
        .tl-dot.curr { background:#fff; border-color:#2563EB; color:#2563EB; animation:dPulseRing 2s ease infinite; }
        .tl-line { flex:1; height:2px; background:#DBEAFE; margin:0 4px; margin-bottom:22px; }
        .tl-line.done { background:linear-gradient(90deg,#2563EB,#0891B2); }

        /* ── Notification ── */
        .d-notif-unread { border-left:3px solid #2563EB !important; }

        /* ── Shimmer skeleton ── */
        .d-shimmer {
          background:linear-gradient(90deg,#F0F6FF 25%,#DBEAFE 50%,#F0F6FF 75%);
          background-size:800px 100%; animation:dShimmer 1.6s ease-in-out infinite;
          border-radius:8px;
        }

        /* ── Water Hero card ── */
        .d-water-hero {
          border-radius:22px; overflow:hidden; position:relative;
          background:linear-gradient(145deg,#0A1628 0%,#0F2A6F 50%,#1A3A8F 100%);
          border:1px solid rgba(96,165,250,0.2);
          box-shadow:0 8px 32px rgba(37,99,235,0.2);
          padding:28px 28px 0 28px;
          animation:dFadeUp 0.5s ease both;
        }
        .d-water-hero-eyebrow {
          display:inline-flex; align-items:center; gap:6px;
          background:rgba(96,165,250,0.12); border:1px solid rgba(96,165,250,0.25);
          padding:4px 12px; border-radius:99px;
          font-size:9px; font-weight:800; color:#93C5FD;
          letter-spacing:0.12em; text-transform:uppercase; margin-bottom:12px;
        }
        .d-water-hero-title {
          font-family:'Syne',sans-serif; font-weight:900;
          font-size:clamp(1.2rem,3vw,1.6rem);
          color:#fff; letter-spacing:-0.5px; line-height:1.1; margin:0 0 8px;
        }
        .d-water-hero-title span { color:#60A5FA; }
        .d-water-hero-sub { font-size:12.5px; color:rgba(255,255,255,0.5); margin-bottom:18px; line-height:1.5; }
        .d-water-hero-btns { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:22px; }
        .d-water-hero-btn-primary {
          display:inline-flex; align-items:center; gap:7px;
          padding:11px 20px; border-radius:12px;
          background:#2563EB; color:#fff;
          font-family:'DM Sans',sans-serif; font-weight:700; font-size:13px;
          border:none; cursor:pointer;
          box-shadow:0 4px 14px rgba(37,99,235,0.45);
          transition:all 0.18s;
        }
        .d-water-hero-btn-primary:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(37,99,235,0.55); }
        .d-water-hero-btn-ghost {
          display:inline-flex; align-items:center; gap:7px;
          padding:11px 18px; border-radius:12px;
          background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.8);
          border:1px solid rgba(255,255,255,0.15);
          font-family:'DM Sans',sans-serif; font-weight:600; font-size:13px;
          cursor:pointer; transition:all 0.18s;
        }
        .d-water-hero-btn-ghost:hover { background:rgba(255,255,255,0.15); }
        .d-water-hero-trust {
          display:flex; align-items:center; gap:14px; flex-wrap:wrap;
          padding:12px 0; border-top:1px solid rgba(255,255,255,0.08);
          margin-top:4px;
        }
        .d-water-hero-trust-item {
          display:flex; align-items:center; gap:5px;
          font-size:11px; color:rgba(255,255,255,0.45); font-weight:500;
        }
        .d-water-hero-wave {
          width:100%; height:80px; margin-top:-1px; display:block;
        }
        .d-water-hero-wave path { animation:waveHero 7s ease-in-out infinite; }
        .d-water-hero-wave path:nth-child(2) { animation-duration:9s; animation-direction:reverse; opacity:0.6; }
        @keyframes waveHero {
          0%,100% { d: path("M0,40 C240,70 480,10 720,40 C960,70 1200,15 1440,40 L1440,80 L0,80 Z"); }
          50%      { d: path("M0,55 C200,25 500,70 720,50 C940,30 1200,65 1440,55 L1440,80 L0,80 Z"); }
        }

        /* ── Quick stats strip ── */
        .d-qstat-strip {
          display:flex; gap:0; overflow:hidden;
          background:#fff; border-radius:16px; border:1px solid #DBEAFE;
          box-shadow:0 1px 3px rgba(0,0,0,0.04);
        }
        .d-qstat-item {
          flex:1; padding:14px 16px; text-align:center;
          border-right:1px solid #EEF5FF; position:relative;
        }
        .d-qstat-item:last-child { border-right:none; }
        .d-qstat-val { font-family:'Syne',sans-serif; font-weight:900; font-size:1.35rem; letter-spacing:-0.5px; line-height:1; color:#0A1628; }
        .d-qstat-lbl { font-size:9px; font-weight:700; color:#94A3B8; text-transform:uppercase; letter-spacing:0.08em; margin-top:4px; }
        .d-qstat-bar { position:absolute; bottom:0; left:10%; right:10%; height:2px; border-radius:1px; }

        /* ── Why us strip ── */
        .d-why-strip {
          display:grid; grid-template-columns:repeat(4,1fr); gap:0;
          background:#fff; border-radius:16px; border:1px solid #DBEAFE;
          box-shadow:0 1px 3px rgba(0,0,0,0.04); overflow:hidden;
        }
        .d-why-item { padding:14px 12px; border-right:1px solid #EEF5FF; text-align:center; }
        .d-why-item:last-child { border-right:none; }
        .d-why-icon { font-size:22px; margin-bottom:6px; }
        .d-why-title { font-size:11px; font-weight:700; color:#0A1628; }
        .d-why-sub   { font-size:10px; color:#94A3B8; margin-top:2px; }
        @media(max-width:640px) {
          .d-why-strip { grid-template-columns:repeat(2,1fr); }
          .d-why-item:nth-child(2) { border-right:none; }
          .d-why-item:nth-child(3) { border-right:1px solid #EEF5FF; border-top:1px solid #EEF5FF; }
          .d-why-item:nth-child(4) { border-top:1px solid #EEF5FF; border-right:none; }
          .d-qstat-strip { display:grid; grid-template-columns:1fr 1fr; }
          .d-qstat-item:nth-child(2) { border-right:none; }
          .d-qstat-item:nth-child(3) { border-top:1px solid #EEF5FF; border-right:1px solid #EEF5FF; }
          .d-qstat-item:nth-child(4) { border-top:1px solid #EEF5FF; border-right:none; }
        }

        /* ── Filter pills ── */
        .d-filter-pill {
          padding:6px 16px; border-radius:99px; font-size:12px; font-weight:700;
          border:1.5px solid #DBEAFE; background:#fff; color:#64748B;
          cursor:pointer; transition:all 0.15s;
        }
        .d-filter-pill:hover { border-color:#93C5FD; color:#2563EB; background:#EFF6FF; }
        .d-filter-pill.on { background:#2563EB; color:#fff; border-color:#2563EB; box-shadow:0 3px 10px rgba(37,99,235,0.25); }

        /* ── Mobile bottom nav ── */
        .d-mob-nav { display:flex; align-items:stretch; }
        .d-mob-btn {
          flex:1; display:flex; flex-direction:column; align-items:center; gap:3px;
          padding:8px 4px 10px; font-size:9px; font-weight:700; text-transform:uppercase;
          letter-spacing:0.05em; color:#94A3B8; background:none; border:none;
          cursor:pointer; position:relative; transition:color 0.15s;
          font-family:'DM Sans',sans-serif;
        }
        .d-mob-btn.on { color:#2563EB; }
        .d-mob-btn.on::before {
          content:''; position:absolute; top:0; left:50%; transform:translateX(-50%);
          width:22px; height:2.5px; background:#2563EB; border-radius:0 0 4px 4px;
        }

        /* ── Responsive ── */
        @media(max-width:1024px) {
          .d-sidebar { display:none; }
          .d-desktop-only { display:none !important; }
        }
        @media(min-width:1025px) {
          .d-mobile-only { display:none !important; }
          .d-content-wrap { padding-left:256px; }
        }
        @media(max-width:640px) {
          .d-stat-grid { grid-template-columns:1fr 1fr; gap:10px; }
          .d-stat-value { font-size:1.5rem; }
          .d-topbar-inner { padding:0 14px; }
          /* FIX: bottom padding must exceed mobile nav (64px) + safe margin */
          .d-content { padding:16px 14px 96px; }
          .d-section-head { padding:14px 16px; }
          /* FIX: service grid 3 cols on mobile */
          .d-svc-grid { grid-template-columns:repeat(3,1fr) !important; gap:8px !important; }
          /* FIX: order expanded grid 1 col on mobile */
          .d-order-detail-grid { grid-template-columns:1fr !important; }
          /* FIX: activity summary grid */
          .d-act-sum-grid { grid-template-columns:1fr 1fr !important; }
          /* FIX: profile stats grid */
          .d-profile-stats { grid-template-columns:1fr 1fr !important; }
          /* FIX: address grid 1 col on mobile */
          .d-addr-grid { grid-template-columns:1fr !important; }
          /* FIX: water hero compact on mobile */
          .d-water-hero { padding:20px 18px !important; }
          .d-water-hero-title { font-size:1.1rem !important; }
          .d-water-hero-wave { height:60px !important; }
        }
        @media(max-width:400px) {
          .d-stat-grid { grid-template-columns:1fr; }
          .d-svc-grid { grid-template-columns:repeat(2,1fr) !important; }
        }
      `}</style>

      <WaterBg/>

      <div className="d-root">
        <div className="d-content-wrap relative z-10 min-h-screen">

          {/* ════ SIDEBAR ═══════════════════════════════════════ */}
          <aside className="d-sidebar">
            {/* Logo */}
            <div className="d-sidebar-logo">
              <div className="d-sidebar-logo-icon">💧</div>
              <div>
                <div className="d-sidebar-wordmark">AuroWater</div>
                <div className="d-sidebar-tagline">Customer Portal</div>
              </div>
            </div>

            {/* User card */}
            <div className="d-user-card" style={{margin:'14px 14px 0'}}>
              <div style={{display:'flex',alignItems:'center',gap:11,marginBottom:10}}>
                <div className="d-user-ava">{getIni(profile.name||'U')}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div className="d-user-name" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {profile.name || <span style={{color:'rgba(255,255,255,0.35)',fontStyle:'italic',fontSize:11}}>Add your name</span>}
                  </div>
                  <div className="d-user-email" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{profile.email||'Add email'}</div>
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span className="d-role-pill">{roleLabel}</span>
                <span className="d-clock">{clock}</span>
              </div>
            </div>

            {/* Nav */}
            <nav style={{flex:1,overflowY:'auto',padding:'14px 12px 0',display:'flex',flexDirection:'column',gap:2}}>
              {NAV.map(it=>(
                <button key={it.key} onClick={()=>setTab(it.key)}
                  className={`d-nav-link${tab===it.key?' active':''}`}>
                  <span style={{width:16,height:16,flexShrink:0}}>{it.icon}</span>
                  <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{it.label}</span>
                  {(it.badge??0)>0&&(
                    <span className={`d-nav-badge${tab===it.key?' active-b':' inactive-b'}`}>{it.badge}</span>
                  )}
                </button>
              ))}
            </nav>

            {/* Bottom actions */}
            <div className="d-sidebar-bottom">
              <button className="d-sidebar-action cta" onClick={()=>router.push('/book')}>
                <svg viewBox="0 0 16 16" fill="currentColor" style={{width:14,height:14}}>
                  <path d="M8 2a1 1 0 011 1v4h4a1 1 0 110 2H9v4a1 1 0 11-2 0V9H3a1 1 0 110-2h4V3a1 1 0 011-1z"/>
                </svg>
                Book a Service
              </button>
              <Link href="/" style={{display:'block'}}>
                <button className="d-sidebar-action">
                  <svg viewBox="0 0 20 20" fill="currentColor" style={{width:14,height:14}}>
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/>
                  </svg>
                  Back to Site
                </button>
              </Link>
            </div>
          </aside>

          {/* ════ MAIN ═════════════════════════════════════════ */}
          <div>
            {/* Topbar */}
            <header className="d-topbar">
              <div className="d-topbar-inner">
                {/* Mobile brand */}
                <div className="d-mobile-only" style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:28,height:28,borderRadius:9,background:'linear-gradient(135deg,#2563EB,#0891B2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>💧</div>
                  <span style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:14,color:'#0A1628'}}>AuroWater</span>
                </div>

                <div className="d-topbar-title d-desktop-only">
                  {tab==='overview' ? `${greet()}, ${displayName} 👋` : NAV.find(n=>n.key===tab)?.label}
                </div>

                <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
                  <div className="d-live-pill d-desktop-only">
                    <span style={{width:6,height:6,borderRadius:'50%',background:'#2563EB',display:'inline-block',animation:'dPulse 1.5s ease-in-out infinite'}}/>
                    Live · {relT(lastRefresh)}
                  </div>

                  {/* Refresh */}
                  <button className="d-icon-btn" onClick={doRefresh} title="Refresh" aria-label="Refresh dashboard">
                    <svg viewBox="0 0 20 20" fill="currentColor" style={{width:16,height:16}} className={refreshing?'d-spin':''}>
                      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/>
                    </svg>
                  </button>

                  {/* Bell */}
                  <button className="d-icon-btn" style={{position:'relative'}} onClick={()=>setTab('notifications')} aria-label="Notifications">
                    <svg viewBox="0 0 20 20" fill="currentColor" style={{width:16,height:16}}>
                      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
                    </svg>
                    {stats.unread>0&&(
                      <span style={{position:'absolute',top:-3,right:-3,width:15,height:15,borderRadius:'50%',background:'#EF4444',color:'#fff',fontSize:8,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',border:'1.5px solid #F0F6FF'}}>
                        {stats.unread>9?'9+':stats.unread}
                      </span>
                    )}
                  </button>

                  {/* Avatar */}
                  <button onClick={()=>setTab('profile')}
                    style={{width:34,height:34,borderRadius:10,background:'linear-gradient(135deg,#DBEAFE,#BFDBFE)',color:'#1E3A8A',fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',border:'none',cursor:'pointer'}}>
                    {getIni(profile.name||'U')}
                  </button>

                  <button className="d-topbar-book d-desktop-only" onClick={()=>router.push('/book')}>
                    + Book
                  </button>
                </div>
              </div>
            </header>

            {/* ── Content ── */}
            <main className="d-content d-fade" style={{display:'flex',flexDirection:'column',gap:0}}>

              {/* ══════════════ OVERVIEW ══════════════════════ */}
              {tab==='overview'&&(
                <div style={{display:'flex',flexDirection:'column',gap:16}}>

                  {/* ── Water Hero Welcome Card ── */}
                  <div className="d-water-hero">
                    {/* Floating water drop SVG decoration */}
                    <div style={{position:'absolute',top:0,right:0,bottom:0,width:'38%',pointerEvents:'none',overflow:'hidden',opacity:0.12}}>
                      <svg viewBox="0 0 200 280" style={{width:'100%',height:'100%',position:'absolute',right:-20,top:-20}} fill="none">
                        <path d="M100 10C60 60 30 90 30 130a70 70 0 00140 0c0-40-30-70-70-120z" fill="#60A5FA"/>
                        <path d="M100 30C70 70 50 98 50 130a50 50 0 00100 0c0-32-22-60-50-100z" fill="#93C5FD" opacity="0.5"/>
                        <circle cx="82" cy="115" r="8" fill="#fff" opacity="0.35"/>
                      </svg>
                    </div>
                    {/* Grid overlay */}
                    <div style={{position:'absolute',inset:0,backgroundImage:'linear-gradient(rgba(96,165,250,0.04)1px,transparent 1px),linear-gradient(90deg,rgba(96,165,250,0.04)1px,transparent 1px)',backgroundSize:'32px 32px',pointerEvents:'none'}}/>

                    <div style={{position:'relative',zIndex:1}}>
                      <div className="d-water-hero-eyebrow">
                        <span style={{width:5,height:5,borderRadius:'50%',background:'#60A5FA',display:'inline-block',animation:'dPulse 1.5s ease-in-out infinite'}}/>
                        {stats.active>0 ? `${stats.active} order active right now` : 'India\'s most transparent water service'}
                      </div>

                      <h2 className="d-water-hero-title">
                        {greet()}, <span>{displayName}</span> 👋<br/>
                        {stats.total===0 ? 'Ready to book your first service?' : stats.active>0 ? 'You have active bookings.' : 'Your water is taken care of.'}
                      </h2>

                      <p className="d-water-hero-sub">
                        {stats.total===0
                          ? 'Book any water service in under 60 seconds. Verified pros, transparent pricing, same-day slots.'
                          : `${stats.completed} service${stats.completed!==1?'s':''} completed · ${inr(stats.spent)} saved vs market prices.`
                        }
                      </p>

                      <div className="d-water-hero-btns">
                        <button className="d-water-hero-btn-primary" onClick={()=>router.push('/book')}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" fill="rgba(255,255,255,0.4)"/><path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" stroke="#fff" strokeWidth="1.5" fill="none"/></svg>
                          Book a Service
                        </button>
                        <button className="d-water-hero-btn-ghost" onClick={()=>setTab('orders')}>
                          My Orders →
                        </button>
                      </div>

                      {/* Trust badges */}
                      <div className="d-water-hero-trust">
                        {['₹12/can · No hidden fees','Same-day delivery','4.8★ avg rating','13 cities covered'].map(t=>(
                          <div key={t} className="d-water-hero-trust-item">
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="6" fill="#60A5FA" fillOpacity="0.2"/><path d="M3.5 6l1.8 1.8 3.2-3.6" stroke="#60A5FA" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            {t}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Wave bottom */}
                    <svg className="d-water-hero-wave" viewBox="0 0 1440 80" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#F0F6FF" d="M0,40 C240,70 480,10 720,40 C960,70 1200,15 1440,40 L1440,80 L0,80 Z"/>
                      <path fill="#F0F6FF" opacity="0.6" d="M0,55 C200,25 500,70 720,50 C940,30 1200,65 1440,55 L1440,80 L0,80 Z"/>
                    </svg>
                  </div>

                  {/* ── Quick stats strip ── */}
                  <div className="d-qstat-strip">
                    {[
                      {val:stats.total,     lbl:'Total Bookings', bar:'#2563EB',  icon:'📦'},
                      {val:stats.active,    lbl:'Active Now',     bar:'#F59E0B',  icon:'⚡', warn:stats.active>0},
                      {val:stats.completed, lbl:'Completed',      bar:'#059669',  icon:'✅'},
                      {money:stats.spent,   lbl:'Total Spent',    bar:'#7C3AED',  icon:'💰'},
                    ].map((s,i)=>(
                      <div key={i} className="d-qstat-item">
                        <div style={{fontSize:16,marginBottom:3}}>{s.icon}</div>
                        <div className="d-qstat-val" style={{color:s.warn?'#D97706':i===3?'#7C3AED':'#0A1628',fontSize:'clamp(1.1rem,2.5vw,1.35rem)'}}>
                          {s.money!=null ? inr(s.money) : <Count to={s.val??0}/>}
                        </div>
                        <div className="d-qstat-lbl">{s.lbl}</div>
                        <div className="d-qstat-bar" style={{background:s.bar}}/>
                      </div>
                    ))}
                  </div>

                  {/* ── Why AuroWater strip ── */}
                  <div className="d-why-strip">
                    {[
                      {icon:'💧',title:'BIS Certified Water',sub:'Safe & sealed 20L cans'},
                      {icon:'⚡',title:'Same-Day Delivery',sub:'Most slots in 3 hours'},
                      {icon:'🛡️',title:'Verified Pros',sub:'ID checked technicians'},
                      {icon:'📋',title:'Transparent Pricing',sub:'No hidden charges'},
                    ].map(w=>(
                      <div key={w.title} className="d-why-item">
                        <div className="d-why-icon">{w.icon}</div>
                        <div className="d-why-title">{w.title}</div>
                        <div className="d-why-sub">{w.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* ── Live order spotlight ── */}
                  {stats.inProgress&&(()=>{
                    const o=stats.inProgress!;
                    const m=SVC[o.serviceKey];
                    const tl=tlIdx(o.status);
                    return (
                      <div style={{borderRadius:20,overflow:'hidden',border:'2px solid #BFDBFE',background:'linear-gradient(135deg,#0A1628,#1E3A8A)',animation:'dFadeUp 0.4s ease both'}}>
                        <div style={{padding:'18px 20px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
                          <div style={{display:'flex',alignItems:'center',gap:13}}>
                            <div className={`w-12 h-12 rounded-xl ${m.iconBg} flex items-center justify-center text-2xl`} style={{animation:'dPulseRing 2s ease infinite'}}>{m.emoji}</div>
                            <div>
                              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                                <span style={{display:'inline-flex',alignItems:'center',gap:5,background:'#7C3AED',color:'#fff',fontSize:9,fontWeight:800,padding:'2px 8px',borderRadius:99,letterSpacing:'0.08em',textTransform:'uppercase'}}>
                                  <span style={{width:5,height:5,borderRadius:'50%',background:'#fff',animation:'dPulse 1.2s infinite'}}/>LIVE
                                </span>
                                <span style={{color:'#fff',fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14}}>{m.label}</span>
                              </div>
                              <p style={{color:'rgba(255,255,255,0.45)',fontSize:11}}>{o.address.area}, {o.address.city}</p>
                            </div>
                          </div>
                          <div style={{textAlign:'right'}}>
                            <div style={{fontSize:10,color:'rgba(255,255,255,0.35)',fontWeight:500,marginBottom:2}}>Amount</div>
                            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:22,color:'#fff',letterSpacing:-1}}>{inr(o.total)}</div>
                            <div style={{fontSize:10,color:o.paymentStatus==='paid'?'#34D399':'#FCD34D',fontWeight:600,marginTop:1}}>{o.paymentStatus==='paid'?'✓ Paid':'○ Pending'}</div>
                          </div>
                        </div>
                        <div style={{background:'rgba(255,255,255,0.96)',margin:'0 12px 12px',borderRadius:14,padding:16}}>
                          <div style={{display:'flex',alignItems:'flex-start',marginBottom:14}}>
                            {TL_STEPS.map((step,i)=>(
                              <React.Fragment key={step}>
                                <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                                  <div className={`tl-dot ${i<tl?'done':i===tl?'curr':''}`}>{i<tl?'✓':i+1}</div>
                                  <span style={{display:'block',fontSize:9,fontWeight:600,color:'#60A5FA',marginTop:6,textAlign:'center',width:50,lineHeight:1.2}}>{step}</span>
                                </div>
                                {i<TL_STEPS.length-1&&<div className={`tl-line${i<tl?' done':''}`}/>}
                              </React.Fragment>
                            ))}
                          </div>
                          {o.technicianName&&(
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'#EFF6FF',border:'1px solid #DBEAFE',borderRadius:12,padding:'10px 14px'}}>
                              <div style={{display:'flex',alignItems:'center',gap:10}}>
                                <div style={{width:34,height:34,borderRadius:9,background:'linear-gradient(135deg,#DBEAFE,#BFDBFE)',color:'#1E3A8A',fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:11,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{getIni(o.technicianName)}</div>
                                <div>
                                  <div style={{fontSize:13,fontWeight:700,color:'#0A1628'}}>{o.technicianName}</div>
                                  <div style={{fontSize:11,color:'#64748B'}}>{o.technicianPhone}</div>
                                </div>
                              </div>
                              <button onClick={()=>{setTab('orders');setExpandedId(o.id);}} className="d-btn d-btn-primary d-btn-sm">Track →</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Service grid ── */}
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:'#64748B',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10}}>Book a Service</div>
                    <div className="d-svc-grid" style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:10}}>
                      {(Object.entries(SVC) as [ServiceKey,typeof SVC[ServiceKey]][]).map(([key,m])=>(
                        <button key={key} onClick={()=>router.push(`/book?service=${key}`)}
                          className="d-card d-card-hover" style={{padding:'14px 8px',textAlign:'center',border:'1px solid #DBEAFE'}}>
                          <div className={`w-11 h-11 mx-auto rounded-xl ${m.iconBg} flex items-center justify-center text-2xl mb-2`}>{m.emoji}</div>
                          <div style={{fontSize:10,fontWeight:700,color:'#1D4ED8',lineHeight:1.3}}>{m.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Recent orders ── */}
                  <div className="d-card" style={{padding:'18px 20px'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:'0.95rem',color:'#0A1628'}}>Recent Orders</div>
                      <button onClick={()=>setTab('orders')} style={{fontSize:12,fontWeight:600,color:'#2563EB',background:'none',border:'none',cursor:'pointer'}}>View all →</button>
                    </div>
                    {orders.length===0?(
                      <div style={{textAlign:'center',padding:'36px 20px'}}>
                        {/* Inline water illustration for empty state */}
                        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" style={{margin:'0 auto 12px',display:'block'}}>
                          <circle cx="36" cy="36" r="36" fill="#EFF6FF"/>
                          <path d="M36 14C24 28 18 36 18 44a18 18 0 0036 0c0-8-6-16-18-30z" fill="#BFDBFE"/>
                          <path d="M36 22C27 33 23 39 23 44a13 13 0 0026 0c0-5-4-11-13-22z" fill="#60A5FA" opacity="0.6"/>
                          <circle cx="30" cy="41" r="3" fill="#fff" opacity="0.5"/>
                        </svg>
                        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:'#1D4ED8',marginBottom:4}}>No orders yet</div>
                        <div style={{fontSize:12,color:'#64748B',marginBottom:12}}>Book your first service in under 60 seconds</div>
                        <button onClick={()=>router.push('/book')} className="d-btn d-btn-primary d-btn-sm" style={{margin:'0 auto'}}>Book Now →</button>
                      </div>
                    ):(
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        {orders.slice(0,5).map(o=>{
                          const m=SVC[o.serviceKey];
                          return (
                            <div key={o.id} className="d-order" style={{padding:'12px 14px'}} onClick={()=>{setTab('orders');setExpandedId(o.id);}}>
                              <div style={{display:'flex',alignItems:'center',gap:12}}>
                                <div className={`w-10 h-10 rounded-xl ${m.iconBg} flex items-center justify-center text-lg flex-shrink-0`}>{m.emoji}</div>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontWeight:600,fontSize:13,color:'#0A1628',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.label}</div>
                                  <div style={{fontSize:11,color:'#94A3B8',marginTop:1}}>{o.id} · {fmtDate(o.createdAt)}</div>
                                </div>
                                <div style={{flexShrink:0,textAlign:'right',display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
                                  <Chip status={o.status}/>
                                  <div style={{fontSize:12,fontWeight:700,color:'#1D4ED8'}}>{inr(o.total)}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* ── Referral ── */}
                  <div style={{borderRadius:20,overflow:'hidden',border:'1px solid #BFDBFE',background:'linear-gradient(135deg,#0A1628,#1E3A8A)'}}>
                    <div style={{padding:'20px 22px 10px',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
                      <div>
                        <div style={{fontSize:9,fontWeight:800,color:'#93C5FD',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:6}}>Refer & Earn</div>
                        <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:'clamp(1rem,2.5vw,1.3rem)',color:'#fff',letterSpacing:-0.5,lineHeight:1.2,margin:0}}>Share AuroWater,<br/>earn ₹50 per booking</h3>
                        <p style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:5}}>Applied as account credit.</p>
                      </div>
                      <span style={{fontSize:36,flexShrink:0}}>🎁</span>
                    </div>
                    <div style={{padding:'0 22px 20px',display:'flex',alignItems:'center',gap:10}}>
                      <div style={{flex:1,borderRadius:12,padding:'10px 14px',display:'flex',alignItems:'center',gap:10,background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.12)'}}>
                        <span style={{fontSize:10,fontWeight:600,color:'rgba(255,255,255,0.4)'}}>Code</span>
                        <span style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:14,color:'#fff',letterSpacing:'0.1em'}}>{refCode}</span>
                      </div>
                      <button onClick={doCopyRef} className="d-btn d-btn-sm" style={{background:'#fff',color:'#0A1628',fontWeight:800,padding:'10px 18px',border:'none',borderRadius:11,cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>
                        {copied?'✓ Copied!':'Copy Code'}
                      </button>
                    </div>
                  </div>

                </div>
              )}

              {/* ══════════════ ORDERS ════════════════════════ */}
              {tab==='orders'&&(
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  <Section title="My Orders"
                    sub={`${stats.total} total · ${stats.active} active · ${stats.completed} completed · ${stats.cancelled} cancelled`}
                    right={<button onClick={()=>router.push('/book')} className="d-btn d-btn-primary d-btn-sm">+ New Booking</button>}/>

                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    {([{f:'all',l:`All (${stats.total})`},{f:'active',l:`Active (${stats.active})`},{f:'completed',l:`Completed (${stats.completed})`},{f:'cancelled',l:`Cancelled (${stats.cancelled})`}] as {f:OrderFilter,l:string}[]).map(({f,l})=>(
                      <button key={f} onClick={()=>setFilter(f)} className={`d-filter-pill${filter===f?' on':''}`}>{l}</button>
                    ))}
                  </div>

                  {visibleOrders.length===0?(
                    <div className="d-card" style={{padding:'48px 20px',textAlign:'center'}}>
                      <div style={{fontSize:44,marginBottom:10}}>📭</div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:'#1D4ED8',marginBottom:4}}>No {filter!=='all'?filter:''} orders</div>
                      <div style={{fontSize:13,color:'#64748B',marginBottom:12}}>Book a service to get started.</div>
                      <button onClick={()=>router.push('/book')} className="d-btn d-btn-primary d-btn-sm" style={{margin:'0 auto'}}>Book Now</button>
                    </div>
                  ):visibleOrders.map(o=>{
                    const m=SVC[o.serviceKey];
                    const bd=calcBreakdown(o);
                    const tl=tlIdx(o.status);
                    const rev=reviews.find(r=>r.orderId===o.id);
                    const exp=expandedId===o.id;
                    return (
                      <div key={o.id} className={`d-order${exp?' open':''}`}>
                        <div style={{padding:'14px 16px'}} onClick={()=>setExpandedId(exp?null:o.id)}>
                          <div style={{display:'flex',alignItems:'flex-start',gap:14}}>
                            <div className={`w-12 h-12 rounded-xl ${m.iconBg} flex items-center justify-center text-2xl flex-shrink-0`}>{m.emoji}</div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
                                <div>
                                  <div style={{fontWeight:700,fontSize:14,color:'#0A1628'}}>{m.label}</div>
                                  <div style={{fontSize:11,color:'#94A3B8',marginTop:2}}>{o.id} · {o.scheduledDate} · {o.timeKey}</div>
                                </div>
                                <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                                  <Chip status={o.status}/>
                                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:14,color:'#1D4ED8'}}>{inr(o.total)}</div>
                                </div>
                              </div>
                              <div style={{fontSize:11,color:'#94A3B8',marginTop:6,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>📍 {o.address.houseFlat}, {o.address.area}, {o.address.city}</div>
                              <div style={{display:'flex',alignItems:'center',gap:6,marginTop:8,flexWrap:'wrap'}}>
                                <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:6,background:o.paymentStatus==='paid'?'#ECFDF5':'#FFFBEB',color:o.paymentStatus==='paid'?'#065F46':'#92400E'}}>
                                  {o.paymentStatus==='paid'?'✓ Paid':'○ Unpaid'}
                                </span>
                                <span style={{fontSize:10,fontWeight:600,padding:'2px 7px',borderRadius:6,background:'#EFF6FF',color:'#1D4ED8',textTransform:'capitalize'}}>{o.paymentMethod}</span>
                                {o.emergency&&<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:6,background:'#FEF2F2',color:'#DC2626'}}>🚨 Emergency</span>}
                                <span style={{fontSize:10,color:'#CBD5E1'}}>Updated {relT(o.updatedAt)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {exp&&(
                          <div style={{borderTop:'1px solid #EEF5FF',padding:'14px 16px',background:'#FAFCFF',display:'flex',flexDirection:'column',gap:14}}>
                            {/* Timeline */}
                            {o.status!=='CANCELLED'&&(
                              <div className="d-card" style={{padding:'14px 16px'}}>
                                <div style={{fontSize:9,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>Order Progress</div>
                                <div style={{display:'flex',alignItems:'flex-start'}}>
                                  {TL_STEPS.map((step,i)=>(
                                    <React.Fragment key={step}>
                                      <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                                        <div className={`tl-dot ${i<tl?'done':i===tl?'curr':''}`}>{i<tl?'✓':i+1}</div>
                                        <div style={{fontSize:9,fontWeight:600,color:'#60A5FA',marginTop:6,textAlign:'center',width:52,lineHeight:1.2}}>{step}</div>
                                      </div>
                                      {i<TL_STEPS.length-1&&<div className={`tl-line${i<tl?' done':''}`}/>}
                                    </React.Fragment>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="d-order-detail-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                              {/* Technician */}
                              <div className="d-card" style={{padding:'14px 16px'}}>
                                <div style={{fontSize:9,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>Technician</div>
                                {!o.technicianName||o.status==='PENDING'?(
                                  <div>
                                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                                      <div className="d-shimmer" style={{width:36,height:36,borderRadius:9}}/>
                                      <div style={{display:'flex',flexDirection:'column',gap:6,flex:1}}>
                                        <div className="d-shimmer" style={{height:12,width:'70%'}}/>
                                        <div className="d-shimmer" style={{height:10,width:'50%'}}/>
                                      </div>
                                    </div>
                                    <div style={{fontSize:11,color:'#94A3B8'}}>Technician will be assigned shortly.</div>
                                  </div>
                                ):(
                                  <div>
                                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                                      <div style={{width:40,height:40,borderRadius:11,background:'linear-gradient(135deg,#DBEAFE,#BFDBFE)',color:'#1E3A8A',fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{getIni(o.technicianName)}</div>
                                      <div>
                                        <div style={{fontWeight:700,fontSize:13,color:'#0A1628'}}>{o.technicianName}</div>
                                        <div style={{fontSize:11,color:'#64748B',marginTop:1}}>{o.technicianPhone}</div>
                                        {(()=>{const t=TECH_DB[o.serviceKey];return(
                                          <div style={{display:'flex',alignItems:'center',gap:2,marginTop:3}}>
                                            {Array.from({length:5},(_,i)=>(<svg key={i} viewBox="0 0 12 12" fill={i<Math.floor(t.rating)?'#F59E0B':'#DBEAFE'} style={{width:11,height:11}}><path d="M6 1l1.4 2.9L10.5 4l-2.3 2.2.5 3.3L6 8l-2.7 1.5.5-3.3L1.5 4l3.1-.1z"/></svg>))}
                                            <span style={{fontSize:11,fontWeight:600,color:'#64748B',marginLeft:4}}>{t.rating} · {t.exp}</span>
                                          </div>
                                        );})()}
                                      </div>
                                    </div>
                                    <div style={{display:'flex',gap:8}}>
                                      <a href={`tel:${o.technicianPhone?.replace(/\D/g,'')}`} style={{flex:1,textAlign:'center',fontSize:11,fontWeight:700,border:'1px solid #DBEAFE',color:'#1D4ED8',padding:'7px',borderRadius:9,textDecoration:'none',background:'#EFF6FF'}}>📞 Call</a>
                                      <button style={{flex:1,fontSize:11,fontWeight:700,border:'1px solid #DBEAFE',color:'#1D4ED8',padding:'7px',borderRadius:9,background:'#EFF6FF',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>💬 Chat</button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Price breakdown */}
                              <div className="d-card" style={{padding:'14px 16px'}}>
                                <div style={{fontSize:9,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>Price Breakdown</div>
                                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                                  {[{l:'Base Price',v:inr(bd.base)},{l:'Convenience Fee',v:inr(bd.conv)},{l:'GST (18%)',v:inr(bd.gst)},...(bd.emg>0?[{l:'Emergency Fee',v:inr(bd.emg)}]:[])].map(row=>(
                                    <div key={row.l} style={{display:'flex',justifyContent:'space-between',borderBottom:'1px dashed #EEF5FF',paddingBottom:7}}>
                                      <span style={{fontSize:11,color:'#94A3B8'}}>{row.l}</span>
                                      <span style={{fontSize:11,fontWeight:600,color:'#374151'}}>{row.v}</span>
                                    </div>
                                  ))}
                                  <div style={{display:'flex',justifyContent:'space-between',paddingTop:4}}>
                                    <span style={{fontWeight:700,fontSize:13,color:'#0A1628'}}>Total</span>
                                    <span style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:15,color:'#2563EB'}}>{inr(bd.total)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Address */}
                            <div className="d-card" style={{padding:'12px 16px'}}>
                              <div style={{fontSize:9,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>Service Address</div>
                              <div style={{fontWeight:600,fontSize:13,color:'#0A1628'}}>{o.address.houseFlat}, {o.address.area}</div>
                              <div style={{fontSize:11,color:'#64748B',marginTop:2}}>{o.address.city} · {o.address.pincode}</div>
                              {o.address.landmark&&<div style={{fontSize:11,color:'#94A3B8',marginTop:1}}>Near {o.address.landmark}</div>}
                            </div>

                            {/* Review */}
                            {o.status==='COMPLETED'&&(
                              <div className="d-card" style={{padding:'14px 16px'}}>
                                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                                  <div style={{fontSize:9,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.1em'}}>Rate This Service</div>
                                  {rev&&<span style={{fontSize:11,fontWeight:700,background:'#FFFBEB',color:'#92400E',border:'1px solid #FDE68A',padding:'2px 8px',borderRadius:99}}>★ Rated {rev.rating}/5</span>}
                                </div>
                                <div style={{display:'flex',gap:8,marginBottom:10}}>
                                  {[1,2,3,4,5].map(star=>{
                                    const filled=(rDrafts[o.id]?.stars??rev?.rating??0)>=star;
                                    return (
                                      <button key={star} disabled={!!rev}
                                        onClick={e=>{e.stopPropagation();setRDrafts(c=>({...c,[o.id]:{stars:star,text:c[o.id]?.text??''}}));}}
                                        style={{width:38,height:38,borderRadius:11,border:`2px solid ${filled?'#F59E0B':'#DBEAFE'}`,background:filled?'#F59E0B':'#fff',color:filled?'#fff':'#DBEAFE',fontSize:18,fontWeight:700,cursor:rev?'not-allowed':'pointer',opacity:rev?0.7:1,transition:'all 0.15s'}}>★</button>
                                    );
                                  })}
                                </div>
                                <textarea value={rDrafts[o.id]?.text??rev?.text??''} disabled={!!rev} rows={2}
                                  placeholder="Share your experience (optional)…"
                                  onChange={e=>{e.stopPropagation();setRDrafts(c=>({...c,[o.id]:{stars:c[o.id]?.stars??0,text:e.target.value}}));}}
                                  className="d-inp" style={{resize:'none',opacity:rev?0.6:1,cursor:rev?'not-allowed':'auto'}}/>
                                {!rev&&<button onClick={e=>{e.stopPropagation();doReview(o.id);}} className="d-btn d-btn-primary d-btn-sm" style={{marginTop:10}}>Submit Review</button>}
                              </div>
                            )}

                            {/* Actions */}
                            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                              <Link href={`/customer/track/${encodeURIComponent(o.id)}`} onClick={e=>e.stopPropagation()}
                                className="d-btn d-btn-primary d-btn-sm" style={{textDecoration:'none'}}>View Details →</Link>
                              {o.status==='COMPLETED'&&<button onClick={e=>{e.stopPropagation();router.push(`/book?service=${o.serviceKey}`);}} className="d-btn d-btn-outline d-btn-sm">🔄 Rebook</button>}
                              {o.status!=='COMPLETED'&&o.status!=='CANCELLED'&&<button onClick={e=>{e.stopPropagation();setCancelId(o.id);}} className="d-btn d-btn-danger d-btn-sm">Cancel Order</button>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ══════════════ NOTIFICATIONS ══════════════════ */}
              {tab==='notifications'&&(
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  <Section title="Notifications" sub={`${stats.unread} unread · ${notifs.length} total`}
                    right={stats.unread>0&&<button onClick={doMarkAllRead} className="d-btn d-btn-outline d-btn-sm">✓ Mark all read</button>}/>
                  {notifs.length===0?(
                    <div className="d-card" style={{padding:'48px 20px',textAlign:'center'}}>
                      <div style={{fontSize:44,marginBottom:10}}>🔕</div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:'#1D4ED8'}}>All caught up!</div>
                      <div style={{fontSize:13,color:'#64748B',marginTop:4}}>No notifications yet.</div>
                    </div>
                  ):(
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {[...notifs].sort((a,b)=>b.ts-a.ts).map(n=>(
                        <button key={n.id} type="button" onClick={()=>doMarkRead(n.id)}
                          className={`d-order${n.read?'':' d-notif-unread'}`} style={{padding:'14px 16px',textAlign:'left',width:'100%',background:n.read?'#fff':'#FAFCFF'}}>
                          <div style={{display:'flex',alignItems:'flex-start',gap:13}}>
                            <div style={{width:40,height:40,borderRadius:12,background:'#EFF6FF',border:'1px solid #DBEAFE',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{n.icon}</div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
                                <div style={{fontWeight:n.read?600:700,fontSize:13,color:n.read?'#374151':'#0A1628'}}>{n.title}</div>
                                <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                                  {!n.read&&<span style={{width:7,height:7,borderRadius:'50%',background:'#2563EB',marginTop:2,flexShrink:0}}/>}
                                  <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:99,border:'1px solid',
                                    background:n.category==='booking'?'#EFF6FF':n.category==='payment'?'#F5F3FF':n.category==='promo'?'#FFFBEB':'#F0F9FF',
                                    color:n.category==='booking'?'#1D4ED8':n.category==='payment'?'#6D28D9':n.category==='promo'?'#92400E':'#0369A1',
                                    borderColor:n.category==='booking'?'#BFDBFE':n.category==='payment'?'#DDD6FE':n.category==='promo'?'#FDE68A':'#BAE6FD',
                                  }}>{n.category}</span>
                                </div>
                              </div>
                              <div style={{fontSize:12,color:'#64748B',marginTop:3,lineHeight:1.5}}>{n.body}</div>
                              <div style={{fontSize:10,color:'#CBD5E1',marginTop:5,fontWeight:500}}>{relT(n.ts)}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ══════════════ ADDRESSES ══════════════════════ */}
              {tab==='addresses'&&(
                <div style={{display:'flex',flexDirection:'column',gap:16}}>
                  <Section title="Saved Addresses" sub={`${addresses.length} saved · synced with booking`}
                    right={<Link href="/customer/addresses" className="d-btn d-btn-outline d-btn-sm" style={{textDecoration:'none'}}>Manage all →</Link>}/>
                  <div className="d-addr-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {addresses.length===0?(
                        <div className="d-card" style={{padding:'40px 20px',textAlign:'center'}}>
                          <div style={{fontSize:40,marginBottom:8}}>🗺️</div>
                          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:'#1D4ED8'}}>No addresses saved</div>
                          <div style={{fontSize:12,color:'#64748B',marginTop:4}}>Add one using the form.</div>
                        </div>
                      ):addresses.map(a=>(
                        <div key={a.id} className="d-card d-card-hover" style={{padding:'14px 16px'}}>
                          <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                            <div style={{width:40,height:40,borderRadius:11,background:'#EFF6FF',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{a.label==='Home'?'🏠':a.label==='Office'?'🏢':'📍'}</div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:5,flexWrap:'wrap'}}>
                                <span style={{fontSize:9,fontWeight:700,color:'#1D4ED8',background:'#EFF6FF',padding:'2px 7px',borderRadius:6}}>{a.label||'Address'}</span>
                                {a.isDefault&&<span style={{fontSize:9,fontWeight:700,color:'#fff',background:'#2563EB',padding:'2px 7px',borderRadius:6}}>✓ Default</span>}
                              </div>
                              <div style={{fontWeight:600,fontSize:13,color:'#0A1628'}}>{a.houseFlat}, {a.area}</div>
                              <div style={{fontSize:11,color:'#64748B',marginTop:1}}>{a.city} · {a.pincode}</div>
                              {a.landmark&&<div style={{fontSize:11,color:'#94A3B8',marginTop:1}}>Near {a.landmark}</div>}
                              <div style={{fontSize:10,color:'#CBD5E1',marginTop:4}}>Added {relT(a.createdAt)}</div>
                            </div>
                            <div style={{display:'flex',flexDirection:'column',gap:5,flexShrink:0}}>
                              {!a.isDefault&&<button onClick={()=>doSetDefault(a.id)} style={{fontSize:10,fontWeight:700,border:'1px solid #DBEAFE',color:'#1D4ED8',padding:'5px 9px',borderRadius:8,background:'#EFF6FF',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",whiteSpace:'nowrap'}}>Set Default</button>}
                              <button onClick={()=>doDelAddr(a.id)} style={{fontSize:10,fontWeight:700,border:'1px solid #FECACA',color:'#DC2626',padding:'5px 9px',borderRadius:8,background:'#FEF2F2',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}>Delete</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Add form */}
                    <div className="d-card" style={{padding:'18px 20px'}}>
                      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:'0.9rem',color:'#0A1628',marginBottom:14}}>Add New Address</div>
                      <div style={{display:'flex',gap:8,marginBottom:14}}>
                        {['Home','Office','Other'].map(l=>(
                          <button key={l} onClick={()=>setAddForm(f=>({...f,label:l}))}
                            style={{flex:1,padding:'8px',borderRadius:10,border:`1.5px solid ${addForm.label===l?'#2563EB':'#DBEAFE'}`,background:addForm.label===l?'#2563EB':'#fff',color:addForm.label===l?'#fff':'#64748B',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",transition:'all 0.14s'}}>
                            {l==='Home'?'🏠':l==='Office'?'🏢':'📍'} {l}
                          </button>
                        ))}
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:10}}>
                        <input className="d-inp" placeholder="House / Flat No. *" value={addForm.houseFlat} onChange={e=>setAddForm(f=>({...f,houseFlat:e.target.value}))}/>
                        <input className="d-inp" placeholder="Area / Street / Colony *" value={addForm.area} onChange={e=>setAddForm(f=>({...f,area:e.target.value}))}/>
                        <input className="d-inp" placeholder="Landmark (optional)" value={addForm.landmark} onChange={e=>setAddForm(f=>({...f,landmark:e.target.value}))}/>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                          <select className="d-inp" value={addForm.city} onChange={e=>setAddForm(f=>({...f,city:e.target.value}))} style={{appearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2394A3B8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 12px center',paddingRight:36}}>
                            <option value="">City *</option>
                            {UP_CITIES.map(c=><option key={c} value={c}>{c}</option>)}
                          </select>
                          <input className="d-inp" placeholder="Pincode *" inputMode="numeric" maxLength={6} value={addForm.pincode} onChange={e=>setAddForm(f=>({...f,pincode:e.target.value.replace(/\D/g,'').slice(0,6)}))}/>
                        </div>
                        {addErr&&<div style={{fontSize:11,color:'#DC2626',fontWeight:600}}>{addErr}</div>}
                        <button onClick={doSaveAddr} className="d-btn d-btn-primary" style={{width:'100%',justifyContent:'center'}}>Save Address</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ══════════════ ACTIVITY ══════════════════════ */}
              {tab==='activity'&&(
                <div style={{display:'flex',flexDirection:'column',gap:16}}>
                  <Section title="Activity Log" sub="Every action recorded in real time."
                    right={<span style={{fontSize:11,fontWeight:700,color:'#1D4ED8',background:'#EFF6FF',border:'1px solid #BFDBFE',padding:'5px 13px',borderRadius:99}}>{activity.length} events</span>}/>
                  <div className="d-act-sum-grid" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                    {[
                      {label:'Total Spent',   val:inr(stats.spent), icon:'💰'},
                      {label:'Reviews Given', val:`${reviews.length}${stats.avgRating?` · ★${stats.avgRating.toFixed(1)}`:''}`, icon:'⭐'},
                      {label:'Events Logged', val:`${activity.length}`, icon:'📋'},
                    ].map(s=>(
                      <div key={s.label} className="d-card" style={{padding:'14px',textAlign:'center'}}>
                        <div style={{fontSize:28,marginBottom:6}}>{s.icon}</div>
                        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:'1.05rem',color:'#1D4ED8'}}>{s.val}</div>
                        <div style={{fontSize:10,fontWeight:600,color:'#94A3B8',marginTop:3,textTransform:'uppercase',letterSpacing:'0.07em'}}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {activity.length===0?(
                    <div className="d-card" style={{padding:'48px 20px',textAlign:'center'}}>
                      <div style={{fontSize:40,marginBottom:10}}>🕐</div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:'#1D4ED8'}}>No activity yet</div>
                      <div style={{fontSize:13,color:'#64748B',marginTop:4}}>Your actions will appear here.</div>
                    </div>
                  ):(
                    <div className="d-card" style={{padding:'18px 20px'}}>
                      <div style={{display:'flex',flexDirection:'column'}}>
                        {[...activity].sort((a,b)=>b.ts-a.ts).map((log,i)=>(
                          <div key={log.id} style={{display:'flex',gap:14,paddingBottom:18,position:'relative'}}>
                            {i<activity.length-1&&<div style={{position:'absolute',left:13,top:30,bottom:0,width:1,background:'#EEF5FF'}}/>}
                            <div style={{width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0,zIndex:1,marginTop:2,border:'2px solid #fff',background:log.type==='order_cancelled'?'#FEE2E2':log.type==='payment_made'?'#EDE9FE':'#EFF6FF'}}>
                              {ACT_ICONS[log.type]}
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
                                <div style={{fontWeight:600,fontSize:13,color:'#0A1628'}}>{log.label}</div>
                                <div style={{fontSize:10,color:'#CBD5E1',fontWeight:500,whiteSpace:'nowrap',flexShrink:0}}>{fmtDT(log.ts)}</div>
                              </div>
                              {log.meta&&<div style={{fontSize:11,color:'#64748B',marginTop:2}}>{log.meta}</div>}
                              <div style={{fontSize:10,color:'#CBD5E1',marginTop:2}}>{relT(log.ts)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ══════════════ PROFILE ══════════════════════ */}
              {tab==='profile'&&(
                <div style={{display:'flex',flexDirection:'column',gap:16}}>
                  {/* Hero card */}
                  <div className="d-card" style={{overflow:'hidden'}}>
                    <div style={{height:100,background:'linear-gradient(135deg,#0A1628,#1E3A8A)',position:'relative'}}>
                      <div style={{position:'absolute',right:20,bottom:0,fontSize:72,opacity:0.08,lineHeight:1,userSelect:'none'}}>🌊</div>
                      <div style={{position:'absolute',inset:0,backgroundImage:'radial-gradient(circle at 80% 50%,rgba(96,165,250,0.12),transparent 55%)'}}/>
                    </div>
                    <div style={{padding:'0 22px 22px',marginTop:-44}}>
                      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:12}}>
                        <div style={{width:76,height:76,borderRadius:18,background:'linear-gradient(135deg,#DBEAFE,#BFDBFE)',color:'#1E3A8A',fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:22,display:'flex',alignItems:'center',justifyContent:'center',border:'4px solid #fff',boxShadow:'0 4px 16px rgba(37,99,235,0.15)'}}>{getIni(profile.name||'U')}</div>
                        <button onClick={()=>{setPDraft({...profile});setPEdit(v=>!v);}} className={`d-btn d-btn-sm ${pEdit?'d-btn-danger':'d-btn-outline'}`} style={{marginBottom:4}}>
                          {pEdit?'✕ Cancel':'✎ Edit Profile'}
                        </button>
                      </div>
                      <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:'1.5rem',color:'#0A1628',letterSpacing:-0.5,margin:'12px 0 4px'}}>{profile.name||'Add your name'}</h2>
                      <div style={{fontSize:13,color:'#64748B'}}>{profile.email||'Add email'}</div>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginTop:8,flexWrap:'wrap'}}>
                        <span style={{fontSize:10,fontWeight:700,color:'#1D4ED8',background:'#EFF6FF',border:'1px solid #BFDBFE',padding:'3px 10px',borderRadius:99}}>{roleLabel}</span>
                        {profile.phone&&<span style={{fontSize:12,fontWeight:500,color:'#64748B'}}>📱 {profile.phone}</span>}
                        {profile.updatedAt&&<span style={{fontSize:10,color:'#CBD5E1'}}>Updated {relT(profile.updatedAt)}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Edit / view */}
                  <div className="d-card" style={{padding:'20px 22px'}}>
                    <div style={{fontSize:9,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:16}}>{pEdit?'Edit Details':'Contact Details'}</div>
                    {pEdit?(
                      <div style={{display:'flex',flexDirection:'column',gap:14}}>
                        {[{key:'name',label:'Full Name',type:'text',ph:'Your full name'},{key:'email',label:'Email',type:'email',ph:'your@email.com'},{key:'phone',label:'Phone',type:'tel',ph:'98XXXXXXXX'}].map(({key,label,type,ph})=>(
                          <div key={key}>
                            <div style={{fontSize:10,fontWeight:700,color:'#64748B',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>{label}</div>
                            <input type={type} className="d-inp" placeholder={ph} value={pDraft[key as keyof Profile]??''} onChange={e=>setPDraft(d=>({...d,[key]:e.target.value}))}/>
                          </div>
                        ))}
                        <div style={{display:'flex',gap:10,paddingTop:4}}>
                          <button onClick={doSaveProfile} className="d-btn d-btn-primary" style={{flex:1,justifyContent:'center'}}>Save Changes</button>
                          <button onClick={()=>setPEdit(false)} className="d-btn d-btn-outline" style={{flex:1,justifyContent:'center'}}>Cancel</button>
                        </div>
                      </div>
                    ):(
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        {[{label:'Full Name',value:profile.name||'—',icon:'👤'},{label:'Email',value:profile.email||'—',icon:'✉️'},{label:'Phone',value:profile.phone||'—',icon:'📱'}].map(row=>(
                          <div key={row.label} style={{display:'flex',alignItems:'center',gap:13,padding:'12px 14px',background:'#F8FAFF',borderRadius:12,border:'1px solid #EEF5FF'}}>
                            <span style={{fontSize:18,flexShrink:0}}>{row.icon}</span>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:9,fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.08em'}}>{row.label}</div>
                              <div style={{fontSize:13,fontWeight:600,color:'#0A1628',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.value}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="d-profile-stats" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
                    {[
                      {l:'Total Orders',v:stats.total,     icon:'📦'},
                      {l:'Completed',   v:stats.completed, icon:'✅'},
                      {l:'Total Spent', money:stats.spent, icon:'💰'},
                      {l:'Avg Rating',  custom:stats.avgRating?`${stats.avgRating.toFixed(1)}/5`:'—', icon:'⭐'},
                    ].map(s=>(
                      <div key={s.l} className="d-card" style={{padding:'14px 12px',textAlign:'center'}}>
                        <div style={{fontSize:26,marginBottom:6}}>{s.icon}</div>
                        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:'1.1rem',color:'#1D4ED8'}}>
                          {s.custom??(s.money!=null?inr(s.money):<Count to={s.v??0}/>)}
                        </div>
                        <div style={{fontSize:9,fontWeight:700,color:'#94A3B8',marginTop:4,textTransform:'uppercase',letterSpacing:'0.07em'}}>{s.l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Referral */}
                  <div className="d-card" style={{padding:'18px 20px',background:'#F8FAFF'}}>
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
                      <div>
                        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:'0.9rem',color:'#0A1628',marginBottom:4}}>🎁 Your Referral Code</div>
                        <div style={{fontSize:12,color:'#64748B',marginBottom:12}}>Earn ₹50 per successful referral.</div>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{background:'#fff',border:'1px solid #DBEAFE',borderRadius:11,padding:'9px 16px'}}>
                            <span style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:14,color:'#1D4ED8',letterSpacing:'0.1em'}}>{refCode}</span>
                          </div>
                          <button onClick={doCopyRef} className="d-btn d-btn-primary d-btn-sm">{copied?'✓ Copied!':'Copy'}</button>
                        </div>
                      </div>
                      <span style={{fontSize:36,flexShrink:0}}>🎯</span>
                    </div>
                  </div>

                </div>
              )}

            </main>
          </div>

          {/* ════ MOBILE NAV ════════════════════════════════ */}
          <nav className="d-mobile-only" style={{position:'fixed',bottom:0,left:0,right:0,zIndex:40,background:'rgba(255,255,255,0.97)',borderTop:'1px solid #DBEAFE',boxShadow:'0 -4px 20px rgba(37,99,235,0.08)',backdropFilter:'blur(12px)',paddingBottom:'env(safe-area-inset-bottom, 0px)'}}>
            <div className="d-mob-nav">
              {NAV.filter(it=>['overview','orders','notifications','addresses','profile'].includes(it.key)).map(it=>(
                <button key={it.key} onClick={()=>setTab(it.key)} className={`d-mob-btn${tab===it.key?' on':''}`}>
                  <span style={{width:20,height:20,display:'flex',alignItems:'center',justifyContent:'center'}}>{it.icon}</span>
                  <span>{it.short}</span>
                  {(it.badge??0)>0&&(
                    <span style={{position:'absolute',top:6,right:'18%',width:14,height:14,background:'#EF4444',color:'#fff',fontSize:8,fontWeight:800,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {(it.badge??0)>9?'9+':it.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </nav>

          {/* ════ CANCEL MODAL ══════════════════════════════ */}
          {cancelId&&(
            <div style={{position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:16,background:'rgba(10,22,40,0.65)',backdropFilter:'blur(6px)'}}
              role="dialog" aria-modal="true">
              <div style={{width:'100%',maxWidth:400,background:'#fff',borderRadius:22,boxShadow:'0 20px 60px rgba(0,0,0,0.25)',overflow:'hidden',animation:'dFadeUp 0.22s ease both'}}>
                <div style={{background:'#FEF2F2',padding:'22px 22px 18px',textAlign:'center',borderBottom:'1px solid #FECACA'}}>
                  <div style={{width:48,height:48,borderRadius:14,background:'#FEE2E2',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,margin:'0 auto 12px'}}>🗑️</div>
                  <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:'1.1rem',color:'#0A1628',margin:'0 0 5px'}}>Cancel this booking?</h2>
                  <p style={{fontSize:13,color:'#64748B',margin:0}}>Order {cancelId} will be permanently cancelled.</p>
                </div>
                <div style={{padding:'16px 18px',display:'flex',gap:10}}>
                  <button onClick={()=>setCancelId(null)} className="d-btn d-btn-outline" style={{flex:1,justifyContent:'center',padding:'12px'}}>Keep Order</button>
                  <button onClick={doCancelOrder} className="d-btn" style={{flex:1,justifyContent:'center',padding:'12px',background:'#DC2626',color:'#fff',fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:13,border:'none',borderRadius:11,cursor:'pointer'}}>Yes, Cancel</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}