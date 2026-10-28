'use client';

/**
 * AuroWater — Pricing Engine Visualizer
 * src/app/pricing/visualizer/page.tsx   (internal tool: see layout.tsx for the production gate)
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  calculateOrderTotal, validateRevenueIntegrity, evaluateCoupon, computeRevenueStats,
  buildDailyRevenueSeries, filterByPeriod, computeCustomerSavings,
  formatINR, formatINRCompact, formatRate,
  SERVICE_LABELS, SERVICE_EMOJI, ALL_SERVICE_KEYS, CAN_PRICES, VOLUME_PLANS, planForQty,
  type ServiceKey, type PricingInput, type PriceBreakdown, type Coupon, type OrderForStats, type RevenueStats,
} from '@/lib/pricing';

/* ─── demo data (module scope: created once) ─── */
const DAY = 86_400_000;
const NOW = Date.now();
type SeedOrder = OrderForStats & { discountAmount?: number };
const o = (status: OrderForStats['status'], total: number, t: number, s: number, p: number, d: number, serviceKey: ServiceKey, discountAmount = 0): SeedOrder =>
  ({ status, total, technicianEarnings: t, supplierEarnings: s, platformRevenue: p, createdAt: NOW - d * DAY, serviceKey, discountAmount });
const SEED_ORDERS: SeedOrder[] = [
  o('COMPLETED', 449, 314, 45, 90, 0, 'water_tanker'),
  o('COMPLETED', 599, 419, 60, 120, 1, 'tank_cleaning', 50),
  o('IN_PROGRESS', 279, 195, 28, 56, 1, 'ro_service'),
  o('COMPLETED', 349, 244, 35, 70, 2, 'plumbing', 20),
  o('COMPLETED', 199, 139, 20, 40, 3, 'ro_service'),
  o('CANCELLED', 999, 0, 0, 0, 4, 'borewell'),
  o('COMPLETED', 849, 594, 85, 170, 5, 'motor_pump', 100),
  o('COMPLETED', 449, 314, 45, 90, 6, 'water_tanker'),
];

const DEMO_COUPONS: Coupon[] = [
  { code: 'FIRST50', type: 'flat', value: 50, minOrderTotal: 200, usageLimit: 1, usageCount: 0 },
  { code: 'WATER20', type: 'percent', value: 20, minOrderTotal: 300, maxDiscountCap: 100 },
  { code: 'EXPIRED', type: 'flat', value: 100, expiresAt: '2020-01-01' },
  { code: 'MAXED', type: 'flat', value: 75, usageLimit: 5, usageCount: 5 },
];

const DEFAULT_SETTINGS = {
  water_tanker: 350, ro_service: 149, plumbing: 199, borewell: 799, motor_pump: 549, tank_cleaning: 449,
  convenienceFee: 29, gstRate: 18, emergencySurcharge: 199,
  technicianCommissionRate: 70, supplierCommissionRate: 10,
};
type Settings = typeof DEFAULT_SETTINGS;
type Period = 'today' | 'week' | 'month' | 'all';
type Tab = 'playground' | 'batch' | 'revenue';

const SLIDERS: { k: keyof Settings; label: string; min: number; max: number; step: number; pct?: boolean }[] = [
  { k: 'convenienceFee', label: 'Convenience Fee (₹)', min: 0, max: 100, step: 1 },
  { k: 'gstRate', label: 'GST Rate (%)', min: 0, max: 28, step: 1, pct: true },
  { k: 'emergencySurcharge', label: 'Emergency (₹)', min: 0, max: 500, step: 10 },
  { k: 'technicianCommissionRate', label: 'Technician Cut (%)', min: 0, max: 90, step: 1, pct: true },
  { k: 'supplierCommissionRate', label: 'Supplier Cut (%)', min: 0, max: 30, step: 1, pct: true },
];

/* ─── small pieces ─── */
function Meter({ pct, color }: { pct: number; color: string }) {
  // inline style: dynamic Tailwind classes like bg-[${color}] are purged at build time
  return (
    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color, height: '100%', borderRadius: 999, transition: 'width .6s ease' }} />
    </div>
  );
}

