'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  api,
  getApiErrorMessage,
  logout,
  type ApiOrder,
  type ApiNotification,
  type CustomerStats,
} from '@/lib/api-client';
import { DatabaseErrorBanner } from '@/components/ui/DatabaseErrorBanner';
import { useAuth } from '@/hooks/useAuth';

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */
interface Order {
  id: string | number;
  service_name: string;
  total_amount: number;
  status: string;
  created_at: string;
  time_slot?: string;
}

interface Notif {
  id: string;
  title: string;
  body: string;
  created_at: string;
  order_id?: string;
}

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const STATUS_CFG: Record<string, {
  label: string; bg: string; color: string; dot: string; pulse?: boolean;
}> = {
  PENDING:     { label:'Pending',     bg:'#FFF7ED', color:'#C2410C', dot:'#FB923C' },
  ASSIGNED:    { label:'Assigned',    bg:'#EFF6FF', color:'#1D4ED8', dot:'#60A5FA' },
  ACCEPTED:    { label:'Accepted',    bg:'#F0F9FF', color:'#0369A1', dot:'#38BDF8' },
  IN_PROGRESS: { label:'In Progress', bg:'#EDE9FE', color:'#5B21B6', dot:'#8B5CF6', pulse:true },
  COMPLETED:   { label:'Completed',   bg:'#ECFDF5', color:'#065F46', dot:'#34D399' },
  CANCELLED:   { label:'Cancelled',   bg:'#F9FAFB', color:'#6B7280', dot:'#9CA3AF' },
};

const SVC_META: Record<string, { emoji: string; label: string; color: string }> = {
  water_tanker:  { emoji:'🚛', label:'Water Tanker',   color:'#0284C7' },
  ro_service:    { emoji:'💧', label:'RO Service',     color:'#2563EB' },
  plumbing:      { emoji:'🔧', label:'Plumbing',       color:'#D97706' },
  borewell:      { emoji:'⛏️', label:'Borewell',       color:'#78716C' },
  motor_pump:    { emoji:'⚙️', label:'Motor & Pump',   color:'#7C3AED' },
  tank_cleaning: { emoji:'🪣', label:'Tank Cleaning',  color:'#0891B2' },
  water_can:     { emoji:'💧', label:'Water Can',      color:'#2563EB' },
};

const EMPTY_STATS: CustomerStats = {
  total_orders: 0,
  active_orders: 0,
  completed: 0,
  cancelled: 0,
  total_spent: 0,
  savings: 0,
  avg_rating: null,
  total_reviews: 0,
};

const SERVICES = [
  { key:'water_can',     emoji:'💧', label:'Water Can',      sub:'₹12/can' },
  { key:'water_tanker',  emoji:'🚛', label:'Water Tanker',   sub:'From ₹299' },
  { key:'ro_service',    emoji:'🔧', label:'RO Service',     sub:'From ₹199' },
  { key:'plumbing',      emoji:'🪠', label:'Plumbing',       sub:'From ₹149' },
  { key:'motor_pump',    emoji:'⚙️', label:'Motor Pump',     sub:'From ₹249' },
  { key:'tank_cleaning', emoji:'🪣', label:'Tank Cleaning',  sub:'From ₹349' },
];

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
const inr = (n: number | null | undefined) =>
  '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

const relTime = (iso: string): string => {
  try {
    const d = Date.now() - new Date(iso).getTime();
    if (d < 60_000)       return 'Just now';
    if (d < 3_600_000)    return `${Math.floor(d / 60_000)}m ago`;
    if (d < 86_400_000)   return `${Math.floor(d / 3_600_000)}h ago`;
    const days = Math.floor(d / 86_400_000);
    return days === 1 ? 'Yesterday' : `${days}d ago`;
  } catch { return ''; }
};

const fmtDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
};

