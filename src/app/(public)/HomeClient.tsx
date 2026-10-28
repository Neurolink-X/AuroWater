'use client';

import Link from 'next/link';
import Image from 'next/image';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TRUST_REVIEWS } from '@/lib/trust-reviews';
import { PRICING, ORDER_FEES, FAQS, CITIES, LIVE_CITIES, PIN_CITIES, LIVE_CITY_NAMES, planForQty } from '@/lib/marketing-pricing';

/* ───────── DATA ───────── */
const W = PRICING.water;
const minimumCanPrice = (type: 'normal' | 'chilled', off: number) =>
  Math.max(type === 'normal' ? 20 : 25, W[type] * (1 - off / 100));

const SERVICES = [
  { icon: '💧', title: 'RO Water Delivery', badge: `From ₹${W.normal} / 20L`,
    body: `Normal RO ₹${W.normal} or Chilled RO ₹${W.chilled} per 20L can, delivered to your door. Choose a convenient repeat schedule with protected minimum prices.`,
    cta: 'Order Water', href: '/book?service=water_can',
    features: ['Normal & chilled', 'Family and bulk scheduling', 'Price shown before confirming'], accent: '#0ea5e9' },
  { icon: '🔧', title: 'Plumber Service', badge: `Visit ₹${PRICING.plumber.visitFee}`,
    body: `Leaking taps, fittings, pipe repairs and water-system jobs. The ₹${PRICING.plumber.visitFee} visit charge is adjusted against your bill if you go ahead.`,
    cta: 'Book a Plumber', href: '/book?service=plumbing',
    features: ['Visit fee adjusted in bill', 'Describe your problem', 'Area availability checked'], accent: '#6366f1' },
  { icon: '🧽', title: 'Tank Cleaning', badge: `From ₹${PRICING.tank[0].from}`,
    body: 'Scheduled overhead and underground water tank cleaning for homes, societies and offices. Price by tank size, confirmed before work begins.',
    cta: 'Book Tank Cleaning', href: '/book?service=tank_cleaning',
    features: ['Priced by tank size', 'Homes, offices & societies', 'Repeat-clean reminders'], accent: '#f59e0b' },
  { icon: '🚚', title: 'Event & Office Water', badge: 'Bulk Enquiries',
    body: 'Weddings, parties, offices, sites: share quantity, schedule and location and we confirm what is available.',
    cta: 'Request a Quote', href: '/contact',
    features: ['Normal or chilled', 'Quantity-based pricing', 'Availability confirmed first'], accent: '#10b981' },
] as const;

const WHY = [
  { icon: '💰', t: 'Price before you pay', d: 'Review the full order total before confirming. No surprise add-ons.', c: '#10b981' },
  { icon: '📦', t: 'Family & bulk plans', d: 'Convenient repeat scheduling with normal RO from ₹20 and chilled RO from ₹25 per can.', c: '#0ea5e9' },
  { icon: '✅', t: 'Verified partners', d: 'Suppliers and technicians go through verification before they receive jobs.', c: '#8b5cf6' },
  { icon: '📱', t: 'Order updates', d: 'Follow your booking status from request to completion.', c: '#f59e0b' },
] as const;

const ROLES = [
  { icon: '💧', title: 'I need water, plumber or tank cleaning', href: '/auth/register', cta: 'Sign Up Free →',
    perks: ['30-second signup', 'No documents needed', 'Order immediately'], g: 'from-sky-500 to-cyan-400' },
  { icon: '🚛', title: 'I supply water', href: '/register/pro?type=supplier', cta: 'Apply as Supplier →',
    perks: ['KYC verification', 'Admin approval', 'Receive orders once approved'], g: 'from-emerald-500 to-teal-400' },
  { icon: '🔧', title: "I'm a plumber / tank cleaner", href: '/register/pro?type=technician', cta: 'Apply as Technician →',
    perks: ['Skill verification', 'Background check', 'Work on your schedule'], g: 'from-violet-500 to-purple-400' },
] as const;

const SERVE = ['👨‍🎓 Students & PG', '🏠 Homeowners', '🏢 Offices', '🎪 Weddings & Events', '🍽️ Restaurants', '🏗️ Construction', '🏫 Schools', '🏘️ Societies'] as const;

const STEPS = [
  { icon: '📱', t: 'Order in 30 seconds', b: 'Pick water, plumber or tank cleaning, add your address and choose a slot.' },
  { icon: '🚚', t: 'We assign a partner', b: 'An eligible supplier or technician is assigned by area, approval and availability.' },
  { icon: '✅', t: 'Done. Pay easily', b: 'Follow status updates, pay by the methods shown for your booking, then rate the service.' },
] as const;

const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

