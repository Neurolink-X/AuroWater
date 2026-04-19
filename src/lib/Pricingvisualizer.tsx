'use client';

/**
 * AuroWater — Pricing Engine Visualizer
 * src/app/pricing/visualizer/page.tsx   (or wherever the Cursor agent places it)
 *
 * Fully interactive playground that demos every exported function in pricing.ts.
 * Shows real-time breakdowns, revenue splits, batch stats, and the daily chart.
 * Zero external chart libraries — pure CSS.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';

import {
  calculateOrderTotal,
  validateRevenueIntegrity,
  evaluateCoupon,
  computeRevenueStats,
  buildDailyRevenueSeries,
  filterByPeriod,
  computeCustomerSavings,
  formatINR,
  formatINRCompact,
  formatRate,
  SERVICE_LABELS,
  SERVICE_EMOJI,
  ALL_SERVICE_KEYS,
  type ServiceKey,
  type PricingInput,
  type PriceBreakdown,
  type Coupon,
  type OrderForStats,
  type RevenueStats,
} from '@/lib/pricing';

/* ─── demo seed orders ───────────────────────────────────────────────────────── */
const msDay = 86_400_000;
const now = Date.now();

const SEED_ORDERS: (OrderForStats & { discountAmount?: number })[] = [
  { status:'COMPLETED',   total:449, technicianEarnings:314, supplierEarnings:45,  platformRevenue:90,  createdAt:now-0*msDay,   serviceKey:'water_tanker',  discountAmount:0   },
  { status:'COMPLETED',   total:599, technicianEarnings:419, supplierEarnings:60,  platformRevenue:120, createdAt:now-1*msDay,   serviceKey:'tank_cleaning', discountAmount:50  },
  { status:'IN_PROGRESS', total:279, technicianEarnings:195, supplierEarnings:28,  platformRevenue:56,  createdAt:now-1*msDay,   serviceKey:'ro_service',    discountAmount:0   },
  { status:'COMPLETED',   total:349, technicianEarnings:244, supplierEarnings:35,  platformRevenue:70,  createdAt:now-2*msDay,   serviceKey:'plumbing',      discountAmount:20  },
  { status:'COMPLETED',   total:199, technicianEarnings:139, supplierEarnings:20,  platformRevenue:40,  createdAt:now-3*msDay,   serviceKey:'ro_service',    discountAmount:0   },
  { status:'CANCELLED',   total:999, technicianEarnings:0,   supplierEarnings:0,   platformRevenue:0,   createdAt:now-4*msDay,   serviceKey:'borewell',      discountAmount:0   },
  { status:'COMPLETED',   total:849, technicianEarnings:594, supplierEarnings:85,  platformRevenue:170, createdAt:now-5*msDay,   serviceKey:'motor_pump',    discountAmount:100 },
  { status:'COMPLETED',   total:449, technicianEarnings:314, supplierEarnings:45,  platformRevenue:90,  createdAt:now-6*msDay,   serviceKey:'water_tanker',  discountAmount:0   },
];

/* ─── default settings ───────────────────────────────────────────────────────── */
const DEFAULT_SETTINGS = {
  water_tanker:  350,
  ro_service:    149,
  plumbing:      199,
  borewell:      799,
  motor_pump:    549,
  tank_cleaning: 449,
  convenienceFee: 29,
  gstRate: 18,           // stored as percent, converted to 0..1 at use
  emergencySurcharge: 199,
  technicianCommissionRate: 70,   // percent
  supplierCommissionRate: 10,     // percent
};

type Period = 'today' | 'week' | 'month' | 'all';