const getInitials = (name?: string): string =>
  (name || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase() || 'U';

const getSvcMeta = (name: string) => {
  const key = name?.toLowerCase().replace(/ /g, '_');
  return SVC_META[key] ?? { emoji: '💧', label: name.replace(/_/g, ' '), color: '#2563EB' };
};

/* ─────────────────────────────────────────────
   MICRO COMPONENTS
───────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG['PENDING'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 99,
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.dot}44`,
      fontSize: 10, fontWeight: 700,
      letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0,
        animation: cfg.pulse ? 'chPulse 1.5s ease-in-out infinite' : 'none',
      }} />
      {cfg.label}
    </span>
  );
}

function Skeleton({ w = '100%', h = 16, r = 8 }: { w?: number | string; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r, flexShrink: 0,
      background: 'linear-gradient(90deg,#EFF6FF 25%,#DBEAFE 50%,#EFF6FF 75%)',
      backgroundSize: '800px 100%',
      animation: 'chShimmer 1.5s ease-in-out infinite',
    }} />
  );
}

function CountUp({ to, duration = 700 }: { to: number; duration?: number }) {
  const [val, setVal] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      setVal(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    setVal(0);
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, duration]);
  return <>{val}</>;
}

/* ─────────────────────────────────────────────
   GUEST WELCOME HERO
───────────────────────────────────────────── */
function GuestHero({ onBook }: { onBook: () => void }) {
  return (
    <div className="ch-guest-hero">
      {/* Background water drop SVG */}
      <div className="ch-guest-drop" aria-hidden="true">
        <svg viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M100 10C55 70 20 110 20 150a80 80 0 00160 0c0-40-35-80-80-140z"
            fill="#2563EB" fillOpacity="0.08"/>
          <path d="M100 40C65 88 42 118 42 150a58 58 0 00116 0c0-32-23-62-58-110z"
            fill="#3B82F6" fillOpacity="0.06"/>
          <circle cx="78" cy="138" r="10" fill="#fff" fillOpacity="0.15"/>
        </svg>
      </div>
      <div className="ch-guest-content">
        <div className="ch-guest-eyebrow">
          <span style={{ width:6, height:6, borderRadius:'50%', background:'#60A5FA', display:'inline-block', animation:'chPulse 1.5s infinite' }} />
          India&apos;s most transparent water service
        </div>
        <h1 className="ch-guest-title">
          Pure water,<br /><span>at your door.</span>
        </h1>
        <p className="ch-guest-sub">
          Book RO service, water cans, plumbing and more — verified pros, upfront prices, same-day slots.
        </p>
        <div className="ch-guest-btns">
          <button type="button" onClick={onBook} className="ch-btn-primary" style={{ fontSize:15, padding:'13px 28px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" fill="rgba(255,255,255,0.35)"/>
              <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" stroke="#fff" strokeWidth="1.5" fill="none"/>
            </svg>
            Book a Service
          </button>
          <Link href="/auth/login" className="ch-btn-ghost" style={{ fontSize:14, padding:'12px 22px' }}>
            Sign in to track orders
          </Link>
        </div>
        <div className="ch-guest-trust">
          {['₹12/can · No hidden fees','Same-day delivery','4.8★ rating','13 cities UP'].map(t => (
            <span key={t} className="ch-trust-pill">{t}</span>
          ))}
        </div>
      </div>
      {/* Wave bottom */}
      <svg className="ch-guest-wave" viewBox="0 0 1440 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path fill="#F0F6FF" d="M0,30 C240,55 480,5 720,30 C960,55 1200,10 1440,30 L1440,60 L0,60 Z"/>
        <path fill="#F0F6FF" fillOpacity="0.5" d="M0,42 C200,18 500,52 720,38 C940,24 1200,50 1440,42 L1440,60 L0,60 Z"/>
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function CustomerHome() {
  const router = useRouter();
  const { fullName, hydrated: authHydrated, isLoggedIn, role } = useAuth();

  const [orders,    setOrders]    = useState<Order[]>([]);
  const [notifs,    setNotifs]    = useState<Notif[]>([]);
  const [stats,     setStats]     = useState<CustomerStats | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [clock,     setClock]     = useState('');
  const [greeting,  setGreeting]  = useState('Welcome');

  /* Real-time clock */
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = now.getHours();
      setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
      setClock(now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', second:'2-digit' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /* Load user + orders */
  const loadData = useCallback(async (isRefresh = false) => {
    if (!authHydrated) return;
    if (!isLoggedIn || role !== 'customer') {
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const [ordersRes, statsRes, notifsRes] = await Promise.allSettled([
        api.customer.orders.list({ limit: 20, offset: 0 }),
        api.customer.stats(),
        api.customer.notifications.list(10),
      ]);

      if (ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value)) {
        const mapped = ordersRes.value.map((o: ApiOrder): Order => ({
          id: o.id,
          service_name: String(o.service_type_key ?? 'service'),
          total_amount: Number(o.total_amount ?? 0),
          status: o.status,
          created_at: o.created_at,
          time_slot: o.time_slot ?? undefined,
        }));
        setOrders(mapped);
      } else {
        setOrders([]);
        if (ordersRes.status === 'rejected') {
          setError(getApiErrorMessage(ordersRes.reason));
        }
      }

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value);
      } else {
        setStats(EMPTY_STATS);
      }

      if (notifsRes.status === 'fulfilled' && Array.isArray(notifsRes.value)) {
        const mappedNotifs = notifsRes.value.map((n: ApiNotification): Notif => ({
          id: String(n.id),
          title: String(n.title ?? ''),
          body: String(n.body ?? n.message ?? ''),
          created_at: String(n.created_at ?? new Date().toISOString()),
          order_id: n.order_id ? String(n.order_id) : undefined,
        }));
        setNotifs(mappedNotifs);
      } else {
        setNotifs([]);
      }
    } catch (e: unknown) {
      setError(getApiErrorMessage(e));
      setOrders([]);
      setNotifs([]);
      setStats(EMPTY_STATS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authHydrated, isLoggedIn, role]);

  useEffect(() => { void loadData(); }, [loadData]);

  /* Derived */
  const activeOrders    = orders.filter(o => ['PENDING','ASSIGNED','ACCEPTED','IN_PROGRESS'].includes(o.status));
  const completedOrders = orders.filter(o => o.status === 'COMPLETED');
  const recentOrders    = orders.slice(0, 8);
  const totalSpent      = stats?.total_spent ?? completedOrders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);

  const handleLogout = useCallback(() => {
    logout();
    router.push('/');
  }, [router]);

  /* ── Guest view ── */
  if (!loading && (!isLoggedIn || role !== 'customer')) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@300;400;500;600;700&display=swap');
          @keyframes chPulse{0%,100%{opacity:1}50%{opacity:0.3}}
          .ch-guest-hero{position:relative;background:linear-gradient(150deg,#0A1628,#1E3A8A,#1D4ED8);padding:72px 24px 60px;overflow:hidden;font-family:'DM Sans',sans-serif;}
          .ch-guest-drop{position:absolute;top:0;right:0;width:340px;height:440px;pointer-events:none;opacity:0.5;}
          .ch-guest-content{max-width:600px;margin:0 auto;text-align:center;position:relative;z-index:1;}
          .ch-guest-eyebrow{display:inline-flex;align-items:center;gap:7px;background:rgba(96,165,250,0.12);border:1px solid rgba(96,165,250,0.28);padding:5px 14px;border-radius:99px;font-size:11px;font-weight:700;color:#93C5FD;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:18px;}
          .ch-guest-title{font-family:'Syne',sans-serif;font-weight:900;font-size:clamp(2.2rem,5.5vw,3.6rem);color:#fff;letter-spacing:-2px;line-height:0.97;margin:0 0 16px;}
          .ch-guest-title span{color:#60A5FA;}
          .ch-guest-sub{font-size:clamp(0.9rem,1.8vw,1.05rem);color:rgba(255,255,255,0.55);max-width:440px;margin:0 auto 24px;line-height:1.65;}
          .ch-guest-btns{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-bottom:22px;}
          .ch-btn-primary{display:inline-flex;align-items:center;gap:8px;border-radius:13px;background:#2563EB;color:#fff;font-family:'DM Sans',sans-serif;font-weight:700;border:none;cursor:pointer;box-shadow:0 4px 16px rgba(37,99,235,0.4);transition:all 0.18s;text-decoration:none;}
          .ch-btn-primary:hover{background:#1D4ED8;transform:translateY(-2px);box-shadow:0 7px 22px rgba(37,99,235,0.48);}
          .ch-btn-ghost{display:inline-flex;align-items:center;border-radius:13px;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.8);border:1px solid rgba(255,255,255,0.2);font-family:'DM Sans',sans-serif;font-weight:600;cursor:pointer;transition:all 0.18s;text-decoration:none;}
          .ch-btn-ghost:hover{background:rgba(255,255,255,0.18);}
          .ch-guest-trust{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;}
          .ch-trust-pill{font-size:11px;font-weight:600;color:rgba(255,255,255,0.5);background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);padding:5px 12px;border-radius:99px;}
          .ch-guest-wave{position:absolute;bottom:-1px;left:0;right:0;height:60px;pointer-events:none;}
        `}</style>
        <GuestHero onBook={() => router.push('/book')} />
        <div style={{ background:'#F0F6FF', padding:'40px 24px 64px' }}>
          <div style={{ maxWidth:960, margin:'0 auto' }}>
            <div style={{ textAlign:'center', marginBottom:32 }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:'clamp(1.4rem,3vw,2rem)', color:'#0A1628', letterSpacing:-0.5 }}>Every water service, one platform</div>
              <p style={{ fontSize:14, color:'#64748B', marginTop:8 }}>Book, track, and manage — all in one place.</p>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12 }}>
              {SERVICES.map(s => (
                <Link key={s.key} href={`/book?service=${s.key}`} style={{ background:'#fff', borderRadius:16, border:'1px solid #DBEAFE', padding:'18px 12px', textAlign:'center', textDecoration:'none', display:'block', transition:'all 0.18s', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}
                  onMouseEnter={e=>(e.currentTarget.style.transform='translateY(-3px)')}
                  onMouseLeave={e=>(e.currentTarget.style.transform='')}>
                  <div style={{ fontSize:28, marginBottom:8 }}>{s.emoji}</div>
                  <div style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:12, color:'#0A1628' }}>{s.label}</div>
                  <div style={{ fontSize:10, color:'#94A3B8', marginTop:2 }}>{s.sub}</div>
                </Link>
              ))}
            </div>
            <div style={{ textAlign:'center', marginTop:32 }}>
              <Link href="/auth/login" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'13px 28px', borderRadius:13, background:'#2563EB', color:'#fff', fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:14, textDecoration:'none', boxShadow:'0 4px 14px rgba(37,99,235,0.3)' }}>
                Sign In to Track Your Orders →
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ── Authenticated view ── */
  return (
    <>
      {/* ══════════════════════ STYLES ══════════════════════ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@300;400;500;600;700&display=swap');

        @keyframes chShimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        @keyframes chFadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes chPulse   { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes chSpin    { to{transform:rotate(360deg)} }
        @keyframes chRipple  { 0%{transform:scale(0);opacity:0.5} 100%{transform:scale(3);opacity:0} }
        @keyframes chWave    { 0%,100%{d:path("M0,30 C240,55 480,5 720,30 C960,55 1200,10 1440,30 L1440,60 L0,60 Z")} 50%{d:path("M0,40 C200,15 500,58 720,38 C940,18 1200,52 1440,40 L1440,60 L0,60 Z")} }

        .ch-page { font-family:'DM Sans',sans-serif; min-height:100vh; background:#F0F6FF; }

        /* ── HERO HEADER ── */
        .ch-hero {
          background:linear-gradient(150deg,#0A1628 0%,#0F2557 55%,#1A3A8F 100%);
          padding:0 24px; position:relative; overflow:hidden;
        }
        .ch-hero-grid {
          position:absolute;inset:0;pointer-events:none;
          background-image:linear-gradient(rgba(99,155,255,0.05)1px,transparent 1px),linear-gradient(90deg,rgba(99,155,255,0.05)1px,transparent 1px);
          background-size:44px 44px;
        }
        .ch-hero-inner {
          max-width:960px;margin:0 auto;
          display:flex;align-items:center;justify-content:space-between;
          padding:22px 0;gap:16px;position:relative;z-index:1;flex-wrap:wrap;
        }
        .ch-hero-left { display:flex;align-items:center;gap:13px; }
        .ch-hero-avatar {
          width:46px;height:46px;border-radius:13px;
          background:linear-gradient(135deg,#DBEAFE,#BFDBFE);
          color:#1E3A8A;font-family:'Syne',sans-serif;font-weight:900;font-size:14px;
          display:flex;align-items:center;justify-content:center;flex-shrink:0;
        }
        .ch-hero-greeting {
          font-size:12px;color:rgba(255,255,255,0.45);font-weight:500;margin-bottom:2px;
        }
        .ch-hero-name {
          font-family:'Syne',sans-serif;font-weight:900;font-size:1.1rem;
          color:#fff;letter-spacing:-0.3px;line-height:1;
        }
        .ch-hero-right { display:flex;align-items:center;gap:8px;flex-wrap:wrap; }
        .ch-live-pill {
          display:inline-flex;align-items:center;gap:5px;
          background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.25);
          padding:5px 11px;border-radius:99px;
          font-size:10px;font-weight:700;color:#6EE7B7;letter-spacing:0.06em;
        }
        .ch-clock { font-size:10px;color:rgba(255,255,255,0.3);font-weight:500;font-variant-numeric:tabular-nums; }
        .ch-hero-btn {
          display:inline-flex;align-items:center;gap:6px;
          padding:9px 18px;border-radius:10px;font-family:'DM Sans',sans-serif;
          font-weight:700;font-size:12.5px;border:none;cursor:pointer;transition:all 0.16s;
          text-decoration:none;
        }
        .ch-hero-btn-primary {
          background:#2563EB;color:#fff;
          box-shadow:0 3px 10px rgba(37,99,235,0.35);
        }
        .ch-hero-btn-primary:hover { background:#1D4ED8;transform:translateY(-1px); }
        .ch-hero-btn-ghost {
          background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.75);
          border:1px solid rgba(255,255,255,0.15)!important;
        }
        .ch-hero-btn-ghost:hover { background:rgba(255,255,255,0.15); }
        .ch-hero-wave {
          position:absolute;bottom:-1px;left:0;right:0;height:56px;pointer-events:none;
        }
        .ch-hero-wave path { animation:chWave 8s ease-in-out infinite; }

        /* ── BODY ── */
        .ch-body { max-width:960px;margin:0 auto;padding:22px 20px 80px; }

        /* ── WELCOME CARD ── */
        .ch-welcome {
          border-radius:20px;overflow:hidden;position:relative;
          background:linear-gradient(145deg,#0A1628,#0F2A6F,#1A3A8F);
          border:1px solid rgba(96,165,250,0.18);
          box-shadow:0 6px 28px rgba(37,99,235,0.18);
          padding:26px 26px 0;margin-bottom:18px;
          animation:chFadeUp 0.45s ease both;
        }
        .ch-welcome-drop {
          position:absolute;top:-20px;right:-20px;
          width:160px;height:200px;pointer-events:none;opacity:0.1;
        }
        .ch-welcome-grid {
          position:absolute;inset:0;pointer-events:none;
          background-image:linear-gradient(rgba(96,165,250,0.04)1px,transparent 1px),linear-gradient(90deg,rgba(96,165,250,0.04)1px,transparent 1px);
          background-size:30px 30px;
        }
        .ch-welcome-title {
          font-family:'Syne',sans-serif;font-weight:900;
          font-size:clamp(1.15rem,3vw,1.55rem);
          color:#fff;letter-spacing:-0.5px;line-height:1.1;margin:0 0 6px;
          position:relative;z-index:1;
        }
        .ch-welcome-sub { font-size:13px;color:rgba(255,255,255,0.48);margin-bottom:18px;position:relative;z-index:1; }
        .ch-welcome-btns { display:flex;gap:9px;flex-wrap:wrap;margin-bottom:20px;position:relative;z-index:1; }
        .ch-welcome-trust {
          display:flex;gap:16px;padding:12px 0;flex-wrap:wrap;
          border-top:1px solid rgba(255,255,255,0.08);position:relative;z-index:1;
        }
        .ch-welcome-trust-item {
          display:flex;align-items:center;gap:5px;
          font-size:11px;color:rgba(255,255,255,0.4);font-weight:500;
        }
        .ch-welcome-wave {
          width:100%;height:48px;display:block;margin-top:-1px;
        }

        /* ── STAT STRIP ── */
        .ch-stat-strip {
          display:grid;grid-template-columns:repeat(4,1fr);
          background:#fff;border-radius:16px;border:1px solid #DBEAFE;
          box-shadow:0 1px 3px rgba(0,0,0,0.04);overflow:hidden;
          margin-bottom:18px;animation:chFadeUp 0.45s 0.07s ease both;
        }
        .ch-stat-item {
          padding:14px 16px;border-right:1px solid #EEF5FF;
          text-align:center;position:relative;
        }
        .ch-stat-item:last-child { border-right:none; }
        .ch-stat-icon { font-size:18px;margin-bottom:4px; }
        .ch-stat-val {
          font-family:'Syne',sans-serif;font-weight:900;
          font-size:clamp(1.1rem,2.5vw,1.35rem);
          letter-spacing:-0.3px;line-height:1;color:#0A1628;
        }
        .ch-stat-lbl { font-size:9px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.08em;margin-top:3px; }
        .ch-stat-bar { position:absolute;bottom:0;left:10%;right:10%;height:2px;border-radius:1px; }

        /* ── SECTION LABEL ── */
        .ch-section-lbl {
          font-size:10px;font-weight:800;color:#2563EB;
          letter-spacing:0.12em;text-transform:uppercase;
          display:flex;align-items:center;gap:6px;margin-bottom:10px;
        }
        .ch-section-lbl::before { content:'';width:14px;height:2px;background:#2563EB;border-radius:1px; }

        /* ── CARD ── */
        .ch-card {
          background:#fff;border-radius:18px;border:1px solid #DBEAFE;
          box-shadow:0 1px 3px rgba(0,0,0,0.04),0 4px 14px rgba(37,99,235,0.05);
        }
        .ch-card-head {
          display:flex;align-items:center;justify-content:space-between;
          padding:16px 20px 14px;border-bottom:1px solid #EEF5FF;flex-wrap:wrap;gap:8px;
        }
        .ch-card-title {
          font-family:'Syne',sans-serif;font-weight:800;font-size:0.9rem;
          color:#0A1628;letter-spacing:-0.2px;margin:0;
        }
        .ch-card-link {
          font-size:12px;font-weight:600;color:#2563EB;
          text-decoration:none;transition:color 0.14s;
        }
        .ch-card-link:hover { color:#1D4ED8; }

        /* ── ACTIVE ORDER CARD ── */
        .ch-active-card {
          border-radius:16px;border:2px solid #DBEAFE;background:#fff;
          padding:16px;transition:all 0.2s;animation:chFadeUp 0.4s ease both;
        }
        .ch-active-card:hover { border-color:#93C5FD;box-shadow:0 6px 20px rgba(37,99,235,0.1);transform:translateY(-2px); }
        .ch-active-card-live {
          border-color:#8B5CF6;
          box-shadow:0 0 0 1px #8B5CF6, 0 4px 18px rgba(139,92,246,0.15);
        }

        /* ── ORDER ROW ── */
        .ch-order-row {
          display:flex;align-items:center;gap:12px;
          padding:11px 16px;border-bottom:1px solid #F0F6FF;
          transition:background 0.14s;cursor:pointer;
        }
        .ch-order-row:last-child { border-bottom:none; }
        .ch-order-row:hover { background:#FAFCFF; }

        /* ── SERVICE GRID ── */
        .ch-svc-grid {
          display:grid;grid-template-columns:repeat(6,1fr);gap:10px;
        }
        .ch-svc-btn {
          background:#fff;border-radius:14px;border:1px solid #DBEAFE;
          padding:14px 8px;text-align:center;cursor:pointer;
          transition:all 0.18s;box-shadow:0 1px 3px rgba(0,0,0,0.04);
          text-decoration:none;display:block;
        }
        .ch-svc-btn:hover { border-color:#93C5FD;transform:translateY(-2px);box-shadow:0 5px 16px rgba(37,99,235,0.1); }

        /* ── EMPTY STATE ── */
        .ch-empty { text-align:center;padding:40px 20px; }

        /* ── BUTTONS ── */
        .ch-btn-primary {
          display:inline-flex;align-items:center;gap:7px;
          padding:10px 20px;border-radius:11px;
          background:#2563EB;color:#fff;
          font-family:'DM Sans',sans-serif;font-weight:700;font-size:13px;
          border:none;cursor:pointer;text-decoration:none;
          box-shadow:0 3px 10px rgba(37,99,235,0.28);
          transition:all 0.16s;
        }
        .ch-btn-primary:hover { background:#1D4ED8;transform:translateY(-1px);box-shadow:0 5px 16px rgba(37,99,235,0.36); }
        .ch-btn-primary:active { transform:scale(0.97); }
        .ch-btn-outline {
          display:inline-flex;align-items:center;gap:7px;
          padding:9px 18px;border-radius:11px;
          background:#fff;color:#2563EB;
          border:1.5px solid #BFDBFE;
          font-family:'DM Sans',sans-serif;font-weight:700;font-size:13px;
          cursor:pointer;text-decoration:none;transition:all 0.16s;
        }
        .ch-btn-outline:hover { background:#EFF6FF;border-color:#60A5FA; }
        .ch-btn-danger {
          display:inline-flex;align-items:center;gap:7px;
          padding:9px 16px;border-radius:11px;
          background:#FEF2F2;color:#DC2626;
          border:1.5px solid #FECACA;
          font-family:'DM Sans',sans-serif;font-weight:700;font-size:12px;
          cursor:pointer;transition:all 0.16s;
        }
        .ch-btn-danger:hover { background:#FEE2E2; }

        /* ── ERROR BANNER ── */
        .ch-error {
          background:#FEF2F2;border:1px solid #FECACA;border-radius:13px;
          padding:12px 16px;font-size:13px;color:#DC2626;font-weight:600;
          display:flex;align-items:center;gap:10px;margin-bottom:16px;
          animation:chFadeUp 0.3s ease both;
        }

        /* ── NOTIFICATION CARD ── */
        .ch-notif {
          display:flex;align-items:flex-start;gap:12px;
          padding:13px 16px;border-bottom:1px solid #EEF5FF;
        }
        .ch-notif:last-child { border-bottom:none; }
        .ch-notif-icon {
          width:36px;height:36px;border-radius:11px;background:#EFF6FF;border:1px solid #DBEAFE;
          display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;
        }

        /* ── RESPONSIVE ── */
        @media(max-width:900px) {
          .ch-svc-grid { grid-template-columns:repeat(3,1fr); }
        }
        @media(max-width:640px) {
          .ch-hero { padding:0 16px; }
          .ch-body { padding:16px 14px 88px; }
          .ch-stat-strip { grid-template-columns:1fr 1fr; }
          .ch-stat-item:nth-child(2) { border-right:none; }
          .ch-stat-item:nth-child(3) { border-top:1px solid #EEF5FF; border-right:1px solid #EEF5FF; }
          .ch-stat-item:nth-child(4) { border-top:1px solid #EEF5FF; border-right:none; }
          .ch-svc-grid { grid-template-columns:repeat(3,1fr); gap:8px; }
          .ch-welcome { padding:20px 18px 0; }
          .ch-hero-right .ch-clock { display:none; }
        }
        @media(max-width:400px) {
          .ch-svc-grid { grid-template-columns:repeat(2,1fr); }
          .ch-stat-strip { grid-template-columns:1fr; }
          .ch-stat-item { border-right:none!important; border-bottom:1px solid #EEF5FF; }
          .ch-stat-item:last-child { border-bottom:none; }
        }
      `}</style>

      <div className="ch-page">

        {/* ════ HERO HEADER ════════════════════════════════ */}
        <div className="ch-hero">
          <div className="ch-hero-grid" />
          <div className="ch-hero-inner">
            {/* Left: avatar + greeting */}
            <div className="ch-hero-left">
              <div className="ch-hero-avatar">{getInitials(fullName ?? undefined)}</div>
              <div>
                <div className="ch-hero-greeting">{greeting}</div>
                <div className="ch-hero-name">{fullName || 'My Account'}</div>
              </div>
            </div>

            {/* Right: controls */}
            <div className="ch-hero-right">
              <div className="ch-clock">{clock}</div>
              <div className="ch-live-pill">
                <span style={{ width:5, height:5, borderRadius:'50%', background:'#34D399', animation:'chPulse 1.5s infinite' }} />
                Live
              </div>
              <button type="button" onClick={() => void loadData(true)} disabled={refreshing}
                style={{ width:32, height:32, borderRadius:9, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', color:'rgba(255,255,255,0.75)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all 0.15s' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={refreshing ? { animation:'chSpin 0.65s linear infinite' } : {}}>
                  <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                </svg>
              </button>
              <Link href="/book" className="ch-hero-btn ch-hero-btn-primary">+ Book</Link>
              <Link href="/customer/addresses" className="ch-hero-btn ch-hero-btn-ghost">Addresses</Link>
              <button type="button" onClick={handleLogout} className="ch-hero-btn ch-hero-btn-ghost"
                style={{ color:'#FCA5A5', borderColor:'rgba(252,165,165,0.25)', background:'rgba(220,38,38,0.08)' }}>
                Sign out
              </button>
            </div>
          </div>

          {/* Animated wave */}
          <svg className="ch-hero-wave" viewBox="0 0 1440 56" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path fill="#F0F6FF" d="M0,28 C240,52 480,4 720,28 C960,52 1200,8 1440,28 L1440,56 L0,56 Z"/>
            <path fill="#F0F6FF" fillOpacity="0.5" d="M0,38 C200,16 500,50 720,34 C940,18 1200,46 1440,38 L1440,56 L0,56 Z"/>
          </svg>
        </div>

        {/* ════ BODY ════════════════════════════════════════ */}
        <div className="ch-body">

          {/* Error */}
          {error && (
            <div className="mb-4 space-y-2">
              <DatabaseErrorBanner message={error} />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void loadData()}
                  className="rounded-lg px-4 py-2 text-xs font-bold text-white"
                  style={{
                    background: '#2563EB',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* ── Welcome card ── */}
          <div className="ch-welcome">
            <div className="ch-welcome-drop" aria-hidden="true">
              <svg viewBox="0 0 160 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M80 8C45 55 15 88 15 120a65 65 0 00130 0c0-32-28-65-65-112z" fill="#60A5FA"/>
                <circle cx="60" cy="108" r="10" fill="#fff" fillOpacity="0.3"/>
              </svg>
            </div>
            <div className="ch-welcome-grid" />
            <div style={{ position:'relative', zIndex:1 }}>
              <h2 className="ch-welcome-title">
                {loading ? 'Loading your dashboard…'
                  : activeOrders.length > 0 ? `You have ${activeOrders.length} active booking${activeOrders.length !== 1 ? 's' : ''}.`
                  : orders.length > 0 ? 'Your water is taken care of.'
                  : 'Ready to book your first service?'}
              </h2>
              <p className="ch-welcome-sub">
                {loading ? '' : orders.length > 0
                  ? `${completedOrders.length} completed · ${inr(totalSpent)} spent · Saved vs market prices`
                  : 'Verified pros · Upfront pricing · Same-day slots available across 13 UP cities.'}
              </p>
              <div className="ch-welcome-btns">
                <Link href="/book" className="ch-btn-primary" style={{ fontSize:13, padding:'11px 22px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" fill="rgba(255,255,255,0.35)"/><path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" stroke="#fff" strokeWidth="1.5" fill="none"/></svg>
                  Book a Service
                </Link>
                <Link href="/customer/history" className="ch-btn-outline" style={{ fontSize:12, padding:'10px 18px', background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.75)', borderColor:'rgba(255,255,255,0.18)' }}>
                  Order History
                </Link>
              </div>
              <div className="ch-welcome-trust">
                {['₹12/can · BIS certified','Same-day delivery','4.8★ avg rating','No hidden fees'].map(t => (
                  <span key={t} className="ch-welcome-trust-item">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="6" fill="#60A5FA" fillOpacity="0.15"/><path d="M3.5 6l1.8 1.8 3.2-3.6" stroke="#60A5FA" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <svg className="ch-welcome-wave" viewBox="0 0 1440 48" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
              <path fill="#F0F6FF" d="M0,24 C240,44 480,4 720,24 C960,44 1200,8 1440,24 L1440,48 L0,48 Z"/>
              <path fill="#F0F6FF" fillOpacity="0.5" d="M0,34 C200,12 500,42 720,28 C940,14 1200,38 1440,34 L1440,48 L0,48 Z"/>
            </svg>
          </div>

          {/* ── Stats strip ── */}
          <div className="ch-stat-strip">
            {loading
              ? Array.from({ length:4 }).map((_,i) => (
                  <div key={i} className="ch-stat-item">
                    <Skeleton w={24} h={18} r={6}/><div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:6, alignItems:'center' }}><Skeleton w="50%" h={20} r={5}/><Skeleton w="60%" h={8} r={4}/></div>
                  </div>
                ))
              : [
                  { icon:'📦', val:stats?.total_orders ?? orders.length,          lbl:'Total Orders',  bar:'#2563EB' },
                  { icon:'⚡', val:stats?.active_orders ?? activeOrders.length,    lbl:'Active Now',    bar:'#7C3AED', warn:activeOrders.length>0 },
                  { icon:'✅', val:stats?.completed ?? completedOrders.length, lbl:'Completed',     bar:'#059669' },
                  { icon:'💰', val:null, money:totalSpent, lbl:'Total Spent',   bar:'#D97706' },
                ].map((s,i) => (
                  <div key={i} className="ch-stat-item">
                    <div className="ch-stat-icon">{s.icon}</div>
                    <div className="ch-stat-val" style={{ color:s.warn?'#7C3AED':i===3?'#D97706':'#0A1628' }}>
                      {s.money != null ? inr(s.money) : <CountUp to={s.val!} />}
                    </div>
                    <div className="ch-stat-lbl">{s.lbl}</div>
                    <div className="ch-stat-bar" style={{ background:s.bar }} />
                  </div>
                ))
            }
          </div>

          {/* ── Active orders ── */}
          {loading && (
            <div style={{ marginBottom:18 }}>
              <div className="ch-section-lbl">Active Bookings</div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      background: '#fff',
                      border: '1px solid #DBEAFE',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      display: 'flex',
                      gap: 13,
                      alignItems: 'flex-start',
                    }}
                  >
                    <Skeleton w={44} h={44} r={13} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <Skeleton w="45%" h={14} r={6} />
                      <Skeleton w="65%" h={10} r={5} />
                      <Skeleton w={80} h={18} r={99} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!loading && activeOrders.length > 0 && (
            <div style={{ marginBottom:18 }}>
              <div className="ch-section-lbl">Active Bookings</div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {activeOrders.map((order, i) => {
                  const svc     = getSvcMeta(order.service_name);
                  const isLive  = order.status === 'IN_PROGRESS';
                  return (
                    <div
                      key={order.id}
                      className={`ch-active-card${isLive ? ' ch-active-card-live' : ''}`}
                      style={{ animationDelay:`${i * 70}ms` }}
                    >
                      <div style={{ display:'flex', alignItems:'flex-start', gap:13 }}>
                        <div style={{ width:44, height:44, borderRadius:13, background:svc.color+'18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                          {svc.emoji}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                            {isLive && (
                              <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'#EDE9FE', color:'#5B21B6', fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:99, letterSpacing:'0.08em', textTransform:'uppercase' }}>
                                <span style={{ width:5, height:5, borderRadius:'50%', background:'#8B5CF6', animation:'chPulse 1.2s infinite' }} />
                                LIVE
                              </span>
                            )}
                            <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:14, color:'#0A1628' }}>
                              {svc.label}
                            </span>
                            <StatusBadge status={order.status} />
                          </div>
                          <div style={{ fontSize:11, color:'#94A3B8', marginBottom:6 }}>
                            Order #{order.id} · {order.time_slot ? `Slot: ${order.time_slot}` : fmtDate(order.created_at)}
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                            <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:15, color:'#2563EB' }}>
                              {inr(order.total_amount)}
                            </span>
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:8, flexShrink:0, flexWrap:'wrap' }}>
                          <Link href={`/customer/track/${order.id}`} className="ch-btn-primary" style={{ fontSize:12, padding:'8px 14px' }}>
                            Track →
                          </Link>
                          <Link href="/book" className="ch-btn-outline" style={{ fontSize:12, padding:'7px 12px' }}>
                            Rebook
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Book a Service grid ── */}
          <div style={{ marginBottom:18 }}>
            <div className="ch-section-lbl">Book a Service</div>
            <div className="ch-svc-grid">
              {SERVICES.map(s => (
                <Link key={s.key} href={`/book?service=${s.key}`} className="ch-svc-btn">
                  <div style={{ fontSize:26, marginBottom:7 }}>{s.emoji}</div>
                  <div style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:11, color:'#0A1628', lineHeight:1.3 }}>{s.label}</div>
                  <div style={{ fontSize:10, color:'#94A3B8', marginTop:2 }}>{s.sub}</div>
                </Link>
              ))}
            </div>
          </div>

          {/* ── Order history ── */}
          <div className="ch-card" style={{ marginBottom:18 }}>
            <div className="ch-card-head">
              <h2 className="ch-card-title">Order History</h2>
              <Link href="/customer/history" className="ch-card-link">View all →</Link>
            </div>

            {loading ? (
              <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:12 }}>
                {Array.from({ length:4 }).map((_,i) => (
                  <div key={i} style={{ display:'flex', gap:12, alignItems:'center' }}>
                    <Skeleton w={36} h={36} r={11} />
                    <div style={{ flex:1, display:'flex', flexDirection:'column', gap:7 }}>
                      <Skeleton w="55%" h={12} r={5} />
                      <Skeleton w="40%" h={10} r={5} />
                    </div>
                    <Skeleton w={60} h={20} r={99} />
                    <Skeleton w={50} h={12} r={5} />
                  </div>
                ))}
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="ch-empty">
                {/* Inline water SVG for empty state */}
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ margin:'0 auto 12px', display:'block' }}>
                  <circle cx="32" cy="32" r="32" fill="#EFF6FF"/>
                  <path d="M32 12C20 26 12 34 12 42a20 20 0 0040 0c0-8-8-16-20-30z" fill="#BFDBFE"/>
                  <path d="M32 20C23 31 18 37 18 42a14 14 0 0028 0c0-5-5-11-14-22z" fill="#60A5FA" fillOpacity="0.55"/>
                  <circle cx="26" cy="39" r="3.5" fill="#fff" fillOpacity="0.5"/>
                </svg>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, color:'#1D4ED8', marginBottom:4, fontSize:'0.95rem' }}>No orders yet</div>
                <div style={{ fontSize:12, color:'#64748B', marginBottom:14 }}>Book your first service in under 60 seconds</div>
                <Link href="/book" className="ch-btn-primary" style={{ margin:'0 auto', fontSize:13 }}>Book Now →</Link>
              </div>
            ) : (
              recentOrders.map(order => {
                const svc = getSvcMeta(order.service_name);
                return (
                  <div key={order.id} className="ch-order-row"
                    onClick={() => router.push(`/customer/track/${order.id}`)}>
                    <div style={{ width:38, height:38, borderRadius:11, background:svc.color+'18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                      {svc.emoji}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:13, color:'#0A1628', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {svc.label}
                      </div>
                      <div style={{ fontSize:11, color:'#94A3B8', marginTop:1 }}>
                        #{order.id} · {relTime(order.created_at)}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                      <StatusBadge status={order.status} />
                      <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:900, fontSize:13, color:'#2563EB', minWidth:52, textAlign:'right' }}>
                        {inr(order.total_amount)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── Notifications ── */}
          <div className="ch-card" style={{ marginBottom:18 }}>
            <div className="ch-card-head">
              <h2 className="ch-card-title">Notifications</h2>
              {!loading && notifs.length > 0 && (
                <span style={{ fontSize:9, fontWeight:800, background:'#EDE9FE', color:'#5B21B6', padding:'3px 8px', borderRadius:99, letterSpacing:'0.06em', textTransform:'uppercase' }}>
                  {notifs.length} updates
                </span>
              )}
            </div>
            {loading ? (
              <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:14 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                    <Skeleton w={36} h={36} r={11} />
                    <div style={{ flex:1 }}>
                      <Skeleton w="55%" h={13} r={5} />
                      <div style={{ height:6 }} />
                      <Skeleton w="80%" h={10} r={5} />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifs.length > 0 ? (
              notifs.slice(0, 3).map((n) => {
                return (
                  <div key={n.id} className="ch-notif">
                    <div className="ch-notif-icon">🔔</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:13, color:'#0A1628' }}>
                        {n.title}
                      </div>
                      <div style={{ fontSize:11, color:'#94A3B8', marginTop:2 }}>
                        {n.body || 'No details'} · {relTime(n.created_at)}
                      </div>
                    </div>
                    <Link href={n.order_id ? `/customer/track/${n.order_id}` : '/customer/history'}
                      style={{ fontSize:11, fontWeight:700, color:'#2563EB', textDecoration:'none', flexShrink:0 }}>
                      View →
                    </Link>
                  </div>
                );
              })
            ) : (
              <div style={{ padding:'18px 20px', fontSize:13, color:'#94A3B8', textAlign:'center' }}>
                No active updates. Book a service to get real-time order notifications here.
              </div>
            )}
          </div>

          {/* ── Quick links footer ── */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <Link href="/customer/addresses" className="ch-btn-outline" style={{ fontSize:12 }}>📍 My Addresses</Link>
            <Link href="/customer/history"   className="ch-btn-outline" style={{ fontSize:12 }}>📋 Order History</Link>
            <Link href="/pricing"            className="ch-btn-outline" style={{ fontSize:12 }}>💰 View Pricing</Link>
            <Link href="/contact"            className="ch-btn-outline" style={{ fontSize:12 }}>💬 Get Support</Link>
          </div>

        </div>
      </div>
    </>
  );
}