/* ───────── SMALL COMPONENTS ───────── */
const Wave = React.memo(function Wave({ flip = false, color = '#f8fafc' }: { flip?: boolean; color?: string }) {
  return (
    <div className="w-full overflow-hidden leading-none pointer-events-none" style={{ transform: flip ? 'rotate(180deg)' : undefined, marginBottom: -2 }} aria-hidden="true">
      <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="w-full h-10 sm:h-14" style={{ display: 'block' }}>
        <path d="M0,40 C200,80 400,0 600,40 C800,80 1000,0 1200,40 C1300,64 1380,20 1440,40 L1440,80 L0,80 Z" fill={color} />
      </svg>
    </div>
  );
});

const ReviewCard = React.memo(function ReviewCard({ r }: { r: (typeof TRUST_REVIEWS)[number] }) {
  return (
    <div className="aw-review flex-shrink-0 min-w-[292px] max-w-[316px] rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${r.color} text-white flex items-center justify-center font-bold text-xs`}>{r.initials}</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-900 text-sm truncate">{r.name}</div>
          <div className="text-xs text-slate-400">{r.city} · {r.date}</div>
        </div>
        <div className="flex gap-px">{Array.from({ length: 5 }).map((_, i) => <span key={i} className={i < r.rating ? 'text-amber-400' : 'text-slate-200'} style={{ fontSize: 11 }}>★</span>)}</div>
      </div>
      <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100 mb-2">{r.service}</span>
      <p className="text-sm text-slate-600 leading-relaxed italic">“{r.text}”</p>
    </div>
  );
});