/* ─── tiny ui helpers ────────────────────────────────────────────────────────── */
function cls(...parts: (string | false | undefined | null)[]) {
  return parts.filter(Boolean).join(' ');
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

/* ─── Radial donut (pure CSS / clip-path) ────────────────────────────────────── */
function DonutSlice({
  pct, offset, color, size = 120,
}: { pct: number; offset: number; color: string; size?: number }) {
  const r = 45;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const gap  = circ - dash;
  const rotate = (offset / 100) * 360 - 90;

  return (
    <circle
      cx="60" cy="60" r={r}
      fill="none"
      stroke={color}
      strokeWidth="14"
      strokeDasharray={`${dash} ${gap}`}
      strokeLinecap="round"
      style={{ transformOrigin: '60px 60px', transform: `rotate(${rotate}deg)`, transition: 'stroke-dasharray .6s ease' }}
    />
  );
}

/* ─── main component ─────────────────────────────────────────────────────────── */
export default function PricingVisualizerPage() {
  /* ── playground state ── */
  const [serviceKey, setServiceKey] = useState<ServiceKey>('water_tanker');
  const [emergency,  setEmergency]  = useState(false);
  const [canCount,   setCanCount]   = useState(10);
  const [couponCode, setCouponCode] = useState('');
  const [couponMsg,  setCouponMsg]  = useState<{ text: string; ok: boolean } | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [settings,   setSettings]   = useState({ ...DEFAULT_SETTINGS });
  const [period,     setPeriod]     = useState<Period>('week');
  const [activeTab,  setActiveTab]  = useState<'playground' | 'batch' | 'revenue'>('playground');
  const [mounted,    setMounted]    = useState(false);

  useEffect(() => { setMounted(true); }, []);

  /* ── demo coupons ── */
  const DEMO_COUPONS: Coupon[] = [
    { code:'FIRST50',  type:'flat',    value:50,  minOrderTotal:200, usageLimit:1,    usageCount:0 },
    { code:'WATER20',  type:'percent', value:20,  minOrderTotal:300, maxDiscountCap:100 },
    { code:'EXPIRED',  type:'flat',    value:100, expiresAt:'2020-01-01' },
    { code:'MAXED',    type:'flat',    value:75,  usageLimit:5, usageCount:5 },
  ];

  /* ── derived breakdown ── */
  const input: PricingInput = useMemo(() => ({
    serviceKey,
    basePrice: settings[serviceKey],
    convenienceFee: settings.convenienceFee,
    gstRate: settings.gstRate / 100,
    emergencySurcharge: settings.emergencySurcharge,
    emergency,
    technicianCommissionRate: settings.technicianCommissionRate / 100,
    supplierCommissionRate: settings.supplierCommissionRate / 100,
    coupon: appliedCoupon,
    canCount: serviceKey === 'water_tanker' ? canCount : undefined,
    pricePerCan: serviceKey === 'water_tanker' ? settings.water_tanker / 10 : undefined,
  }), [serviceKey, emergency, canCount, settings, appliedCoupon]);

  const bd: PriceBreakdown = useMemo(() => calculateOrderTotal(input), [input]);
  const integrity = validateRevenueIntegrity(bd);

  /* ── batch stats ── */
  const filteredOrders = useMemo(
    () => filterByPeriod(SEED_ORDERS, period),
    [period],
  );
  const stats: RevenueStats = useMemo(
    () => computeRevenueStats(filteredOrders),
    [filteredOrders],
  );
  const dailySeries = useMemo(
    () => buildDailyRevenueSeries(SEED_ORDERS),
    [],
  );
  const savings = useMemo(
    () => computeCustomerSavings(SEED_ORDERS),
    [],
  );
  const maxBarVal = useMemo(
    () => Math.max(1, ...dailySeries.map(d => d.amount)),
    [dailySeries],
  );

  /* ── coupon handler ── */
  const handleApplyCoupon = useCallback(() => {
    const c = DEMO_COUPONS.find(x => x.code === couponCode.trim().toUpperCase());
    if (!c) { setCouponMsg({ text: 'Coupon not found. Try FIRST50 or WATER20.', ok: false }); return; }
    const res = evaluateCoupon(c, bd.subtotal);
    if (res.valid) {
      setAppliedCoupon(c);
      setCouponMsg({ text: res.message, ok: true });
    } else {
      setAppliedCoupon(null);
      setCouponMsg({ text: res.error, ok: false });
    }
  }, [couponCode, bd.subtotal]);

  /* ── donut segments ── */
  const techPct  = bd.total > 0 ? (bd.technicianEarnings / bd.total) * 100 : 0;
  const suppPct  = bd.total > 0 ? (bd.supplierEarnings   / bd.total) * 100 : 0;
  const platPct  = bd.total > 0 ? (bd.platformRevenue    / bd.total) * 100 : 0;

  if (!mounted) return null;

  /* ─── render ─────────────────────────────────────────────────────────────── */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        :root {
          --ocean: #0B2545;
          --tide:  #1B4F72;
          --wave:  #0EA5E9;
          --foam:  #BAE6FD;
          --sand:  #F59E0B;
          --coral: #EF4444;
          --sea:   #06B6D4;
          --mint:  #10B981;
        }
        .viz-root  { font-family: 'DM Sans', sans-serif; background: linear-gradient(160deg,#0B2545 0%,#0c3460 40%,#164e63 100%); min-height:100vh; }
        .viz-display { font-family: 'Syne', sans-serif; }
        .glass     { background: rgba(255,255,255,.05); backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,.1); }
        .glass-strong { background: rgba(255,255,255,.10); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,.15); }

        .tab-pill  { padding:8px 20px; border-radius:999px; font-size:13px; font-weight:600; cursor:pointer; transition:all .2s; border:none; font-family:'DM Sans',sans-serif; }
        .tab-on    { background:var(--wave); color:#fff; box-shadow:0 4px 16px rgba(14,165,233,.4); }
        .tab-off   { background:rgba(255,255,255,.07); color:rgba(255,255,255,.6); }
        .tab-off:hover { background:rgba(255,255,255,.12); color:#fff; }

        .svc-btn   { border:1.5px solid rgba(255,255,255,.1); border-radius:14px; padding:12px 10px; cursor:pointer; transition:all .2s; text-align:center; background:rgba(255,255,255,.04); }
        .svc-btn:hover { border-color:var(--wave); background:rgba(14,165,233,.12); }
        .svc-on    { border-color:var(--wave) !important; background:rgba(14,165,233,.18) !important; box-shadow:0 0 0 3px rgba(14,165,233,.2); }

        .infield   { background:rgba(255,255,255,.08); border:1.5px solid rgba(255,255,255,.12); border-radius:10px; padding:9px 14px; color:#fff; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500; width:100%; outline:none; transition:.2s; }
        .infield:focus { border-color:var(--wave); background:rgba(14,165,233,.1); box-shadow:0 0 0 3px rgba(14,165,233,.15); }
        .infield::placeholder { color:rgba(255,255,255,.35); }
        .infield option { background:#0c3460; color:#fff; }

        .badge     { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:700; }

        .line-row  { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px dashed rgba(255,255,255,.07); }
        .line-row:last-child { border-bottom:none; }

        .btn-wave  { background:linear-gradient(135deg,#0EA5E9,#06B6D4); color:#fff; border:none; border-radius:10px; padding:10px 20px; font-family:'Syne',sans-serif; font-weight:700; font-size:13px; cursor:pointer; transition:.2s; box-shadow:0 4px 14px rgba(14,165,233,.3); }
        .btn-wave:hover { transform:translateY(-1px); box-shadow:0 6px 20px rgba(14,165,233,.45); }
        .btn-wave:active { transform:scale(.98); }

        .btn-ghost { background:rgba(255,255,255,.08); color:rgba(255,255,255,.8); border:1.5px solid rgba(255,255,255,.12); border-radius:10px; padding:9px 18px; font-family:'DM Sans',sans-serif; font-weight:600; font-size:13px; cursor:pointer; transition:.2s; }
        .btn-ghost:hover { background:rgba(255,255,255,.14); color:#fff; }

        .period-btn { padding:6px 16px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; border:none; font-family:'DM Sans',sans-serif; transition:.2s; }
        .period-on  { background:var(--sand); color:#1a1a1a; }
        .period-off { background:rgba(255,255,255,.08); color:rgba(255,255,255,.55); }
        .period-off:hover { background:rgba(255,255,255,.14); color:#fff; }

        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation:fadeUp .3s ease both; }

        @keyframes waveAnim { 0%,100%{transform:translateX(0)} 50%{transform:translateX(-20px)} }

        .integrity-ok  { color:#10B981; }
        .integrity-err { color:#EF4444; }

        /* Range slider */
        input[type=range] { -webkit-appearance:none; height:4px; border-radius:4px; background:rgba(255,255,255,.15); outline:none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:var(--wave); box-shadow:0 2px 8px rgba(14,165,233,.5); cursor:pointer; }

        /* Scrollbar */
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,.15); border-radius:4px; }

        /* Responsive */
        @media(max-width:768px){ .two-col { grid-template-columns:1fr !important; } }
      `}</style>

      <div className="viz-root px-4 py-8 sm:px-6">

        {/* ── Header ── */}
        <div className="max-w-5xl mx-auto mb-8 fade-up">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl"
                  style={{background:'linear-gradient(135deg,#0EA5E9,#06B6D4)'}}>💧</div>
                <span className="viz-display text-white font-bold text-xl tracking-tight">AuroWater</span>
              </div>
              <h1 className="viz-display text-3xl sm:text-4xl font-extrabold text-white leading-tight">
                Pricing Engine
              </h1>
              <p className="text-sky-300 text-sm mt-1 font-medium">
                Interactive visualizer · Real-time calculations · Revenue integrity checks
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`badge ${integrity ? 'integrity-ok' : 'integrity-err'}`}
                style={{background: integrity ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)',
                        border:`1px solid ${integrity ? '#10B981' : '#EF4444'}`}}>
                {integrity ? '✓ Revenue Integrity OK' : '⚠ Integrity Mismatch'}
              </span>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-2 mt-6 flex-wrap">
            {[
              {k:'playground',label:'⚡ Calculator'},
              {k:'batch',     label:'📊 Batch Stats'},
              {k:'revenue',   label:'💰 Revenue Split'},
            ].map(t=>(
              <button key={t.k} onClick={()=>setActiveTab(t.k as typeof activeTab)}
                className={`tab-pill ${activeTab===t.k?'tab-on':'tab-off'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-5xl mx-auto space-y-6 fade-up">

          {/* ══════════════════ PLAYGROUND ══════════════════ */}
          {activeTab==='playground'&&(
            <div className="grid gap-6 two-col" style={{gridTemplateColumns:'1fr 1fr'}}>

              {/* LEFT — inputs */}
              <div className="space-y-5">

                {/* Service picker */}
                <div className="glass rounded-2xl p-5">
                  <p className="viz-display text-white font-bold text-sm mb-3 uppercase tracking-widest opacity-70">Service</p>
                  <div className="grid grid-cols-3 gap-2">
                    {ALL_SERVICE_KEYS.map(k=>(
                      <button key={k} onClick={()=>setServiceKey(k)}
                        className={`svc-btn ${serviceKey===k?'svc-on':''}`}>
                        <div className="text-2xl mb-1">{SERVICE_EMOJI[k]}</div>
                        <div className="text-white text-[10px] font-semibold leading-tight">{SERVICE_LABELS[k]}</div>
                        <div className="text-sky-300 text-[11px] font-bold mt-1">₹{settings[k]}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Water can override */}
                {serviceKey==='water_tanker'&&(
                  <div className="glass rounded-2xl p-5 space-y-4">
                    <p className="viz-display text-white font-bold text-sm uppercase tracking-widest opacity-70">Can Config</p>
                    <div>
                      <div className="flex justify-between text-xs text-sky-300 mb-2">
                        <span>Number of Cans</span><span className="font-bold text-white">{canCount}</span>
                      </div>
                      <input type="range" min={1} max={50} value={canCount}
                        onChange={e=>setCanCount(Number(e.target.value))} className="w-full"/>
                    </div>
                    <div className="text-xs text-sky-400">
                      ₹{(settings.water_tanker/10).toFixed(0)}/can × {canCount} = ₹{((settings.water_tanker/10)*canCount).toFixed(0)}
                    </div>
                  </div>
                )}

                {/* Toggles */}
                <div className="glass rounded-2xl p-5 space-y-4">
                  <p className="viz-display text-white font-bold text-sm uppercase tracking-widest opacity-70">Options</p>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-white font-semibold text-sm">Emergency Booking</p>
                      <p className="text-sky-400 text-xs">+₹{settings.emergencySurcharge} surcharge</p>
                    </div>
                    <div onClick={()=>setEmergency(v=>!v)}
                      className={`w-12 h-6 rounded-full relative transition-all cursor-pointer ${emergency?'bg-red-500':'bg-white/15'}`}>
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${emergency?'left-7':'left-1'}`}/>
                    </div>
                  </label>
                </div>

                {/* Coupon */}
                <div className="glass rounded-2xl p-5 space-y-3">
                  <p className="viz-display text-white font-bold text-sm uppercase tracking-widest opacity-70">Coupon Code</p>
                  <div className="flex gap-2">
                    <input type="text" placeholder="FIRST50 · WATER20 · EXPIRED" value={couponCode}
                      onChange={e=>setCouponCode(e.target.value.toUpperCase())}
                      onKeyDown={e=>{ if(e.key==='Enter') handleApplyCoupon(); }}
                      className="infield flex-1"/>
                    <button onClick={handleApplyCoupon} className="btn-wave whitespace-nowrap text-xs px-4">Apply</button>
                    {appliedCoupon&&(
                      <button onClick={()=>{setAppliedCoupon(null);setCouponMsg(null);setCouponCode('');}}
                        className="btn-ghost text-xs px-3">✕</button>
                    )}
                  </div>
                  {couponMsg&&(
                    <p className={`text-xs font-semibold ${couponMsg.ok?'text-emerald-400':'text-red-400'}`}>
                      {couponMsg.ok?'✓':'✗'} {couponMsg.text}
                    </p>
                  )}
                  <p className="text-sky-500 text-[11px]">Try: FIRST50 · WATER20 · EXPIRED · MAXED</p>
                </div>

                {/* Settings sliders */}
                <div className="glass rounded-2xl p-5 space-y-4">
                  <p className="viz-display text-white font-bold text-sm uppercase tracking-widest opacity-70">Settings</p>
                  {[
                    {k:'convenienceFee',  label:'Convenience Fee (₹)', min:0,  max:100, step:1},
                    {k:'gstRate',         label:'GST Rate (%)',         min:0,  max:28,  step:1},
                    {k:'emergencySurcharge', label:'Emergency (₹)',     min:0,  max:500, step:10},
                    {k:'technicianCommissionRate', label:'Technician Cut (%)', min:0, max:90, step:1},
                    {k:'supplierCommissionRate',   label:'Supplier Cut (%)',   min:0, max:30, step:1},
                  ].map(s=>(
                    <div key={s.k}>
                      <div className="flex justify-between text-xs text-sky-300 mb-1.5">
                        <span>{s.label}</span>
                        <span className="font-bold text-white">
                          {s.k.includes('Rate')?`${settings[s.k as keyof typeof settings]}%`:`₹${settings[s.k as keyof typeof settings]}`}
                        </span>
                      </div>
                      <input type="range" min={s.min} max={s.max} step={s.step}
                        value={settings[s.k as keyof typeof settings] as number}
                        onChange={e=>setSettings(prev=>({...prev,[s.k]:Number(e.target.value)}))}
                        className="w-full"/>
                    </div>
                  ))}
                  <button onClick={()=>setSettings({...DEFAULT_SETTINGS})}
                    className="btn-ghost text-xs w-full justify-center">Reset to defaults</button>
                </div>
              </div>

              {/* RIGHT — breakdown */}
              <div className="space-y-5">

                {/* Grand total hero */}
                <div className="rounded-2xl p-6 text-center relative overflow-hidden"
                  style={{background:'linear-gradient(135deg,#0EA5E9,#06B6D4,#0891b2)'}}>
                  <div className="absolute inset-0 opacity-10"
                    style={{backgroundImage:'radial-gradient(circle at 80% 20%,#fff 0%,transparent 50%)'}}>
                  </div>
                  <p className="viz-display text-white/80 font-semibold text-xs uppercase tracking-widest mb-1">Customer Pays</p>
                  <p className="viz-display text-white font-black text-5xl tracking-tight">{formatINR(bd.total)}</p>
                  <p className="text-white/70 text-sm mt-1">{SERVICE_EMOJI[bd.serviceKey]} {SERVICE_LABELS[bd.serviceKey]}{emergency?' · 🚨 Emergency':''}</p>
                  {bd.discountAmount>0&&(
                    <div className="mt-2 inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1 text-white text-xs font-bold">
                      🎉 Saved {formatINR(bd.discountAmount)} with {bd.appliedCoupon}
                    </div>
                  )}
                </div>

                {/* Line items */}
                <div className="glass rounded-2xl p-5">
                  <p className="viz-display text-white font-bold text-sm uppercase tracking-widest opacity-70 mb-3">Price Breakdown</p>
                  <div>
                    {bd.lines.map((line, i) => (
                      <div key={i} className="line-row">
                        <div>
                          <p className="text-white/90 text-sm font-medium">{line.label}</p>
                          {line.note&&<p className="text-sky-400 text-[11px]">{line.note}</p>}
                        </div>
                        <p className={`viz-display font-bold text-sm ${line.sign===-1?'text-emerald-400':'text-white'}`}>
                          {line.sign===-1?'-':''}{formatINR(line.amount)}
                        </p>
                      </div>
                    ))}
                    <div className="mt-3 pt-3 flex justify-between" style={{borderTop:'2px solid rgba(255,255,255,.15)'}}>
                      <p className="viz-display text-white font-black text-base">Total</p>
                      <p className="viz-display text-white font-black text-xl">{formatINR(bd.total)}</p>
                    </div>
                  </div>
                </div>

                {/* Revenue split donut */}
                <div className="glass rounded-2xl p-5">
                  <p className="viz-display text-white font-bold text-sm uppercase tracking-widest opacity-70 mb-4">Revenue Split</p>
                  <div className="flex items-center gap-6">
                    {/* Donut */}
                    <div className="shrink-0 relative">
                      <svg viewBox="0 0 120 120" className="w-28 h-28">
                        <circle cx="60" cy="60" r="45" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="14"/>
                        <DonutSlice pct={techPct}  offset={0}                      color="#0EA5E9"/>
                        <DonutSlice pct={suppPct}  offset={techPct}               color="#F59E0B"/>
                        <DonutSlice pct={platPct}  offset={techPct+suppPct}       color="#10B981"/>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-white/60 text-[10px] font-semibold">TOTAL</p>
                        <p className="viz-display text-white font-bold text-sm">{formatINR(bd.total)}</p>
                      </div>
                    </div>
                    {/* Legend */}
                    <div className="flex-1 space-y-3">
                      {[
                        {label:'Technician',  val:bd.technicianEarnings, pct:techPct, color:'#0EA5E9', bg:'rgba(14,165,233,.15)'},
                        {label:'Supplier',    val:bd.supplierEarnings,   pct:suppPct, color:'#F59E0B', bg:'rgba(245,158,11,.15)'},
                        {label:'Platform',    val:bd.platformRevenue,    pct:platPct, color:'#10B981', bg:'rgba(16,185,129,.15)'},
                      ].map(row=>(
                        <div key={row.label}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-white/80 font-semibold flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full inline-block" style={{background:row.color}}/>
                              {row.label}
                            </span>
                            <span className="text-white font-bold">
                              {formatINR(row.val)} <span className="text-white/50 font-normal">({row.pct.toFixed(1)}%)</span>
                            </span>
                          </div>
                          <Bar pct={row.pct} color={`bg-[${row.color}]`}/>
                          {/* Fallback colored bar via inline style */}
                          <div className="w-full h-1.5 rounded-full bg-white/10 -mt-1.5 overflow-hidden">
                            <div style={{width:`${Math.min(100,row.pct)}%`,background:row.color,height:'100%',borderRadius:'999px',transition:'width .6s ease'}}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Integrity badge */}
                  <div className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold ${
                    integrity
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    <span className="text-base">{integrity?'✓':'⚠'}</span>
                    {integrity
                      ? `Revenue integrity verified — all splits sum to ${formatINR(bd.total)}`
                      : 'Revenue integrity failed — splits do not sum to total'}
                  </div>
                </div>

                {/* Per-role earnings detail */}
                <div className="glass rounded-2xl p-5">
                  <p className="viz-display text-white font-bold text-sm uppercase tracking-widest opacity-70 mb-3">Earning Detail</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      {role:'Technician', rate:settings.technicianCommissionRate, earn:bd.technicianEarnings, icon:'🔧', color:'#0EA5E9'},
                      {role:'Supplier',   rate:settings.supplierCommissionRate,   earn:bd.supplierEarnings,   icon:'🏭', color:'#F59E0B'},
                      {role:'Platform',   rate:100-settings.technicianCommissionRate-settings.supplierCommissionRate, earn:bd.platformRevenue, icon:'⚡', color:'#10B981'},
                    ].map(r=>(
                      <div key={r.role} className="rounded-xl p-3 text-center"
                        style={{background:`${r.color}18`,border:`1px solid ${r.color}30`}}>
                        <div className="text-xl mb-1">{r.icon}</div>
                        <p className="viz-display font-black text-white text-lg">{formatINR(r.earn)}</p>
                        <p className="text-white/60 text-[10px] font-semibold">{r.role}</p>
                        <p className="font-bold text-[11px] mt-0.5" style={{color:r.color}}>{r.rate.toFixed(0)}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════ BATCH STATS ══════════════════ */}
          {activeTab==='batch'&&(
            <div className="space-y-5">
              {/* Period selector */}
              <div className="glass rounded-2xl p-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <p className="viz-display text-white font-bold text-sm uppercase tracking-widest opacity-70">Period Filter</p>
                  <div className="flex gap-2">
                    {(['today','week','month','all'] as Period[]).map(p=>(
                      <button key={p} onClick={()=>setPeriod(p)}
                        className={`period-btn ${period===p?'period-on':'period-off'}`}>
                        {p.charAt(0).toUpperCase()+p.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Top-level stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  {label:'Gross Revenue',    val:formatINR(stats.grossRevenue),      sub:`${stats.completedOrders} completed`, color:'#0EA5E9'},
                  {label:'Platform Revenue', val:formatINR(stats.platformNetRevenue),sub:`${formatRate(stats.completionRate)} completion`, color:'#10B981'},
                  {label:'Tech Payouts',     val:formatINR(stats.technicianPayouts), sub:`Avg ${formatINR(stats.averageOrderValue)}/order`, color:'#F59E0B'},
                  {label:'Customer Savings', val:formatINR(savings),                 sub:`From ${SEED_ORDERS.filter(o=>o.discountAmount).length} coupons`, color:'#A78BFA'},
                ].map(s=>(
                  <div key={s.label} className="glass rounded-2xl p-5">
                    <p className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-2">{s.label}</p>
                    <p className="viz-display font-black text-2xl" style={{color:s.color}}>{s.val}</p>
                    <p className="text-white/40 text-xs mt-1">{s.sub}</p>
                  </div>
                ))}
              </div>

              {/* Daily bar chart */}
              <div className="glass rounded-2xl p-5">
                <p className="viz-display text-white font-bold text-sm uppercase tracking-widest opacity-70 mb-5">Last 7 Days Revenue</p>
                <div className="flex items-end gap-3 h-36">
                  {dailySeries.map((d,i)=>{
                    const pct = maxBarVal > 0 ? (d.amount/maxBarVal)*100 : 0;
                    const isToday = i===6;
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
                        <p className="text-white/60 text-[10px] font-semibold">{d.amount>0?formatINRCompact(d.amount):''}</p>
                        <div className="w-full rounded-t-lg transition-all duration-700 relative overflow-hidden"
                          style={{
                            height:`${Math.max(4,pct)}%`,
                            background: isToday
                              ? 'linear-gradient(to top,#0EA5E9,#38BDF8)'
                              : 'rgba(255,255,255,.12)',
                            minHeight:4,
                          }}>
                          {isToday&&<div className="absolute inset-0 opacity-50" style={{background:'linear-gradient(to bottom,rgba(255,255,255,.3),transparent)'}}/>}
                        </div>
                        <p className={`text-[10px] font-bold ${isToday?'text-sky-400':'text-white/50'}`}>{d.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* By service */}
              <div className="glass rounded-2xl p-5">
                <p className="viz-display text-white font-bold text-sm uppercase tracking-widest opacity-70 mb-4">Revenue by Service</p>
                <div className="space-y-3">
                  {ALL_SERVICE_KEYS.map(k=>{
                    const row=stats.byService[k];
                    const pct=stats.grossRevenue>0?(row.revenue/stats.grossRevenue)*100:0;
                    return (
                      <div key={k}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-white/80 font-semibold flex items-center gap-2">
                            <span>{SERVICE_EMOJI[k]}</span>{SERVICE_LABELS[k]}
                          </span>
                          <span className="text-white font-bold">
                            {formatINR(row.revenue)} <span className="text-white/40 font-normal">· {row.count} orders</span>
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div style={{width:`${pct}%`,height:'100%',background:'linear-gradient(to right,#0EA5E9,#06B6D4)',borderRadius:'999px',transition:'width .6s ease'}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Order list */}
              <div className="glass rounded-2xl p-5">
                <p className="viz-display text-white font-bold text-sm uppercase tracking-widest opacity-70 mb-4">Order Detail</p>
                <div className="space-y-2">
                  {filteredOrders.map((o,i)=>{
                    const m=SVC_MINI[o.serviceKey];
                    const statusColor = o.status==='COMPLETED'?'#10B981':o.status==='CANCELLED'?'#EF4444':'#F59E0B';
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl"
                        style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.06)'}}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                          style={{background:'rgba(255,255,255,.07)'}}>
                          {m.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-sm truncate">{m.label}</p>
                          <p className="text-white/40 text-xs">{new Date(o.createdAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="viz-display text-white font-bold text-sm">{formatINR(o.total)}</p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{background:`${statusColor}22`,color:statusColor}}>
                            {o.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════ REVENUE SPLIT ══════════════════ */}
          {activeTab==='revenue'&&(
            <div className="space-y-5">
              <div className="glass rounded-2xl p-5">
                <p className="viz-display text-white font-bold text-sm uppercase tracking-widest opacity-70 mb-1">Revenue Integrity Model</p>
                <p className="text-sky-400 text-xs">Every rupee in every order is accounted for — zero leakage.</p>
              </div>

              {/* Formula */}
              <div className="glass-strong rounded-2xl p-6">
                <p className="viz-display text-white font-bold text-sm mb-4">The Formula</p>
                <div className="rounded-xl p-4 text-sm font-mono"
                  style={{background:'rgba(0,0,0,.3)',border:'1px solid rgba(14,165,233,.2)'}}>
                  <p className="text-sky-300">// Total = Base + Convenience + GST − Discount + Emergency</p>
                  <p className="text-white mt-2">total = base + convFee + (base+convFee−discount)×gstRate + emg</p>
                  <p className="text-sky-300 mt-4">// Revenue split (guaranteed integrity)</p>
                  <p className="text-yellow-300 mt-1">techEarnings  = total × techRate</p>
                  <p className="text-amber-300">suppEarnings  = total × supplierRate</p>
                  <p className="text-emerald-300">platformRev   = total − techEarnings − suppEarnings</p>
                  <p className="text-sky-300 mt-4">// Always true ✓</p>
                  <p className="text-white">assert: techEarnings + suppEarnings + platformRev === total</p>
                </div>
              </div>

              {/* Live proof */}
              <div className="glass rounded-2xl p-5">
                <p className="viz-display text-white font-bold text-sm mb-4">Live Proof — Current Order</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    {label:'Customer Total', val:bd.total,               color:'#0EA5E9'},
                    {label:'Tech Earnings',  val:bd.technicianEarnings,  color:'#38BDF8'},
                    {label:'Supp Earnings',  val:bd.supplierEarnings,    color:'#F59E0B'},
                    {label:'Platform Rev',   val:bd.platformRevenue,     color:'#10B981'},
                  ].map(r=>(
                    <div key={r.label} className="rounded-xl p-4 text-center"
                      style={{background:`${r.color}14`,border:`1px solid ${r.color}25`}}>
                      <p className="viz-display font-black text-xl" style={{color:r.color}}>{formatINR(r.val)}</p>
                      <p className="text-white/60 text-[11px] mt-1 font-semibold">{r.label}</p>
                    </div>
                  ))}
                </div>
                <div className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold ${
                  integrity?'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400':'bg-red-500/10 border border-red-500/25 text-red-400'}`}>
                  <span className="text-xl">{integrity?'✓':'✗'}</span>
                  <div>
                    <p>{integrity?'Revenue Integrity Verified':'Integrity Check Failed'}</p>
                    <p className="font-normal opacity-75 text-xs">
                      {formatINR(bd.technicianEarnings)} + {formatINR(bd.supplierEarnings)} + {formatINR(bd.platformRevenue)} = {formatINR(bd.technicianEarnings+bd.supplierEarnings+bd.platformRevenue)} {integrity?`(= ${formatINR(bd.total)} ✓)`:`(≠ ${formatINR(bd.total)} ✗)`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Exported functions reference */}
              <div className="glass rounded-2xl p-5">
                <p className="viz-display text-white font-bold text-sm mb-4">Exported API — pricing.ts</p>
                <div className="space-y-2">
                  {[
                    {fn:'calculateOrderTotal(input)',     desc:'Full breakdown with all line items, GST, coupon, split'},
                    {fn:'validateRevenueIntegrity(bd)',   desc:'Returns boolean — must be true before saving any order'},
                    {fn:'evaluateCoupon(coupon, subtotal)',desc:'Validates expiry, usage, min order; returns discount amount'},
                    {fn:'computeRevenueStats(orders)',    desc:'Aggregate stats — gross, platform, payouts, by-service'},
                    {fn:'buildDailyRevenueSeries(orders)',desc:'Last 7 days as chart data array'},
                    {fn:'filterByPeriod(orders, period)', desc:"Filter to 'today'|'week'|'month'|'all'"},
                    {fn:'computeCustomerSavings(orders)', desc:'Total coupon savings across all completed orders'},
                    {fn:'formatINR(n)',                   desc:'₹1,29,999 — Indian locale'},
                    {fn:'formatINRCompact(n)',            desc:'₹1.3K · ₹1.5L · ₹2.1Cr'},
                    {fn:'formatRate(rate)',               desc:'0.18 → "18%"'},
                  ].map(row=>(
                    <div key={row.fn} className="flex items-start gap-3 p-3 rounded-lg"
                      style={{background:'rgba(255,255,255,.04)'}}>
                      <code className="text-sky-300 text-xs font-mono shrink-0 mt-0.5 leading-relaxed">{row.fn}</code>
                      <p className="text-white/60 text-xs leading-relaxed">{row.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── mini lookup used in the order list ──────────────────────────────────────
const SVC_MINI: Record<ServiceKey,{emoji:string;label:string}> = {
  water_tanker:  {emoji:'🚛',label:'Water Tanker'},
  ro_service:    {emoji:'💧',label:'RO Service'},
  plumbing:      {emoji:'🔧',label:'Plumbing'},
  borewell:      {emoji:'⛏️',label:'Borewell'},
  motor_pump:    {emoji:'⚙️',label:'Motor & Pump'},
  tank_cleaning: {emoji:'🪣',label:'Tank Cleaning'},
};