function DonutSlice({ pct, offset, color }: { pct: number; offset: number; color: string }) {
  const circ = 2 * Math.PI * 45;
  const dash = (pct / 100) * circ;
  return (
    <circle cx="60" cy="60" r="45" fill="none" stroke={color} strokeWidth="14" strokeDasharray={`${dash} ${circ - dash}`}
      strokeLinecap="butt" style={{ transformOrigin: '60px 60px', transform: `rotate(${(offset / 100) * 360 - 90}deg)`, transition: 'stroke-dasharray .6s ease' }} />
  );
}

const Card = ({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) => (
  <div className={`glass rounded-2xl p-5 ${className}`}>
    {title && <p className="viz-display text-white font-bold text-sm mb-3 uppercase tracking-widest opacity-70">{title}</p>}
    {children}
  </div>
);

/* ─── page ─── */
export default function PricingVisualizerPage() {
  const [serviceKey, setServiceKey] = useState<ServiceKey>('water_tanker');
  const [emergency, setEmergency] = useState(false);
  const [canCount, setCanCount] = useState(10);
  const [canType, setCanType] = useState<'normal' | 'chilled'>('normal');
  const [monthlyCans, setMonthlyCans] = useState(30);
  const [preTax, setPreTax] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponMsg, setCouponMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [period, setPeriod] = useState<Period>('week');
  const [tab, setTab] = useState<Tab>('playground');
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const hydration = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(hydration);
  }, []);

  const isCan = serviceKey === 'water_tanker';
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
    canCount: isCan ? canCount : undefined,
    pricePerCan: isCan ? CAN_PRICES[canType] : undefined, // real can prices from the engine
    monthlyCanCount: isCan ? monthlyCans : undefined,
    commissionBasis: preTax ? 'preTax' : 'total',
  }), [serviceKey, emergency, canCount, canType, monthlyCans, preTax, settings, appliedCoupon, isCan]);

  const bd: PriceBreakdown = useMemo(() => calculateOrderTotal(input), [input]);
  const integrity = validateRevenueIntegrity(bd);
  const plan = planForQty(monthlyCans);

  const filtered = useMemo(() => filterByPeriod(SEED_ORDERS, period), [period]);
  const stats: RevenueStats = useMemo(() => computeRevenueStats(filtered), [filtered]);
  const daily = useMemo(() => buildDailyRevenueSeries(SEED_ORDERS), []);
  const savings = useMemo(() => computeCustomerSavings(SEED_ORDERS), []);
  const maxBar = useMemo(() => Math.max(1, ...daily.map(d => d.amount)), [daily]);

  const applyCoupon = useCallback(() => {
    const c = DEMO_COUPONS.find(x => x.code === couponCode.trim().toUpperCase());
    if (!c) { setAppliedCoupon(null); setCouponMsg({ text: 'Coupon not found. Try FIRST50 or WATER20.', ok: false }); return; }
    // Evaluate against the same subtotal the engine uses (after any volume plan)
    const base = isCan ? CAN_PRICES[canType] * canCount : settings[serviceKey];
    const subtotal = base - base * (isCan ? plan.off / 100 : 0) + settings.convenienceFee;
    const res = evaluateCoupon(c, subtotal);
    if (res.valid) { setAppliedCoupon(c); setCouponMsg({ text: res.message, ok: true }); }
    else { setAppliedCoupon(null); setCouponMsg({ text: res.error, ok: false }); }
  }, [couponCode, isCan, canType, canCount, plan.off, settings, serviceKey]);

  const legs = [
    { label: 'Technician', val: bd.technicianEarnings, color: '#0EA5E9', icon: '🔧', rate: settings.technicianCommissionRate },
    { label: 'Supplier', val: bd.supplierEarnings, color: '#F59E0B', icon: '🏭', rate: settings.supplierCommissionRate },
    { label: 'Platform', val: bd.platformRevenue, color: '#10B981', icon: '⚡', rate: Math.max(0, 100 - settings.technicianCommissionRate - settings.supplierCommissionRate) },
    ...(bd.gstPayable ? [{ label: 'GST payable', val: bd.gstPayable, color: '#A78BFA', icon: '🏛️', rate: settings.gstRate }] : []),
  ];
  const pctOf = (v: number) => (bd.total > 0 ? (v / bd.total) * 100 : 0);

  if (!mounted) return null;

  return (
    <>
      <style>{`
        .viz-root{font-family:'DM Sans',system-ui,sans-serif;background:linear-gradient(160deg,#0B2545 0%,#0c3460 40%,#164e63 100%);min-height:100vh}
        .viz-display{font-family:'Syne','DM Sans',system-ui,sans-serif}
        .glass{background:rgba(255,255,255,.05);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.1)}
        .glass-strong{background:rgba(255,255,255,.1);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.15)}
        .tab-pill{padding:8px 20px;border-radius:999px;font-size:13px;font-weight:600;cursor:pointer;border:0;transition:.2s}
        .tab-on{background:#0EA5E9;color:#fff;box-shadow:0 4px 16px rgba(14,165,233,.4)}
        .tab-off{background:rgba(255,255,255,.07);color:rgba(255,255,255,.6)}
        .tab-off:hover{background:rgba(255,255,255,.12);color:#fff}
        .svc-btn{border:1.5px solid rgba(255,255,255,.1);border-radius:14px;padding:12px 10px;cursor:pointer;text-align:center;background:rgba(255,255,255,.04);transition:.2s}
        .svc-btn:hover{border-color:#0EA5E9;background:rgba(14,165,233,.12)}
        .svc-on{border-color:#0EA5E9!important;background:rgba(14,165,233,.18)!important;box-shadow:0 0 0 3px rgba(14,165,233,.2)}
        .infield{background:rgba(255,255,255,.08);border:1.5px solid rgba(255,255,255,.12);border-radius:10px;padding:9px 14px;color:#fff;font-size:13px;font-weight:500;width:100%;outline:none}
        .infield:focus{border-color:#0EA5E9;box-shadow:0 0 0 3px rgba(14,165,233,.15)}
        .infield::placeholder{color:rgba(255,255,255,.35)}
        .line-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px dashed rgba(255,255,255,.07)}
        .line-row:last-child{border-bottom:0}
        .btn-wave{background:linear-gradient(135deg,#0EA5E9,#06B6D4);color:#fff;border:0;border-radius:10px;padding:10px 20px;font-weight:700;font-size:13px;cursor:pointer}
        .btn-ghost{background:rgba(255,255,255,.08);color:rgba(255,255,255,.8);border:1.5px solid rgba(255,255,255,.12);border-radius:10px;padding:9px 18px;font-weight:600;font-size:13px;cursor:pointer}
        .btn-ghost:hover{background:rgba(255,255,255,.14);color:#fff}
        .period-btn{padding:6px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;border:0}
        .period-on{background:#F59E0B;color:#1a1a1a}.period-off{background:rgba(255,255,255,.08);color:rgba(255,255,255,.55)}
        input[type=range]{-webkit-appearance:none;height:4px;border-radius:4px;background:rgba(255,255,255,.15);outline:none;width:100%}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:#0EA5E9;cursor:pointer}
        .btn-wave:focus-visible,.btn-ghost:focus-visible,.tab-pill:focus-visible,.svc-btn:focus-visible{outline:2px solid #7dd3fc;outline-offset:2px}
        @media(max-width:768px){.two-col{grid-template-columns:1fr!important}}
      `}</style>

      <div className="viz-root px-4 py-8 sm:px-6">
        <div className="max-w-5xl mx-auto mb-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl" style={{ background: 'linear-gradient(135deg,#0EA5E9,#06B6D4)' }}>💧</div>
                <span className="viz-display text-white font-bold text-xl">AuroWater</span>
              </div>
              <h1 className="viz-display text-3xl sm:text-4xl font-extrabold text-white">Pricing Engine</h1>
              <p className="text-sky-300 text-sm mt-1 font-medium">Interactive visualizer · Real-time calculations · Revenue integrity checks</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
              style={{ color: integrity ? '#10B981' : '#EF4444', background: integrity ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)', border: `1px solid ${integrity ? '#10B981' : '#EF4444'}` }}>
              {integrity ? '✓ Revenue Integrity OK' : '⚠ Integrity Mismatch'}
            </span>
          </div>
          <div className="flex gap-2 mt-6 flex-wrap" role="tablist">
            {([['playground', '⚡ Calculator'], ['batch', '📊 Batch Stats'], ['revenue', '💰 Revenue Split']] as [Tab, string][]).map(([k, label]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`tab-pill ${tab === k ? 'tab-on' : 'tab-off'}`}>{label}</button>
            ))}
          </div>
        </div>

        <div className="max-w-5xl mx-auto space-y-6">

          {/* ═══ PLAYGROUND ═══ */}
          {tab === 'playground' && (
            <div className="grid gap-6 two-col" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="space-y-5">
                <Card title="Service">
                  <div className="grid grid-cols-3 gap-2">
                    {ALL_SERVICE_KEYS.map(k => (
                      <button key={k} onClick={() => setServiceKey(k)} aria-pressed={serviceKey === k} className={`svc-btn ${serviceKey === k ? 'svc-on' : ''}`}>
                        <div className="text-2xl mb-1">{SERVICE_EMOJI[k]}</div>
                        <div className="text-white text-[10px] font-semibold leading-tight">{SERVICE_LABELS[k]}</div>
                        <div className="text-sky-300 text-[11px] font-bold mt-1">{k === 'water_tanker' ? `₹${CAN_PRICES.normal}/can` : `₹${settings[k]}`}</div>
                      </button>
                    ))}
                  </div>
                </Card>

                {isCan && (
                  <Card title="Can config" className="space-y-4">
                    <div className="flex gap-2">
                      {(['normal', 'chilled'] as const).map(t => (
                        <button key={t} onClick={() => setCanType(t)} aria-pressed={canType === t} className={`tab-pill ${canType === t ? 'tab-on' : 'tab-off'}`}>
                          {t === 'normal' ? `Normal ₹${CAN_PRICES.normal}` : `Chilled ₹${CAN_PRICES.chilled}`}
                        </button>
                      ))}
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-sky-300 mb-2"><span>Cans in this order</span><span className="font-bold text-white">{canCount}</span></div>
                      <input type="range" min={1} max={50} value={canCount} onChange={e => setCanCount(Number(e.target.value))} aria-label="Cans in this order" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-sky-300 mb-2"><span>Cans per month (sets plan)</span><span className="font-bold text-white">{monthlyCans}</span></div>
                      <input type="range" min={1} max={120} value={monthlyCans} onChange={e => setMonthlyCans(Number(e.target.value))} aria-label="Cans per month" />
                      <p className="text-xs text-emerald-400 mt-2">{plan.name}{plan.off ? ` · ${plan.off}% off` : ' · standard price'} <span className="text-sky-500">({VOLUME_PLANS.map(p => `${p.minCans}+→${p.off}%`).join(', ')})</span></p>
                    </div>
                  </Card>
                )}

                <Card title="Options" className="space-y-4">
                  {[
                    { label: 'Emergency booking', sub: `+₹${settings.emergencySurcharge} surcharge`, on: emergency, set: () => setEmergency(v => !v), onColor: 'bg-red-500' },
                    { label: 'Commission on pre-GST amount', sub: 'GST is held for remittance, not counted as revenue', on: preTax, set: () => setPreTax(v => !v), onColor: 'bg-emerald-500' },
                  ].map(t => (
                    <div key={t.label} className="flex items-center justify-between gap-3">
                      <div><p className="text-white font-semibold text-sm">{t.label}</p><p className="text-sky-400 text-xs">{t.sub}</p></div>
                      <button type="button" role="switch" aria-checked={t.on} aria-label={t.label} onClick={t.set}
                        className={`w-12 h-6 rounded-full relative transition-all shrink-0 ${t.on ? t.onColor : 'bg-white/15'}`}>
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${t.on ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                  ))}
                </Card>

                <Card title="Coupon code" className="space-y-3">
                  <div className="flex gap-2">
                    <input type="text" placeholder="FIRST50 · WATER20 · EXPIRED" value={couponCode} aria-label="Coupon code"
                      onChange={e => setCouponCode(e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === 'Enter') applyCoupon(); }} className="infield flex-1" />
                    <button onClick={applyCoupon} className="btn-wave whitespace-nowrap text-xs px-4">Apply</button>
                    {appliedCoupon && <button onClick={() => { setAppliedCoupon(null); setCouponMsg(null); setCouponCode(''); }} className="btn-ghost text-xs px-3" aria-label="Remove coupon">✕</button>}
                  </div>
                  {couponMsg && <p className={`text-xs font-semibold ${couponMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{couponMsg.ok ? '✓' : '✗'} {couponMsg.text}</p>}
                  <p className="text-sky-500 text-[11px]">Try: FIRST50 · WATER20 · EXPIRED · MAXED</p>
                </Card>

                <Card title="Settings" className="space-y-4">
                  {SLIDERS.map(s => (
                    <div key={s.k}>
                      <div className="flex justify-between text-xs text-sky-300 mb-1.5">
                        <span>{s.label}</span><span className="font-bold text-white">{s.pct ? `${settings[s.k]}%` : `₹${settings[s.k]}`}</span>
                      </div>
                      <input type="range" min={s.min} max={s.max} step={s.step} value={settings[s.k]} aria-label={s.label}
                        onChange={e => setSettings(prev => ({ ...prev, [s.k]: Number(e.target.value) }))} />
                    </div>
                  ))}
                  <button onClick={() => setSettings({ ...DEFAULT_SETTINGS })} className="btn-ghost text-xs w-full">Reset to defaults</button>
                </Card>
              </div>

              <div className="space-y-5">
                <div className="rounded-2xl p-6 text-center" style={{ background: 'linear-gradient(135deg,#0EA5E9,#06B6D4,#0891b2)' }}>
                  <p className="viz-display text-white/80 font-semibold text-xs uppercase tracking-widest mb-1">Customer pays</p>
                  <p className="viz-display text-white font-black text-5xl tracking-tight">{formatINR(bd.total)}</p>
                  <p className="text-white/70 text-sm mt-1">{SERVICE_EMOJI[bd.serviceKey]} {SERVICE_LABELS[bd.serviceKey]}{emergency ? ' · 🚨 Emergency' : ''}</p>
                  {(bd.discountAmount + (bd.volumeDiscount ?? 0)) > 0 && (
                    <div className="mt-2 inline-flex bg-white/20 rounded-full px-3 py-1 text-white text-xs font-bold">
                      🎉 Saved {formatINR(bd.discountAmount + (bd.volumeDiscount ?? 0))}{bd.appliedPlan ? ` · ${bd.appliedPlan}` : ''}{bd.appliedCoupon ? ` · ${bd.appliedCoupon}` : ''}
                    </div>
                  )}
                </div>

                <Card title="Price breakdown">
                  {bd.lines.map((line, i) => (
                    <div key={i} className="line-row">
                      <div><p className="text-white/90 text-sm font-medium">{line.label}</p>{line.note && <p className="text-sky-400 text-[11px]">{line.note}</p>}</div>
                      <p className={`viz-display font-bold text-sm ${line.sign === -1 ? 'text-emerald-400' : 'text-white'}`}>{line.sign === -1 ? '-' : ''}{formatINR(line.amount)}</p>
                    </div>
                  ))}
                  <div className="mt-3 pt-3 flex justify-between" style={{ borderTop: '2px solid rgba(255,255,255,.15)' }}>
                    <p className="viz-display text-white font-black">Total</p><p className="viz-display text-white font-black text-xl">{formatINR(bd.total)}</p>
                  </div>
                </Card>

                <Card title="Revenue split">
                  <div className="flex items-center gap-6">
                    <div className="shrink-0 relative">
                      <svg viewBox="0 0 120 120" className="w-28 h-28" role="img" aria-label="Revenue split chart">
                        <circle cx="60" cy="60" r="45" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="14" />
                        {legs.reduce<{ el: React.ReactNode[]; off: number }>((acc, l) => {
                          const p = pctOf(l.val);
                          acc.el.push(<DonutSlice key={l.label} pct={p} offset={acc.off} color={l.color} />);
                          acc.off += p; return acc;
                        }, { el: [], off: 0 }).el}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-white/60 text-[10px] font-semibold">TOTAL</p><p className="viz-display text-white font-bold text-sm">{formatINR(bd.total)}</p>
                      </div>
                    </div>
                    <div className="flex-1 space-y-3">
                      {legs.map(l => (
                        <div key={l.label}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-white/80 font-semibold flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ background: l.color }} />{l.label}</span>
                            <span className="text-white font-bold">{formatINR(l.val)} <span className="text-white/50 font-normal">({pctOf(l.val).toFixed(1)}%)</span></span>
                          </div>
                          <Meter pct={pctOf(l.val)} color={l.color} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold border ${integrity ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                    <span className="text-base">{integrity ? '✓' : '⚠'}</span>
                    {integrity ? `Revenue integrity verified: all legs sum to ${formatINR(bd.total)}` : 'Revenue integrity failed: legs do not sum to total'}
                  </div>
                </Card>

                <Card title="Earning detail">
                  <div className={`grid gap-3 ${legs.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                    {legs.map(l => (
                      <div key={l.label} className="rounded-xl p-3 text-center" style={{ background: `${l.color}18`, border: `1px solid ${l.color}30` }}>
                        <div className="text-xl mb-1">{l.icon}</div>
                        <p className="viz-display font-black text-white text-lg">{formatINR(l.val)}</p>
                        <p className="text-white/60 text-[10px] font-semibold">{l.label}</p>
                        <p className="font-bold text-[11px] mt-0.5" style={{ color: l.color }}>{l.rate.toFixed(0)}%</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* ═══ BATCH ═══ */}
          {tab === 'batch' && (
            <div className="space-y-5">
              <Card>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <p className="viz-display text-white font-bold text-sm uppercase tracking-widest opacity-70">Period filter</p>
                  <div className="flex gap-2">
                    {(['today', 'week', 'month', 'all'] as Period[]).map(p => (
                      <button key={p} onClick={() => setPeriod(p)} aria-pressed={period === p} className={`period-btn ${period === p ? 'period-on' : 'period-off'}`}>{p[0].toUpperCase() + p.slice(1)}</button>
                    ))}
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Gross Revenue', val: formatINR(stats.grossRevenue), sub: `${stats.completedOrders} completed`, color: '#0EA5E9' },
                  { label: 'Platform Revenue', val: formatINR(stats.platformNetRevenue), sub: `${formatRate(stats.completionRate)} completion`, color: '#10B981' },
                  { label: 'Tech Payouts', val: formatINR(stats.technicianPayouts), sub: `Avg ${formatINR(stats.averageOrderValue)}/order`, color: '#F59E0B' },
                  { label: 'Customer Savings', val: formatINR(savings), sub: `From ${SEED_ORDERS.filter(x => x.discountAmount).length} coupons`, color: '#A78BFA' },
                ].map(s => (
                  <Card key={s.label}>
                    <p className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-2">{s.label}</p>
                    <p className="viz-display font-black text-2xl" style={{ color: s.color }}>{s.val}</p>
                    <p className="text-white/40 text-xs mt-1">{s.sub}</p>
                  </Card>
                ))}
              </div>

              <Card title="Last 7 days revenue">
                <div className="flex items-end gap-3 h-36">
                  {daily.map((d, i) => {
                    const pct = (d.amount / maxBar) * 100;
                    return (
                      <div key={d.date} className="flex-1 h-full flex flex-col justify-end items-center gap-2">
                        <p className="text-white/60 text-[10px] font-semibold">{d.amount > 0 ? formatINRCompact(d.amount) : ''}</p>
                        <div className="w-full rounded-t-lg transition-all duration-700" style={{ height: `${Math.max(4, pct * 0.8)}%`, background: i === 6 ? 'linear-gradient(to top,#0EA5E9,#38BDF8)' : 'rgba(255,255,255,.12)' }} />
                        <p className={`text-[10px] font-bold ${i === 6 ? 'text-sky-400' : 'text-white/50'}`}>{d.label}</p>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card title="Revenue by service">
                <div className="space-y-3">
                  {ALL_SERVICE_KEYS.map(k => {
                    const row = stats.byService[k];
                    return (
                      <div key={k}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-white/80 font-semibold">{SERVICE_EMOJI[k]} {SERVICE_LABELS[k]}</span>
                          <span className="text-white font-bold">{formatINR(row.revenue)} <span className="text-white/40 font-normal">· {row.count} orders</span></span>
                        </div>
                        <Meter pct={stats.grossRevenue > 0 ? (row.revenue / stats.grossRevenue) * 100 : 0} color="linear-gradient(to right,#0EA5E9,#06B6D4)" />
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card title="Order detail">
                <div className="space-y-2">
                  {filtered.length === 0 && <p className="text-white/50 text-sm">No orders in this period.</p>}
                  {filtered.map((x, i) => {
                    const sc = x.status === 'COMPLETED' ? '#10B981' : x.status === 'CANCELLED' ? '#EF4444' : '#F59E0B';
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: 'rgba(255,255,255,.07)' }}>{SERVICE_EMOJI[x.serviceKey]}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-sm truncate">{SERVICE_LABELS[x.serviceKey]}</p>
                          <p className="text-white/40 text-xs">{new Date(x.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="viz-display text-white font-bold text-sm">{formatINR(x.total)}</p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${sc}22`, color: sc }}>{x.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

          {/* ═══ REVENUE MODEL ═══ */}
          {tab === 'revenue' && (
            <div className="space-y-5">
              <Card title="Revenue integrity model"><p className="text-sky-400 text-xs">Every rupee in every order is accounted for.</p></Card>
              <div className="glass-strong rounded-2xl p-6">
                <p className="viz-display text-white font-bold text-sm mb-4">The formula</p>
                <div className="rounded-xl p-4 text-sm font-mono overflow-x-auto" style={{ background: 'rgba(0,0,0,.3)', border: '1px solid rgba(14,165,233,.2)' }}>
                  <p className="text-sky-300">Formula: (Base − Plan − Coupon + Convenience) × (1 + GST) + Emergency</p>
                  <p className="text-white mt-2">total = (base − planDisc + convFee − coupon) × (1 + gstRate) + emg</p>
                  <p className="text-sky-300 mt-4">Split base: total (default) or total − GST (pre-GST mode)</p>
                  <p className="text-yellow-300 mt-1">tech = splitBase × techRate</p>
                  <p className="text-amber-300">supp = splitBase × supplierRate</p>
                  <p className="text-emerald-300">platform = splitBase − tech − supp</p>
                  <p className="text-sky-300 mt-4">Always true</p>
                  <p className="text-white">tech + supp + platform + gstPayable === total</p>
                </div>
              </div>
              <Card title="Live proof: current order">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[{ label: 'Customer total', val: bd.total, color: '#0EA5E9' }, ...legs.map(l => ({ label: l.label, val: l.val, color: l.color }))].slice(0, 5).map(r => (
                    <div key={r.label} className="rounded-xl p-4 text-center" style={{ background: `${r.color}14`, border: `1px solid ${r.color}25` }}>
                      <p className="viz-display font-black text-xl" style={{ color: r.color }}>{formatINR(r.val)}</p>
                      <p className="text-white/60 text-[11px] mt-1 font-semibold">{r.label}</p>
                    </div>
                  ))}
                </div>
                <div className={`rounded-xl px-4 py-3 text-sm font-bold border ${integrity ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-red-500/10 border-red-500/25 text-red-400'}`}>
                  {integrity ? '✓ Revenue integrity verified' : '✗ Integrity check failed'}
                  <p className="font-normal opacity-75 text-xs mt-1">{legs.map(l => formatINR(l.val)).join(' + ')} = {formatINR(legs.reduce((s, l) => s + l.val, 0))} {integrity ? `(= ${formatINR(bd.total)})` : `(≠ ${formatINR(bd.total)})`}</p>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