/* ───────── PRICING + SAVINGS CALCULATOR ───────── */
function PricingSection() {
  const [type, setType] = useState<'normal' | 'chilled'>('normal');
  const [current, setCurrent] = useState('');
  const [qtyStr, setQtyStr] = useState('30');

  const qty = Number(qtyStr);
  const cur = Number(current);
  const qtyOk = Number.isFinite(qty) && qty >= 1 && qty <= 1000;
  const curOk = current.trim() !== '' && Number.isFinite(cur) && cur > 0;
  const base = W[type];
  const plan = planForQty(qtyOk ? qty : 1);
  const canPrice = minimumCanPrice(type, plan.off);
  const feeMonthly = ORDER_FEES.perDelivery * ORDER_FEES.assumedDeliveriesPerMonth;
  const monthly = canPrice * (qtyOk ? qty : 0) + (qtyOk ? feeMonthly : 0);
  const eff = qtyOk ? monthly / qty : canPrice; // per-can price INCLUDING order fees, so savings are never overstated
  const diff = curOk && qtyOk ? (cur - eff) * qty : 0;
  const pct = curOk ? ((cur - eff) / cur) * 100 : 0;

  return (
    <section id="pricing" className="bg-slate-50 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-10">
          <span className="aw-badge aw-badge-dk">Simple, honest pricing</span>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900">Normal RO ₹{W.normal} · Chilled RO ₹{W.chilled} per 20L can.</h2>
          <p className="mt-3 text-slate-600 max-w-2xl mx-auto">Clear upfront prices for water, plumbing and tank cleaning. Family and bulk plans offer convenient scheduling while protecting minimum per-can rates.</p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {PRICING.plans.map(p => {
            const best = p.id === 'family';
            return (
              <div key={p.id} className={`relative rounded-3xl bg-white p-6 border ${best ? 'border-sky-400 shadow-lg ring-2 ring-sky-100' : 'border-slate-100 shadow-sm'}`}>
                {best && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-sky-600 text-white text-[11px] font-bold px-3 py-1">Most popular</span>}
                <h3 className="font-display font-extrabold text-slate-900">{p.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{p.note}</p>
                <p className="mt-4 text-3xl font-extrabold text-slate-900">₹{fmt(minimumCanPrice('normal', p.off))}<span className="text-sm font-medium text-slate-400"> / can</span></p>
                <p className="text-xs text-slate-500">Chilled ₹{fmt(minimumCanPrice('chilled', p.off))}</p>
                <p className={`mt-3 text-sm font-bold ${p.off ? 'text-emerald-600' : 'text-slate-400'}`}>{minimumCanPrice('normal', p.off) < W.normal || minimumCanPrice('chilled', p.off) < W.chilled ? 'Volume rate available above minimum' : 'Minimum price protected'}</p>
              </div>
            );
          })}
        </div>

        {/* Calculator */}
        <div className="rounded-3xl bg-slate-900 text-white p-6 sm:p-8 grid lg:grid-cols-2 gap-8">
          <div>
            <h3 className="font-display text-xl font-extrabold">Savings calculator</h3>
            <p className="text-sm text-slate-400 mt-1">Enter what you pay today. We compare it with your AuroWater plan price. Nothing is assumed about other suppliers.</p>
            <div className="mt-5 flex gap-2" role="group" aria-label="Water type">
              {(['normal', 'chilled'] as const).map(t => (
                <button key={t} type="button" onClick={() => setType(t)} aria-pressed={type === t}
                  className={`aw-tab ${type === t ? 'active' : ''}`}>{t === 'normal' ? 'Normal RO' : 'Chilled RO'}</button>
              ))}
            </div>
            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              <label className="text-xs font-medium text-slate-300">Your current price per 20L can (₹)
                <input type="number" min="0" step="0.5" inputMode="decimal" value={current} onChange={e => setCurrent(e.target.value)} placeholder="e.g. 40"
                  className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300/20" />
              </label>
              <label className="text-xs font-medium text-slate-300">Cans per month
                <input type="number" min="1" max="1000" inputMode="numeric" value={qtyStr} onChange={e => setQtyStr(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300/20" />
              </label>
            </div>
            {!qtyOk && <p className="mt-3 text-xs text-amber-300">Enter between 1 and 1,000 cans.</p>}
          </div>

          <div aria-live="polite" className="rounded-2xl bg-white/[0.05] border border-white/10 p-5 flex flex-col justify-center">
            <p className="text-xs text-slate-400">Your plan: <strong className="text-white">{plan.name}</strong> · minimum price protected</p>
            <p className="mt-1 text-3xl font-extrabold">₹{fmt(eff)} <span className="text-sm font-medium text-slate-400">per can</span></p>
            <p className="text-sm text-slate-300">≈ ₹{fmt(monthly)} / month for {qtyOk ? qty : 0} cans</p>
            {feeMonthly > 0 && <p className="text-xs text-slate-400">Includes about ₹{fmt(feeMonthly)} / month in delivery fees ({ORDER_FEES.assumedDeliveriesPerMonth} deliveries).</p>}
            {curOk && qtyOk && (
              <div className="mt-4 border-t border-white/10 pt-4">
                {diff > 0 ? (
                  <>
                    <p className="text-4xl font-extrabold text-emerald-300">{pct.toFixed(0)}% cheaper</p>
                    <p className="text-sm text-emerald-200 mt-1">Save ₹{fmt(diff)} / month · ₹{fmt(diff * 12)} / year</p>
                  </>
                ) : diff < 0 ? (
                  <p className="text-sm text-amber-200">At this price you pay ₹{fmt(-diff)} less per month today. Compare water quality, reliability and delivery before deciding.</p>
                ) : (
                  <p className="text-sm text-slate-200">Same price. Compare quality, reliability and delivery.</p>
                )}
              </div>
            )}
            <Link href={`/book?service=water_can&type=${type}`} className="aw-btn mt-5 px-6 py-3 text-sm justify-center">Start this plan →</Link>
          </div>
        </div>

        {/* Tank + plumber */}
        <div className="grid md:grid-cols-2 gap-5 mt-8">
          <div className="rounded-3xl bg-white border border-slate-100 p-6 shadow-sm">
            <h3 className="font-display font-extrabold text-slate-900">🧽 Tank cleaning</h3>
            <ul className="mt-3 divide-y divide-slate-100">
              {PRICING.tank.map(t => (
                <li key={t.size} className="flex justify-between py-2.5 text-sm"><span className="text-slate-600">{t.size}</span><span className="font-bold text-slate-900">from ₹{fmt(t.from)}</span></li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">Larger or heavily soiled tanks are quoted before work starts.</p>
            <Link href="/book?service=tank_cleaning" className="mt-4 inline-block text-sm font-bold text-sky-700 hover:underline">Book tank cleaning →</Link>
          </div>
          <div className="rounded-3xl bg-white border border-slate-100 p-6 shadow-sm">
            <h3 className="font-display font-extrabold text-slate-900">🔧 Plumber</h3>
            <p className="mt-3 text-3xl font-extrabold text-slate-900">₹{PRICING.plumber.visitFee}<span className="text-sm font-medium text-slate-400"> visit charge</span></p>
            <p className="mt-2 text-sm text-slate-600">{PRICING.plumber.adjustedAgainstJob ? 'Adjusted against the repair bill if you go ahead.' : ''} You see the price before you confirm.</p>
            <Link href="/book?service=plumbing" className="mt-4 inline-block text-sm font-bold text-sky-700 hover:underline">Book a plumber →</Link>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">Plan prices are per can. Any delivery or convenience fee and GST are shown at checkout before you confirm. Delivery is confirmed for your address at booking. Savings shown are against the price you enter, not an assumed competitor price.</p>
      </div>
    </section>
  );
}

/* ───────── PAGE ───────── */
export default function HomeClient() {
  const [founding, setFounding] = useState<{ count: number } | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [svc, setSvc] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    document.documentElement.style.setProperty('--footer-prev-bg', '#08111F');
    return () => document.documentElement.style.setProperty('--footer-prev-bg', '#ffffff');
  }, []);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const res = await fetch('/api/founding-members', { cache: 'no-store' });
        const json = (await res.json()) as { success: boolean; data: { count: number } };
        if (!off && json?.success) setFounding(json.data);
      } catch { /* silent */ }
    })();
    return () => { off = true; };
  }, []);

  const claimed = Math.min(founding?.count ?? 0, 100);
  const left = useMemo(() => [...TRUST_REVIEWS, ...TRUST_REVIEWS], []);
  const right = useMemo(() => [...TRUST_REVIEWS].reverse().concat([...TRUST_REVIEWS].reverse()), []);

  const submit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMsg(null);
    if (!name.trim() || !phone.trim()) { setMsg('Please enter your name and phone.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/founding-members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), phone: phone.trim() }) });
      const json = (await res.json()) as { success: boolean; error?: string; message?: string };
      if (!res.ok || !json?.success) setMsg(json?.error ?? 'Could not save. Please try again.');
      else { setMsg(json?.message ?? "Welcome! 🎉 We'll confirm your spot by WhatsApp."); setName(''); setPhone(''); setFounding(p => ({ count: (p?.count ?? 0) + 1 })); }
    } catch { setMsg('Network error. Please try again.'); }
    finally { setBusy(false); }
  }, [name, phone]);

  const s = SERVICES[svc];

  return (
    <>
      <style>{`
        :root{--navy:#020c18;--font-display:'Bricolage Grotesque','Syne',system-ui,sans-serif;--font-body:'DM Sans',system-ui,sans-serif;--fd:var(--font-display);--glass:rgba(7,30,52,.65);--glass-b:rgba(14,165,233,.16)}
        *,*::before,*::after{box-sizing:border-box}
        body{font-family:var(--font-body);background:var(--navy);overflow-x:hidden}
        .font-display{font-family:var(--font-display)}
        .hero-h{font-family:var(--font-display);font-weight:800;font-size:clamp(2.1rem,5.2vw,4.4rem);line-height:1.07;letter-spacing:-.5px;color:#fff;padding-block:.04em}
        .hero-hi{font-family:'Noto Sans Devanagari',system-ui,sans-serif;font-weight:700;font-size:clamp(1.8rem,5vw,3.4rem);line-height:1.35;color:#fff}
        .hero-acc{color:#60A5FA}
        .hero-sub{font-size:clamp(.95rem,1.8vw,1.15rem);line-height:1.65;color:rgba(255,255,255,.66);max-width:34rem}
        .hero-eyebrow{display:inline-flex;align-items:center;gap:7px;padding:5px 14px;border-radius:99px;background:rgba(96,165,250,.12);border:1px solid rgba(96,165,250,.28);font-size:11px;font-weight:700;color:#93C5FD;margin-bottom:18px}
        @keyframes aw-grad{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        @keyframes aw-mql{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes aw-mqr{from{transform:translateX(-50%)}to{transform:translateX(0)}}
        @keyframes aw-dot{0%,100%{opacity:1}50%{opacity:.45}}
        .aw-btn{background:linear-gradient(135deg,#0284c7,#0ea5e9 40%,#22d3ee);background-size:200% 200%;animation:aw-grad 3s ease infinite;color:#fff;font-family:var(--fd);font-weight:700;border-radius:999px;border:0;cursor:pointer;display:inline-flex;align-items:center;gap:8px;text-decoration:none;box-shadow:0 10px 30px rgba(14,165,233,.32);transition:transform .18s,box-shadow .18s}
        .aw-btn:hover{transform:translateY(-2px);box-shadow:0 16px 36px rgba(14,165,233,.5)}
        .aw-btn:disabled{opacity:.58;cursor:not-allowed;animation:none}
        .aw-btn-ol{display:inline-flex;align-items:center;gap:8px;text-decoration:none;border:1.5px solid rgba(14,165,233,.38);color:#bae6fd;font-family:var(--fd);font-weight:600;border-radius:999px;background:rgba(14,165,233,.07);transition:background .18s}
        .aw-btn-ol:hover{background:rgba(14,165,233,.16)}
        .aw-btn:focus-visible,.aw-btn-ol:focus-visible,.aw-tab:focus-visible{outline:2px solid #7dd3fc;outline-offset:3px}
        .aw-glass{background:var(--glass);backdrop-filter:blur(24px);border:1px solid var(--glass-b);border-radius:20px}
        .aw-glass-light{background:rgba(255,255,255,.93);border:1px solid rgba(14,165,233,.18)}
        .aw-badge{display:inline-block;font-family:var(--fd);font-size:.7rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#38bdf8;background:rgba(14,165,233,.1);border:1px solid rgba(14,165,233,.28);border-radius:999px;padding:4px 14px;margin-bottom:14px}
        .aw-badge-dk{color:#0369a1;background:rgba(14,165,233,.08);border-color:rgba(14,165,233,.22)}
        .aw-tab{border:1.5px solid rgba(14,165,233,.3);color:#93c5fd;border-radius:999px;font-family:var(--fd);font-weight:600;font-size:.8rem;padding:8px 18px;cursor:pointer;background:transparent;white-space:nowrap;transition:all .2s}
        .aw-tab:hover{background:rgba(14,165,233,.1)}
        .aw-tab.active{background:linear-gradient(135deg,#0284c7,#0ea5e9);border-color:transparent;color:#fff}
        .aw-input{background:#fff;border:1.5px solid #e2e8f0;border-radius:14px;padding:12px 16px;font-size:.875rem;color:#0f172a;width:100%;outline:none}
        .aw-input:focus{border-color:#0ea5e9;box-shadow:0 0 0 3px rgba(14,165,233,.15)}
        .aw-hero-bg{background:radial-gradient(ellipse 85% 65% at 18% 18%,rgba(14,165,233,.22),transparent 68%),radial-gradient(ellipse 65% 55% at 82% 72%,rgba(6,182,212,.17),transparent 68%),linear-gradient(165deg,#020c18,#041424 55%,#020c18)}
        .aw-dots{background-image:radial-gradient(circle,#38bdf8 1px,transparent 1px);background-size:48px 48px}
        .aw-live{width:8px;height:8px;border-radius:50%;background:#4ade80;animation:aw-dot 2s ease-in-out infinite}
        .aw-mql{animation:aw-mql 42s linear infinite}.aw-mqr{animation:aw-mqr 48s linear infinite}
        .aw-mql:hover,.aw-mqr:hover{animation-play-state:paused}
        .aw-prog{background:linear-gradient(90deg,#0284c7,#22d3ee,#10b981)}
        @media(prefers-reduced-motion:reduce){.aw-mql,.aw-mqr,.aw-btn,.aw-live{animation:none}}
      `}</style>

      <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--navy)' }}>

        {/* ═══ HERO ═══ */}
        <section className="aw-hero-bg relative min-h-screen flex flex-col overflow-x-hidden">
          <div className="absolute inset-0 pointer-events-none aw-dots" style={{ opacity: 0.028 }} aria-hidden="true" />
          <div className="relative z-10 flex-1 flex items-center">
            <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-20 w-full">
              <div className="grid grid-cols-1 lg:grid-cols-[1.1fr,1fr] gap-12 items-center">

                <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
                  <div className="hero-eyebrow"><span className="aw-live" aria-hidden="true" />Live in Kanpur, Lucknow &amp; Gorakhpur · Delhi NCR &amp; Agra on select PIN codes</div>
                  <h1 className="mb-6">
                    <span className="hero-hi block">शुद्ध पानी। <span className="hero-acc">सीधे आपके दरवाज़े तक।</span></span>
                    <span className="hero-h block mt-2">RO Water from ₹{W.normal},</span>
                    <span className="hero-h block mt-1 hero-acc">Plumber &amp; Tank Cleaning too.</span>
                  </h1>
                  <p className="hero-sub mb-8">
                    Order 20L RO cans, book a plumber or schedule water tank cleaning. See the price before you confirm, and choose a convenient repeat schedule with protected minimum prices.
                  </p>
                  <div className="flex flex-wrap gap-3 mb-8">
                    <Link href="/book?service=water_can" className="aw-btn px-7 py-3.5 text-sm sm:text-base">💧 Order Water</Link>
                    <Link href="/book?service=plumbing" className="aw-btn-ol px-6 py-3.5 text-sm sm:text-base">🔧 Book Plumber</Link>
                    <Link href="/book?service=tank_cleaning" className="aw-btn-ol px-6 py-3.5 text-sm sm:text-base">🧽 Clean My Tank</Link>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      [`₹${W.normal}`, 'Normal RO · 20L'],
                      [`₹${W.chilled}`, 'Chilled RO · 20L'],
                      ['₹20 / ₹25', 'Minimum normal / chilled price'],
                      [`₹${PRICING.tank[0].from}`, 'Tank cleaning from'],
                    ].map(([v, l]) => (
                      <div key={l} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                        <div className="text-xl font-black text-white">{v}</div>
                        <div className="mt-1 text-xs text-slate-300">{l}</div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-slate-400">Cash + UPI where available · Hindi &amp; English support</p>
                </motion.div>

                <motion.div className="flex flex-col gap-4" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15, duration: 0.7 }}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { src: 'https://images.unsplash.com/photo-1739528660620-89a665b3a4db?auto=format&fit=crop&w=1000&q=80', alt: 'Clean 20 litre RO drinking water dispenser for home delivery', tag: '20L RO cans', priority: true },
                      { src: '/Friendly Kitchen Water Service Team.png', alt: 'AuroWater delivery team handing over a 20 litre water can', tag: 'Doorstep delivery', priority: false },
                      { src: '/mentinence image.png', alt: 'Plumber repairing pipes and cleaning a water tank', tag: 'Plumbing & tanks', priority: false },
                    ].map(im => (
                      <figure key={im.tag} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                        <div className="relative aspect-[4/3] w-full">
                          <Image src={im.src} alt={im.alt} fill priority={im.priority} sizes="(max-width:640px) 100vw, 18vw" className="object-cover" />
                        </div>
                        <figcaption className="px-3 py-2 text-xs font-semibold text-white">{im.tag}</figcaption>
                      </figure>
                    ))}
                  </div>

                  <div className="aw-glass p-5">
                    <p className="font-display text-sm font-bold text-emerald-300 mb-3">Why customers switch</p>
                    <ul className="space-y-2.5">
                      {[`Pay ₹${W.normal} per 20L can, ₹${W.chilled} for chilled`, 'Family and bulk scheduling with price floors', `Plumber visit ₹${PRICING.plumber.visitFee}, adjusted in your bill`, `Tank cleaning priced by size from ₹${PRICING.tank[0].from}`].map(i => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-sky-100/80"><span className="text-sky-400 text-xs mt-1">◆</span>{i}</li>
                      ))}
                    </ul>
                    <Link href="#pricing" className="mt-4 inline-block text-sm font-bold text-sky-300 hover:underline">Calculate your savings →</Link>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
          <div className="relative z-10"><Wave color="#f8fafc" /></div>
        </section>

        {/* ═══ TRUST STRIP ═══ */}
        <section className="bg-slate-50 py-4 border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-5 flex flex-wrap justify-center gap-x-7 gap-y-2 text-xs sm:text-sm text-slate-600 font-semibold">
            {['💧 Water + plumbing + tank cleaning', '💳 Cash + UPI', '🧾 Clear order totals', '🗓️ Recurring delivery', '📍 Kanpur · Lucknow · Gorakhpur + Delhi NCR · Agra (select PINs)'].map(b => <span key={b}>{b}</span>)}
          </div>
        </section>

        <PricingSection />

        {/* ═══ SERVICES ═══ */}
        <div className="bg-slate-50"><Wave flip color="var(--navy)" /></div>
        <section id="services" className="py-16 sm:py-20 relative overflow-hidden" style={{ background: 'var(--navy)' }}>
          <div className="relative max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
            <div className="text-center mb-10">
              <span className="aw-badge">What we offer</span>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white">Water first. Plumbing and tank care when you need them.</h2>
            </div>
            <div className="flex justify-center gap-2 flex-wrap mb-8" role="tablist">
              {SERVICES.map((x, i) => (
                <button key={x.title} type="button" role="tab" aria-selected={svc === i} onClick={() => setSvc(i)} className={`aw-tab ${svc === i ? 'active' : ''}`}>{x.icon} {x.title}</button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={svc} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }} className="aw-glass max-w-3xl mx-auto p-8 sm:p-10" role="tabpanel">
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0" style={{ background: `${s.accent}22`, border: `1.5px solid ${s.accent}55` }}>{s.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      <h3 className="font-display text-xl font-extrabold text-white">{s.title}</h3>
                      <span className="rounded-full text-xs font-bold px-3 py-0.5 border" style={{ background: `${s.accent}22`, borderColor: `${s.accent}55`, color: s.accent }}>{s.badge}</span>
                    </div>
                    <p className="text-sky-100/70 mb-5">{s.body}</p>
                    <div className="flex flex-wrap gap-2 mb-6">
                      {s.features.map(f => <span key={f} className="text-xs font-semibold rounded-full border border-emerald-400/25 bg-emerald-400/10 text-emerald-300 px-3 py-1">✓ {f}</span>)}
                    </div>
                    <Link href={s.href} className="aw-btn px-7 py-3 text-sm">{s.cta} →</Link>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="mt-16"><Wave color="#f8fafc" /></div>
        </section>

        {/* ═══ WHY ═══ */}
        <section className="bg-slate-50 py-16 sm:py-20">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
            <div className="text-center mb-10"><span className="aw-badge aw-badge-dk">Our promise</span><h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900">Why AuroWater</h2></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {WHY.map(f => (
                <div key={f.t} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl mb-4" style={{ background: `${f.c}14` }}>{f.icon}</div>
                  <h3 className="font-display font-extrabold text-slate-900 mb-2">{f.t}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{f.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ CITIES (local SEO) ═══ */}
        <section id="areas" className="bg-white py-16">
          <div className="max-w-6xl mx-auto px-5 sm:px-8">
            <div className="text-center mb-10">
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900">Water delivery, plumber &amp; tank cleaning near you</h2>
              <p className="mt-2 text-slate-600 text-sm max-w-2xl mx-auto">Live in {LIVE_CITY_NAMES}. Delhi, Noida, Gurugram and Agra are served on approved PIN codes. We confirm availability for your address before you pay.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {LIVE_CITIES.map(c => (
                <div key={c.slug} className="rounded-3xl border border-slate-100 bg-slate-50 p-6">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-extrabold text-slate-900">📍 {c.name}</h3>
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">Live</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">RO water cans, plumbers and tank cleaning in {c.areas.join(', ')} and nearby areas.</p>
                  <Link href={`/book?service=water_can&city=${c.slug}`} className="mt-4 inline-block text-sm font-bold text-sky-700 hover:underline">Order in {c.name} →</Link>
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
              {PIN_CITIES.map(c => (
                <div key={c.slug} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display font-extrabold text-slate-900">📍 {c.name}</h3>
                    <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">Select PINs</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">Areas incl. {c.areas.slice(0, 4).join(', ')}.</p>
                  <Link href={`/book?service=water_can&city=${c.slug}`} className="mt-3 inline-block text-sm font-bold text-sky-700 hover:underline">Check my PIN code →</Link>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-slate-500">Not listed? Request your area: {CITIES.length} cities and growing.</p>
          </div>
        </section>

        {/* ═══ ROLES ═══ */}
        <section className="bg-slate-50 py-16">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
            <div className="text-center mb-10"><span className="aw-badge aw-badge-dk">Choose your role</span><h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900">Customer or partner, start here</h2></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {ROLES.map(r => (
                <div key={r.title} className="bg-white rounded-3xl p-7 border border-slate-100 shadow-sm flex flex-col">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${r.g} flex items-center justify-center text-2xl mb-5`}>{r.icon}</div>
                  <h3 className="font-display text-lg font-extrabold text-slate-900 mb-4 flex-1">{r.title}</h3>
                  <ul className="space-y-2 mb-6">{r.perks.map(p => <li key={p} className="text-sm text-slate-700"><span className="text-emerald-500 font-bold">✓</span> {p}</li>)}</ul>
                  <Link href={r.href} className={`inline-flex justify-center w-full rounded-2xl bg-gradient-to-r ${r.g} text-white px-6 py-3.5 text-sm font-bold font-display hover:opacity-90`}>{r.cta}</Link>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-slate-500">Supplier and technician access may require approval and verification.</p>
          </div>
        </section>

        {/* ═══ WHO WE SERVE ═══ */}
        <section className="bg-white py-14">
          <div className="max-w-5xl mx-auto px-5 text-center">
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 mb-8">Who we serve</h2>
            <div className="flex flex-wrap justify-center gap-3">
              {SERVE.map(i => <span key={i} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">{i}</span>)}
            </div>
          </div>
        </section>

        {/* ═══ REVIEWS ═══ */}
        <section className="bg-slate-50 py-14 overflow-hidden">
          <div className="text-center mb-8 px-5">
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900">Customer feedback</h2>
            <p className="text-slate-500 mt-2 text-sm">Reviews from AuroWater customers.</p>
          </div>
          <div className="space-y-4">
            <div className="overflow-hidden"><div className="flex gap-4 aw-mql">{left.map((r, i) => <ReviewCard key={`L${i}`} r={r} />)}</div></div>
            <div className="overflow-hidden"><div className="flex gap-4 aw-mqr">{right.map((r, i) => <ReviewCard key={`R${i}`} r={r} />)}</div></div>
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═══ */}
        <div className="bg-slate-50"><Wave flip color="var(--navy)" /></div>
        <section id="how-it-works" className="py-16 sm:py-20 relative" style={{ background: 'var(--navy)' }}>
          <div className="max-w-5xl mx-auto px-5 sm:px-8">
            <div className="text-center mb-10"><span className="aw-badge">Simple process</span><h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white">How it works</h2></div>
            <ol className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {STEPS.map((x, i) => (
                <li key={x.t} className="aw-glass flex flex-col items-center text-center p-7">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 flex items-center justify-center text-2xl mb-4">{x.icon}</div>
                  <h3 className="font-display text-base font-extrabold text-white mb-2">{i + 1}. {x.t}</h3>
                  <p className="text-sm text-slate-300/80 leading-relaxed">{x.b}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-16"><Wave color="#f8fafc" /></div>
        </section>

        {/* ═══ FAQ (matches FAQPage JSON-LD) ═══ */}
        <section id="faq" className="bg-slate-50 py-16">
          <div className="max-w-3xl mx-auto px-5 sm:px-8">
            <h2 className="font-display text-3xl font-extrabold text-slate-900 text-center mb-8">Frequently asked questions</h2>
            <div className="space-y-3">
              {FAQS.map((f, i) => (
                <div key={f.q} className="rounded-2xl bg-white border border-slate-100 shadow-sm">
                  <h3>
                    <button type="button" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}
                      className="w-full flex justify-between items-center gap-4 text-left px-5 py-4 font-display font-bold text-slate-900">
                      {f.q}<span aria-hidden="true" className="text-sky-600">{openFaq === i ? '−' : '+'}</span>
                    </button>
                  </h3>
                  {openFaq === i && <p className="px-5 pb-4 text-sm text-slate-600 leading-relaxed">{f.a}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ FOUNDING MEMBERS ═══ */}
        <section className="bg-white py-16">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 grid lg:grid-cols-[1.3fr,1fr] gap-10 items-center">
            <div>
              <span className="inline-block rounded-full bg-amber-50 border border-amber-200 px-4 py-1.5 mb-5 text-xs font-bold text-amber-700">🔥 Limited spots</span>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3 leading-tight">Join our first 100 founding members</h2>
              <p className="text-slate-600 mb-5">पहले 100 customers में शामिल हों और प्रायोरिटी सर्विस पाएं।</p>
              <ul className="space-y-2.5 mb-6 text-sm text-slate-700">
                {['Eligible offers shown before checkout', 'Welcome offers when eligible', 'Direct WhatsApp support with the core team'].map(t => <li key={t}>✓ {t}</li>)}
              </ul>
              {founding ? (
                <>
                  <div className="mb-2 flex justify-between text-sm font-semibold"><span className="text-slate-700">{claimed} of 100 claimed</span><span className="text-sky-600">{100 - claimed} remaining</span></div>
                  <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden mb-2"><div className="h-full rounded-full aw-prog transition-[width] duration-700" style={{ width: `${claimed}%` }} /></div>
                </>
              ) : <p className="text-sm text-slate-500 mb-3">Availability is confirmed when you submit your request.</p>}
              <p className="text-xs text-slate-400">We&apos;ll confirm your spot by SMS/WhatsApp within 24 hours.</p>
            </div>
            <div className="aw-glass-light rounded-3xl p-7 shadow-xl">
              <h3 className="font-display text-xl font-extrabold text-slate-900 mb-5">Reserve your spot</h3>
              <form onSubmit={submit} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="f-name" className="block text-xs font-bold text-slate-600 mb-1.5">Full name</label>
                  <input id="f-name" type="text" value={name} onChange={e => setName(e.target.value)} className="aw-input" placeholder="e.g. Arjun Singh" autoComplete="name" required />
                </div>
                <div>
                  <label htmlFor="f-phone" className="block text-xs font-bold text-slate-600 mb-1.5">Phone (WhatsApp)</label>
                  <input id="f-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="aw-input" placeholder="10-digit Indian mobile" autoComplete="tel" inputMode="tel" required />
                </div>
                <button type="submit" disabled={busy} className="aw-btn w-full justify-center py-3.5 text-sm" style={{ borderRadius: 14 }}>{busy ? '⏳ Saving…' : 'Join the first 100 →'}</button>
                <AnimatePresence>
                  {msg && <motion.p key="m" role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`text-sm text-center font-medium ${msg.includes('Welcome') ? 'text-emerald-600' : 'text-red-500'}`}>{msg}</motion.p>}
                </AnimatePresence>
              </form>
            </div>
          </div>
        </section>

        {/* ═══ EARN ═══ */}
        <div className="bg-white"><Wave flip color="var(--navy)" /></div>
        <section className="py-16 relative" style={{ background: 'var(--navy)' }}>
          <div className="max-w-6xl mx-auto px-5 sm:px-8">
            <div className="text-center mb-10"><span className="aw-badge">Partner with us</span><h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">Earn with AuroWater</h2></div>
            <div className="grid md:grid-cols-2 gap-5">
              {[
                { i: '🚚', t: 'Supply water', d: 'Use your vehicle and local routes to deliver cans. We bring the customers; you focus on timely delivery. Earnings depend on your area and order volume.', h: '/register/pro?type=supplier', c: 'from-emerald-500 to-teal-400', b: 'rgba(16,185,129,.3)' },
                { i: '🔧', t: 'Plumbing & tank cleaning', d: 'Get regular jobs for repairs, fittings and tank cleaning with transparent pricing and UPI payments. Earnings depend on jobs completed.', h: '/register/pro?type=technician', c: 'from-sky-500 to-cyan-400', b: 'rgba(14,165,233,.3)' },
              ].map(x => (
                <div key={x.t} className="rounded-3xl p-7" style={{ border: `1.5px solid ${x.b}`, background: 'rgba(255,255,255,.04)' }}>
                  <div className="text-3xl mb-3">{x.i}</div>
                  <h3 className="font-display text-lg font-extrabold text-white mb-2">{x.t}</h3>
                  <p className="text-sm text-slate-300/80 mb-5 leading-relaxed">{x.d}</p>
                  <Link href={x.h} className={`inline-flex rounded-full bg-gradient-to-r ${x.c} text-white px-6 py-3 text-sm font-bold font-display hover:opacity-90`}>Apply now →</Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ FINAL CTA ═══ */}
        <section className="relative overflow-hidden pt-16 pb-8 sm:pt-20" style={{ background: 'linear-gradient(180deg,var(--navy) 0%,var(--navy) 45%,#08111F 100%)' }}>
          <div className="relative max-w-4xl mx-auto px-5 sm:px-8 text-center">
            <span className="aw-badge">Get started today</span>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-5">Water shouldn&apos;t be a daily headache.</h2>
            <p className="text-base sm:text-lg text-slate-300/80 mb-8 max-w-2xl mx-auto leading-relaxed">Cans filled, taps fixed, tanks cleaned. One platform, clear prices, fixed minimum prices: normal ₹20, chilled ₹25 per can.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/book" className="aw-btn px-8 py-4 text-base">💧 Start in 30 seconds →</Link>
              <Link href="#pricing" className="aw-btn-ol px-8 py-4 text-base">See pricing &amp; savings</Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
