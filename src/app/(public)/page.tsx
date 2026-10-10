'use client';

import Link from 'next/link';
import Image from 'next/image';
import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import {
  motion,
  AnimatePresence,
} from 'framer-motion';
import { TRUST_REVIEWS } from '@/lib/trust-reviews';

/* ═══════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════ */
interface FoundingStats { count: number }

interface ServiceItem {
  icon: string;
  title: string;
  badge: string;
  body: string;
  cta: string;
  href: string;
  features: string[];
  accent: string;
  accentBg: string;
}

/* ═══════════════════════════════════════════════════
   STATIC DATA  (outside component — stable references, zero re-alloc)
═══════════════════════════════════════════════════ */
const SERVICES: ServiceItem[] = [
  {
    icon: '💧', title: 'Normal RO Water', badge: 'Everyday Essential',
    body: 'Normal RO ₹20 / 20L or Chilled RO ₹25 / 20L. Choose everyday drinking water or chilled water for gatherings; confirm availability before booking.',
    cta: 'Order Water', href: '/book?service=water_can',
    features: ['20L can', 'Clear total before confirmation', 'Address availability checked'],
    accent: '#0ea5e9', accentBg: 'rgba(14,165,233,0.13)',
  },
  {
    icon: '🔧', title: 'Plumber Service', badge: 'Water Problem?',
    body: 'Get help with leaking taps, plumbing repairs, fittings and supported water-system jobs through the existing booking flow.',
    cta: 'Find a Plumber', href: '/book?service=plumbing',
    features: ['Clear pricing before confirmation', 'Describe your problem', 'Availability checked for your area'],
    accent: '#6366f1', accentBg: 'rgba(99,102,241,0.13)',
  },
  {
    icon: '🚚', title: 'Event & Office Water', badge: 'Bulk Enquiries',
    body: 'Planning water for a wedding, party or office? Share your quantity, schedule and location to confirm available options.',
    cta: 'Request a Quote', href: '/contact',
    features: ['Normal or chilled requirements', 'Quantity-based enquiry', 'Availability confirmed before booking'],
    accent: '#10b981', accentBg: 'rgba(16,185,129,0.13)',
  },
];

// const STATS = [
//   { value: '20L', suffix: '', label: 'Water can size', icon: '💧', glow: '#0ea5e9' },
//   { value: '3+', suffix: '', label: 'Configured service cities', icon: '📍', glow: '#6366f1' },
//   { value: '2', suffix: '', label: 'Water options', icon: '🚰', glow: '#10b981' },
//   { value: 'Flexible', suffix: '', label: 'One-time & recurring options where available', icon: '✓', glow: '#f59e0b' },
// ] as const;

// Place this near the top of your file (e.g., above your default export component)
const STATS = [
  { 
    value: '20L', 
    suffix: 'Pure', 
    label: 'Standard Hydration Capacity', 
    sublabel: 'Sealed & hygienic mineral water cans',
    icon: '💧', 
    glow: 'from-sky-500/20 to-transparent' 
  },
  { 
    value: '9+', 
    suffix: 'Cities', 
    label: 'National Standard Excellence', 
    sublabel: 'Trusted and recognized operations worldwide',
    icon: '🌐', 
    glow: 'from-indigo-500/20 to-transparent' 
  },
  { 
    value: '2', 
    suffix: 'Modes', 
    label: 'Custom Temperature Options', 
    sublabel: 'Normal RO & Chilled refreshing supply',
    icon: '🚰', 
    glow: 'from-emerald-500/20 to-transparent' 
  },
  { 
    value: 'Flexible', 
    suffix: '', 
    label: 'Adaptive Service Models', 
    sublabel: 'One-time delivery or automated subscriptions',
    icon: '⚡', 
    glow: 'from-amber-500/20 to-transparent' 
  },
] as const;

const ROLES = [
  {
    icon: '💧', title: 'I Need Water & Plumber',
    desc: 'Order water, book plumbers, track deliveries. Sign up in 30 seconds.',
    perks: ['Instant signup', 'No documents needed', 'Start ordering immediately'],
    cta: 'Sign Up Free →', href: '/auth/register',
    gradient: 'from-sky-500 to-cyan-400', shadow: 'rgba(14,165,233,0.35)',
  },
  {
    icon: '🚛', title: 'I Supply Water',
    desc: 'Partner with us to deliver water. Get verified and receive orders directly.',
    perks: ['KYC verification', 'Admin approval process', 'Start earning once approved'],
    cta: 'Apply as Supplier →', href: '/register/pro?type=supplier',
    gradient: 'from-emerald-500 to-teal-400', shadow: 'rgba(16,185,129,0.35)',
  },
  {
    icon: '🔧', title: "I'm a Plumber / Tech",
    desc: 'Get verified, showcase your skills, and receive job requests from customers.',
    perks: ['Skill verification', 'Background check', 'Earn on your schedule'],
    cta: 'Apply as Plumber →', href: '/register/pro?type=technician',
    gradient: 'from-violet-500 to-purple-400', shadow: 'rgba(139,92,246,0.35)',
  },
] as const;

const WHY_CARDS = [
  { icon: '⚡', title: 'Same-day Service',    desc: 'Book by 2 PM, get service today in most areas.',           accent: '#f59e0b' },
  { icon: '💰', title: 'No Hidden Charges',   desc: 'Price shown = Price paid. Every single time, guaranteed.', accent: '#10b981' },
  { icon: '✅', title: 'Verified Pros',        desc: 'Every technician background-checked & ID-verified.',       accent: '#0ea5e9' },
  { icon: '📱', title: 'Live Tracking',        desc: 'Real-time updates from booking all the way to delivery.',  accent: '#8b5cf6' },
] as const;

const TRUST_BADGES = [
  '💧 Water delivery + home services', '💳 Cash + UPI per delivery',
  '📍 3+ live service zones', '🧾 Clear order totals', '🗓️ Recurring delivery options', '🔒 Protected account access',
] as const;

const SERVE_ITEMS = [
  { icon: '👨‍🎓', label: 'Students & PG' }, { icon: '👨‍💼', label: 'Professionals' },
  { icon: '🏠',   label: 'Homeowners' },    { icon: '🏢',   label: 'Offices' },
  { icon: '🎪',   label: 'Weddings and Party' },      { icon: '🍽️',  label: 'Restaurants' },
  { icon: '🏗️',  label: 'Construction' },  { icon: '🏫',   label: 'Schools' },
] as const;

const EARN_CARDS = [
  {
    icon: '🚚', title: 'Supply Water', earn: '₹3,000–8,000/mo', earnColor: '#34d399',
    desc: 'Use your vehicle and local routes to deliver water cans. We handle customers — you focus on timely delivery.',
    cta: 'Apply as Supplier →', href: '/register/pro?type=supplier',
    borderColor: 'rgba(16,185,129,0.3)', bgColor: 'rgba(16,185,129,0.06)',
    btnClass: 'from-emerald-500 to-teal-400',
  },
  {
    icon: '🔧', title: 'Work as Plumber', earn: '₹4,000–15,000/mo', earnColor: '#38bdf8',
    desc: 'Get regular jobs for fittings, repair & boring. Transparent pricing and instant UPI payments.',
    cta: 'Apply as Plumber →', href: '/register/pro?type=technician',
    borderColor: 'rgba(14,165,233,0.3)', bgColor: 'rgba(14,165,233,0.06)',
    btnClass: 'from-sky-500 to-cyan-400',
  },
] as const;

const STEPS = [
  {
    n: '01', icon: '📱', title: 'Order in 30 sec',
    body: 'Pick water or plumber, add your address, choose a time slot. Done in under a minute.',
  },
  {
    n: '02', icon: '🚚', title: 'Auto-assignment',
    body: 'Nearest verified supplier or plumber is assigned automatically and notified instantly.',
  },
  {
    n: '03', icon: '✅', title: 'Done — pay easy',
    body: 'Track live on the map, pay via cash or UPI on completion, then rate your experience.',
  },
] as const;

const FOUNDING_PERKS = [
  { icon: '🔒', t: 'Lifetime 10% discount on water and services' },
  { icon: '⚡', t: 'Always priority delivery window' },
  { icon: '🎁', t: 'First order free (up to ₹200)' },
  { icon: '📞', t: 'Direct WhatsApp support with the core team' },
] as const;

const DROPS_CONFIG = [
  { left: '7%',  duration: 5.2, delay: 0,   size: 13 },
  { left: '19%', duration: 6.8, delay: 1.3, size: 9  },
  { left: '33%', duration: 4.9, delay: 2.6, size: 16 },
  { left: '51%', duration: 7.1, delay: 0.9, size: 11 },
  { left: '67%', duration: 5.6, delay: 3.4, size: 14 },
  { left: '81%', duration: 6.2, delay: 1.8, size: 10 },
  { left: '93%', duration: 4.6, delay: 0.5, size: 12 },
] as const;

/* ═══════════════════════════════════════════════════
   PURE SUB-COMPONENTS  (stable — no parent re-renders leak in)
═══════════════════════════════════════════════════ */

const WaveDivider = React.memo(function WaveDivider({
  flip = false, color = '#f8fafc',
}: { flip?: boolean; color?: string }) {
  return (
    <div
      className="w-full overflow-hidden leading-none pointer-events-none"
      style={{ transform: flip ? 'rotate(180deg)' : undefined, marginBottom: '-2px' }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 1440 80" xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none" className="w-full h-10 sm:h-14" style={{ display: 'block' }}>
        <path
          d="M0,40 C200,80 400,0 600,40 C800,80 1000,0 1200,40 C1300,64 1380,20 1440,40 L1440,80 L0,80 Z"
          fill={color}
        />
      </svg>
    </div>
  );
});
WaveDivider.displayName = 'WaveDivider';

const HeroGlowOrbs = React.memo(function HeroGlowOrbs() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="aw-orb1" cx="50%" cy="40%" r="60%">
          <stop offset="0%"   stopColor="#0ea5e9" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0369a1" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="aw-orb2" cx="50%" cy="40%" r="60%">
          <stop offset="0%"   stopColor="#22d3ee" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#0891b2" stopOpacity="0" />
        </radialGradient>
        <filter id="aw-blur"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      <ellipse cx="12%"  cy="28%" rx="360" ry="300" fill="url(#aw-orb1)" filter="url(#aw-blur)" />
      <ellipse cx="88%"  cy="62%" rx="420" ry="340" fill="url(#aw-orb2)" filter="url(#aw-blur)" />
      <ellipse cx="50%"  cy="102%" rx="640" ry="220" fill="url(#aw-orb1)" filter="url(#aw-blur)" />
    </svg>
  );
});
HeroGlowOrbs.displayName = 'HeroGlowOrbs';

const RisingDrop = React.memo(function RisingDrop({
  left, duration, delay, size,
}: { left: string; duration: number; delay: number; size: number }) {
  return (
    <motion.div
      className="absolute bottom-4 pointer-events-none"
      style={{ left }}
      initial={{ y: 0, opacity: 0, scale: 0.4 }}
      animate={{ y: [0, -160, -320], opacity: [0, 0.65, 0], scale: [0.4, 1, 0.25] }}
      transition={{ duration, delay, repeat: Infinity, ease: 'easeOut' }}
      aria-hidden="true"
    >
      <svg width={size} height={size * 1.35} viewBox="0 0 20 27" fill="none">
        <path d="M10 1.5C10 1.5 1.5 12 1.5 17.5a8.5 8.5 0 0017 0C18.5 12 10 1.5 10 1.5z"
          fill="#38bdf8" fillOpacity="0.62" />
      </svg>
    </motion.div>
  );
});
RisingDrop.displayName = 'RisingDrop';



const ReviewCard = React.memo(function ReviewCard({
  r,
}: { r: (typeof TRUST_REVIEWS)[number] }) {
  return (
    <div className="aw-review-card flex-shrink-0 min-w-[292px] max-w-[316px] rounded-2xl bg-white border border-slate-100 shadow-sm px-5 py-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${r.color} text-white flex items-center justify-center font-bold text-xs shadow`}>
          {r.initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-900 text-sm truncate">{r.name}</div>
          <div className="text-xs text-slate-400 mt-0.5">{r.city} · {r.date}</div>
        </div>
        <div className="flex gap-px flex-shrink-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={i < r.rating ? 'text-amber-400' : 'text-slate-200'} style={{ fontSize: 11 }}>★</span>
          ))}
        </div>
      </div>
      <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100 mb-2.5">
        {r.service}
      </span>
      <p className="text-sm text-slate-600 leading-relaxed italic">"{r.text}"</p>
    </div>
  );
});
ReviewCard.displayName = 'ReviewCard';

/* ═══════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════ */
export default function HomePage() {
  const [founding, setFounding]       = useState<FoundingStats | null>(null);
  const [formName, setFormName]       = useState('');
  const [formPhone, setFormPhone]     = useState('');
  const [foundingMsg, setFoundingMsg] = useState<string | null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [activeSvc, setActiveSvc]     = useState(0);

  /* ── Footer handoff: home ends in #08111F gradient so the global Footer bridge has no harsh seam ── */
  useEffect(() => {
    document.documentElement.style.setProperty('--footer-prev-bg', '#08111F');
    return () => {
      document.documentElement.style.setProperty('--footer-prev-bg', '#ffffff');
    };
  }, []);

  /* ── Founding count ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res  = await fetch('/api/founding-members', { cache: 'no-store' });
        const json = (await res.json()) as { success: boolean; data: FoundingStats };
        if (!cancelled && json?.success) setFounding(json.data);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const claimed  = useMemo(() => Math.min(founding?.count ?? 0, 100), [founding]);
  const progress = useMemo(() => (claimed / 100) * 100, [claimed]);

  /* ── Doubled review arrays (stable) ── */
  const reviewsLeft  = useMemo(() => [...TRUST_REVIEWS, ...TRUST_REVIEWS], []);
  const reviewsRight = useMemo(
    () => [...TRUST_REVIEWS].reverse().concat([...TRUST_REVIEWS].reverse()),
    []
  );

  /* ── Form submit ── */
  const handleFoundingSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFoundingMsg(null);
      if (!formName.trim() || !formPhone.trim()) {
        setFoundingMsg('Please enter your name and phone.');
        return;
      }
      setSubmitting(true);
      try {
        const res  = await fetch('/api/founding-members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName.trim(), phone: formPhone.trim() }),
        });
        const json = (await res.json()) as { success: boolean; error?: string; message?: string };
        if (!res.ok || !json?.success) {
          setFoundingMsg(json?.error ?? 'Could not save. Please try again.');
        } else {
          setFoundingMsg(json?.message ?? "Welcome! 🎉 We'll confirm your spot by WhatsApp.");
          setFormName(''); setFormPhone('');
          setFounding(prev => ({ count: (prev?.count ?? 0) + 1 }));
        }
      } catch {
        setFoundingMsg('Network error. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [formName, formPhone]
  );

  /* ══════════════════════════ RENDER ══════════════════════════ */
  return (
    <>
      {/* ── GLOBAL CSS ── */}
      <style>{`
        /* Fonts load from root layout <link> — avoid duplicate @import */

        :root {
          --navy:  #020c18;
          --navy2: #041424;
          --blue:  #0ea5e9;
          --cyan:  #22d3ee;
          --green: #10b981;
          --violet: #6366f1;
          --font-display: 'Bricolage Grotesque', 'Syne', system-ui, sans-serif;
          --font-body:    'DM Sans', system-ui, sans-serif;
          --font-mono:    'Syne', system-ui, sans-serif;
          --fd: var(--font-display);
          --fh: var(--font-display);
          --fb: var(--font-body);
          --glass: rgba(7,30,52,0.65);
          --glass-b: rgba(14,165,233,0.16);
        }

        *, *::before, *::after { box-sizing: border-box; }
        body { font-family: var(--font-body); background: var(--navy); overflow-x: hidden; }
        .font-display { font-family: var(--font-display); }

        /* ═══ Hero typography (no clipping, 360px–desktop) ═══ */
        .hero-section {
          overflow: visible;
          position: relative;
        }

        .hero-headline {
          font-family:    var(--font-display);
          font-weight:    800;
          font-style:     normal;
          font-optical-sizing: auto;
          font-size:      clamp(2.2rem, 5.5vw, 4.8rem);
          line-height:    1.06;
          letter-spacing: -0.5px;
          color: #ffffff;
          padding-block: 0.04em;
          overflow: visible;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        @media (max-width: 480px) {
          .hero-headline {
            letter-spacing: 0;
            font-size: clamp(2rem, 8vw, 3rem);
            line-height: 1.08;
          }
        }

        .hero-headline-accent { color: #60A5FA; }

        .hero-headline-hindi {
          font-family: 'Noto Sans Devanagari', system-ui, sans-serif;
          font-weight: 700;
          font-size: clamp(2rem, 8vw, 3rem);
          line-height: 1.35;
          letter-spacing: 0;
          color: #ffffff;
          padding-top: 0.1em;
          padding-bottom: 0.04em;
          overflow: visible;
          -webkit-font-smoothing: antialiased;
        }
        @media (min-width: 481px) {
          .hero-headline-hindi {
            font-size: clamp(2.2rem, 5.5vw, 4.25rem);
            line-height: 1.35;
          }
        }

        .hero-sub {
          font-family:   var(--font-body);
          font-weight:   400;
          font-size:     clamp(0.95rem, 1.8vw, 1.15rem);
          line-height:   1.65;
          color:         rgba(255, 255, 255, 0.60);
          letter-spacing: 0;
          max-width:     520px;
          overflow:      visible;
        }
        @media (max-width: 480px) {
          .hero-sub { font-size: 0.95rem; line-height: 1.6; }
        }

        .hero-eyebrow {
          display:        inline-flex;
          align-items:    center;
          gap:            7px;
          padding:        5px 14px;
          border-radius:  99px;
          background:     rgba(96, 165, 250, 0.12);
          border:         1px solid rgba(96, 165, 250, 0.28);
          font-family:    var(--font-body);
          font-size:      11px;
          font-weight:    700;
          color:          #93C5FD;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom:  18px;
          overflow:       visible;
        }

        .hero-stat-val {
          font-family:    var(--font-display);
          font-weight:    900;
          font-size:      clamp(2rem, 4.5vw, 3rem);
          letter-spacing: -1px;
          line-height:    1;
          color:          #ffffff;
          text-shadow:    0 0 36px rgba(96, 165, 250, 0.45), 0 2px 12px rgba(0, 0, 0, 0.35);
          -webkit-font-smoothing: antialiased;
          padding-bottom: 0.06em;
          overflow:       visible;
        }

        .hero-stat-lbl {
          font-family:   var(--font-body);
          font-size:     11px;
          font-weight:   700;
          color:         rgba(255, 255, 255, 0.72);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-top:    6px;
        }

        .hero-gradient-text {
          background-image: linear-gradient(135deg, #60A5FA 0%, #34D399 100%);
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
          display: inline-block;
          padding-bottom: 0.08em;
          line-height: 1.1;
        }

        .section-heading {
          font-family:    var(--font-display);
          font-weight:    700;
          font-size:      clamp(1.5rem, 3.5vw, 2.4rem);
          line-height:    1.1;
          letter-spacing: -0.3px;
          color:          #0A1628;
          overflow:       visible;
          padding-block:  0.02em;
          -webkit-font-smoothing: antialiased;
        }
        @media (max-width: 480px) {
          .section-heading {
            font-size: clamp(1.4rem, 6.5vw, 1.8rem);
            letter-spacing: -0.1px;
          }
        }
        .section-heading-light { color: #ffffff; }

        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: var(--navy); }
        ::-webkit-scrollbar-thumb { background: var(--blue); border-radius: 3px; }

        /* ─ Cursor ─ */
        .aw-cursor {
          position: fixed; top: 0; left: 0;
          width: 24px; height: 24px; border-radius: 50%;
          border: 1.5px solid rgba(14,165,233,0.6);
          pointer-events: none; z-index: 9999; mix-blend-mode: screen;
        }
        @media (pointer:coarse) { .aw-cursor { display:none; } }

        /* ─ Keyframes ─ */
        @keyframes aw-shimmer { 0%{background-position:-300% center} 100%{background-position:300% center} }
        @keyframes aw-grad    { 0%,100%{background-position:0% 50%}  50%{background-position:100% 50%} }
        @keyframes aw-float   { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-16px) scale(1.04)} }
        @keyframes aw-ripple  { 0%{transform:scale(0.75);opacity:0.8} 100%{transform:scale(2.5);opacity:0} }
        @keyframes aw-prog    { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes aw-mql     { from{transform:translateX(0)}    to{transform:translateX(-50%)} }
        @keyframes aw-mqr     { from{transform:translateX(-50%)} to{transform:translateX(0)} }
        @keyframes aw-dot-p   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.75)} }

        /* ─ Shimmer headline ─ */
        .aw-shimmer {
          background: linear-gradient(90deg,#7dd3fc 0%,#ffffff 30%,#22d3ee 55%,#7dd3fc 100%);
          background-size: 300% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text; animation: aw-shimmer 4s linear infinite;
        }

        /* ─ Primary button ─ */
        .aw-btn {
          background: linear-gradient(135deg,#0284c7 0%,#0ea5e9 40%,#22d3ee 100%);
          background-size: 200% 200%; animation: aw-grad 3s ease infinite;
          color:#fff; font-family:var(--fd); font-weight:700;
          border-radius:999px; border:none; cursor:pointer;
          position:relative; overflow:hidden;
          transition:transform .18s ease, box-shadow .18s ease, filter .18s ease;
          will-change:transform; display:inline-flex; align-items:center; gap:8px;
          text-decoration:none;
          box-shadow: 0 10px 30px rgba(14,165,233,.32), inset 0 1px 0 rgba(255,255,255,.3);
        }
        .aw-btn::after {
          content:''; position:absolute; inset:0;
          background:linear-gradient(135deg,rgba(255,255,255,.18),transparent 60%);
          pointer-events:none;
        }
        .aw-btn:hover { transform:translateY(-2px); box-shadow:0 16px 36px rgba(14,165,233,.5); filter:saturate(1.08); }
        .aw-btn:active { transform:translateY(0); }
        .aw-btn:disabled { opacity:.58; cursor:not-allowed; animation:none; }

        /* ─ Outline button ─ */
        .aw-btn-ol {
          display:inline-flex; align-items:center; gap:8px; text-decoration:none;
          border:1.5px solid rgba(14,165,233,.38); color:#bae6fd;
          font-family:var(--fd); font-weight:600; border-radius:999px;
          background:rgba(14,165,233,.07); backdrop-filter:blur(8px);
          transition:background .18s,border-color .18s,transform .18s;
        }
        .aw-btn-ol:hover { background:rgba(14,165,233,.16); border-color:rgba(14,165,233,.65); transform:translateY(-1px); box-shadow:0 8px 24px rgba(14,165,233,.2); }

        /* ─ Glass ─ */
        .aw-glass { background:var(--glass); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px); border:1px solid var(--glass-b); border-radius:20px; }
        .aw-glass-light { background:rgba(255,255,255,.93); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); border:1px solid rgba(14,165,233,.18); }

        /* ─ Card hover ─ */
        .aw-card { transition:transform .26s cubic-bezier(.34,1.56,.64,1),box-shadow .26s ease; will-change:transform; }
        .aw-card:hover { transform:translateY(-7px); box-shadow:0 24px 56px rgba(14,165,233,.12); }

        /* ─ Badge ─ */
        .aw-badge {
          display:inline-block; font-family:var(--fd); font-size:.63rem;
          font-weight:700; letter-spacing:.18em; text-transform:uppercase;
          color:#38bdf8; background:rgba(14,165,233,.1); border:1px solid rgba(14,165,233,.28);
          border-radius:999px; padding:4px 14px; margin-bottom:14px;
        }
        .aw-badge-dk { color:#0369a1; background:rgba(14,165,233,.08); border-color:rgba(14,165,233,.22); }

        /* ─ Svc tab ─ */
        .aw-tab { border:1.5px solid rgba(14,165,233,.22); color:#93c5fd; border-radius:999px; font-family:var(--fd); font-weight:600; font-size:.8rem; padding:8px 20px; cursor:pointer; transition:all .2s; background:transparent; white-space:nowrap; }
        .aw-tab:hover { background:rgba(14,165,233,.1); }
        .aw-tab.active { background:linear-gradient(135deg,#0284c7,#0ea5e9); border-color:transparent; color:#fff; box-shadow:0 4px 18px rgba(14,165,233,.4); }

        /* ─ Dot ─ */
        .aw-dot { width:8px; height:8px; border-radius:999px; background:rgba(14,165,233,.3); cursor:pointer; border:none; transition:all .25s; padding:0; }
        .aw-dot.active { width:24px; background:#0ea5e9; }

        /* ─ Input ─ */
        .aw-input { background:#fff; border:1.5px solid #e2e8f0; border-radius:14px; padding:12px 16px; font-size:.875rem; color:#0f172a; width:100%; outline:none; font-family:var(--fb); transition:border-color .2s,box-shadow .2s; }
        .aw-input::placeholder { color:#94a3b8; }
        .aw-input:focus { border-color:#0ea5e9; box-shadow:0 0 0 3px rgba(14,165,233,.15); }

        /* ─ Hero bg ─ */
        .aw-hero-bg {
          background:
            radial-gradient(ellipse 85% 65% at 18% 18%,rgba(14,165,233,.22) 0%,transparent 68%),
            radial-gradient(ellipse 65% 55% at 82% 72%,rgba(6,182,212,.17) 0%,transparent 68%),
            radial-gradient(ellipse 45% 40% at 50% 108%,rgba(16,185,129,.11) 0%,transparent 70%),
            linear-gradient(165deg,#020c18 0%,#041424 55%,#020c18 100%);
        }
        .aw-hero-bg::before{
          content:'';
          position:absolute; inset:0;
          background:
            linear-gradient(105deg, rgba(99,102,241,.12), transparent 30%),
            linear-gradient(255deg, rgba(14,165,233,.14), transparent 35%);
          pointer-events:none;
        }

        /* ─ Progress bar ─ */
        .aw-prog {
          background:linear-gradient(90deg,#0284c7,#22d3ee,#10b981,#22d3ee,#0284c7);
          background-size:300% 100%; animation:aw-prog 2.5s linear infinite;
        }

        /* ─ Misc ─ */
        .aw-float   { animation:aw-float 3.8s ease-in-out infinite; }
        .aw-ring    { animation:aw-ripple 2.4s ease-out infinite; }
        .aw-ring:nth-child(2) { animation-delay:.8s; }
        .aw-ring:nth-child(3) { animation-delay:1.6s; }
        .aw-glow    { text-shadow:0 0 28px rgba(14,165,233,.55); }
        .aw-live    { width:8px;height:8px;border-radius:50%;background:#4ade80;animation:aw-dot-p 2s ease-in-out infinite; }

        .aw-grid-dots  { background-image:radial-gradient(circle,#38bdf8 1px,transparent 1px); background-size:48px 48px; }
        .aw-grid-lines { background-image:linear-gradient(rgba(14,165,233,.8) 1px,transparent 1px),linear-gradient(90deg,rgba(14,165,233,.8) 1px,transparent 1px); background-size:60px 60px; }

        .aw-mql { animation:aw-mql 42s linear infinite; }
        .aw-mqr { animation:aw-mqr 48s linear infinite; }
        .aw-mql:hover,.aw-mqr:hover { animation-play-state:paused; }
        @media(max-width:640px){ .aw-mql{animation-duration:26s;} .aw-mqr{animation-duration:30s;} }

        .aw-review-card { transition:transform .2s; }
        .aw-review-card:hover { transform:scale(1.02); }

        .aw-hero-copy { max-width: 38rem; }
      `}</style>

      <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--navy)' }}>

        {/* ═══════════════════════════════ HERO ═══════════════════════════════ */}
        <section className="aw-hero-bg hero-section relative min-h-screen flex flex-col overflow-x-hidden overflow-y-visible">

          {/* Grid texture */}
          <div className="absolute inset-0 pointer-events-none aw-grid-dots" style={{ opacity: .028 }} aria-hidden="true" />

          {/* ── Content ── */}
          <div className="relative z-10 flex-1 flex items-center">
            <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-20 sm:py-24 w-full">
              <div className="grid grid-cols-1 lg:grid-cols-[1.15fr,1fr] gap-12 xl:gap-16 items-center">

                {/* ── LEFT ── */}
                <motion.div
                  className="aw-hero-copy text-safe"
                  style={{ overflow: 'visible' }}
                  initial={{ opacity: 0, x: -36 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: .75, ease: [.22,1,.36,1] }}
                >
                  {/* Eyebrow — DM Sans, no clip */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="hero-eyebrow"
                  >
                    <span className="aw-live shrink-0" aria-hidden="true" />
                    Now serving eligible areas of Kanpur, Lucknow , Gorakhpur &amp; NCR
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.16 }}
                    className="text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400/70 mb-4"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    AuroWater · ऑन-डिमांड पानी + प्लम्बर
                  </motion.p>

                  <h1 className="mb-6 overflow-visible text-safe" style={{ overflow: 'visible' }}>
                    <span className="hero-headline-hindi block">
                      शुद्ध पानी।{' '}
                      <span className="hero-headline-accent">सीधे आपके दरवाज़े तक।</span>
                    </span>
                    <span className="hero-headline block text-white mt-2">Pure Water,</span>
                    <span className="hero-headline block mt-1">
                      <span className="hero-headline-accent aw-glow">At Your Door.</span>
                    </span>
                  </h1>

                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.22 }}
                    className="hero-sub mb-9 max-w-lg"
                  >
                    Order everyday RO water or find a plumber for leaks, fittings and supported water-system problems.
                    Event and office water enquiries are available too — all through one simple platform.
                  </motion.p>

                  {/* CTAs */}
                  <motion.div className="flex flex-wrap gap-3 mb-9"
                    initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:.3 }}>
                    <Link href="/book?service=water_can" className="aw-btn px-7 py-3.5 text-sm sm:text-base shadow-xl">
                      💧 Order Water Now
                    </Link>
                    <Link href="/book?service=plumbing" className="aw-btn-ol px-7 py-3.5 text-sm sm:text-base">
                      🔧 Book a Plumber
                    </Link>
                  </motion.div>

                  {/* Trust pills */}
                  <motion.div className="flex flex-wrap gap-2"
                    initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:.42 }}>
                    {['Cash + UPI','Hindi & English','Clear order totals','Local availability'].map(tag => (
                      <span key={tag} className="rounded-full border border-sky-500/20 bg-sky-500/8 text-sky-300/80 text-xs font-medium px-3 py-1">
                        ✦ {tag}
                      </span>
                    ))}
                  </motion.div>

                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3" aria-label="AuroTap service highlights">
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                      <div className="text-xl font-black text-white"> ₹20</div>
                      <div className="mt-1 text-xs text-slate-300">Normal RO · 20L can</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                      <div className="text-xl font-black text-white"> ₹25</div>
                      <div className="mt-1 text-xs text-slate-300">Chilled RO · 20L can</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                      <div className="text-sm font-extrabold text-white">3+ service cities</div>
                      <div className="mt-1 text-xs text-slate-300">Kanpur · Lucknow · Gorakhpur and NCR</div>
                    </div>
                  </div>
                </motion.div>

                {/* ── RIGHT ── */}
                <motion.div className="flex flex-col gap-4"
                  initial={{ opacity:0, x:36 }} animate={{ opacity:1, x:0 }}
                  transition={{ delay:.18, duration:.75, ease:[.22,1,.36,1] }}>

                  {/* Real water-service photography; attribution is kept visible. */}
                  {/* <figure className="overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06] shadow-2xl">
                    <Image
                      src="https://images.unsplash.com/photo-1739528660620-89a665b3a4db?auto=format&fit=crop&w=1600&q=85"
                      alt="Water dispenser in a clean setting"
                      width={1600}
                      height={1067}
                      priority
                      sizes="(max-width: 1024px) 100vw, 42vw"
                      className="h-56 w-full object-cover sm:h-72"
                    />
<Image
    src="/Friendly Kitchen Water Service Team.png" 
    alt="Friendly Kitchen Water Service Team"
    width={1600}
    height={1067}
    priority
    sizes="(max-width: 1024px) 100vw, 42vw"
    className="h-56 w-full object-cover sm:h-72"
  />
                    
                  </figure> */}

  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  {/* Image 1: Water Dispenser */}
  <figure className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-md">
    <div className="relative aspect-[16/10] w-full overflow-hidden">
      <Image
        src="https://images.unsplash.com/photo-1739528660620-89a665b3a4db?auto=format&fit=crop&w=1600&q=85"
        alt="Water dispenser in a clean setting"
        fill
        sizes="(max-width: 768px) 100vw, 33vw"
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
      />
      {/* Floating Badge */}
      <div className="absolute top-3 left-3 rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-md border border-white/15">
        ✨ 100% Sealed & Hygienic
      </div>
    </div>
    <figcaption className="p-4 flex items-center justify-between text-xs text-slate-300/80">
      <span className="font-semibold text-white">Pure Hydration Infrastructure</span>
      <span className="text-sky-400">20L RO Cans</span>
    </figcaption>
  </figure>

  {/* Image 2: Friendly Kitchen Team */}
  <figure className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-md">
    <div className="relative aspect-[16/10] w-full overflow-hidden">
      <Image
        src="/Friendly Kitchen Water Service Team.png"
        alt="Friendly Kitchen Water Service Team"
        fill
        sizes="(max-width: 768px) 100vw, 33vw"
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
      />
      {/* Floating Badge */}
      <div className="absolute top-3 left-3 rounded-full bg-emerald-600/80 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-md border border-white/15">
        🛡️ Vetted Local Experts
      </div>
    </div>
    <figcaption className="p-4 flex items-center justify-between text-xs text-slate-300/80">
      <span className="font-semibold text-white">Doorstep Delivery Crew</span>
      <span className="text-emerald-400">3-Hr Windows</span>
    </figcaption>
  </figure>

  {/* Image 3: Maintenance / Professional Service */}
  <figure className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-md">
    <div className="relative aspect-[16/10] w-full overflow-hidden">
      <Image
        src="/Mentinence image.png"
        alt="All Water Services"
        fill
        sizes="(max-width: 768px) 100vw, 33vw"
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
      />
      {/* Floating Badge */}
      <div className="absolute top-3 left-3 rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-md border border-white/15">
        🛠️ Zero Hidden Fees
      </div>
    </div>
    <figcaption className="p-4 flex items-center justify-between text-xs text-slate-300/80">
      <span className="font-semibold text-white">Complete Maintenance</span>
      <span className="text-amber-400">Plumbing & Tank Care</span>
    </figcaption>
  </figure>
</div>

                  {/* Factual product/service information, not inflated social proof. */}
                  <div className="grid grid-cols-2 gap-3">
                    {STATS.map((s) => (
                      <div key={s.label} className="rounded-2xl border border-white/15 bg-white/[0.09] px-5 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                        <div className="text-2xl mb-2">{s.icon}</div>
                        <div
                          className="hero-stat-val"
                          style={{ textShadow: `0 0 22px ${s.glow}60` }}
                        >
                          {s.value}{s.suffix}
                        </div>
                        <div className="hero-stat-lbl">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Why card */}
                  <motion.div className="aw-glass p-5"
                    initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }} transition={{ delay:.54 }}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="font-display text-xs font-bold text-emerald-300 uppercase tracking-widest">Why AuroWater</span>
                    </div>
                    <ul className="space-y-2.5">
                      {[
                        '20L water-can delivery with address availability checks',
                        'Plumbing and water-system service requests',
                        'Current pricing and order total shown before confirmation',
                        'Cash + UPI options where available',
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-sky-100/72">
                          <span className="text-sky-400 mt-0.5 flex-shrink-0 text-xs">◆</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </motion.div>

                  {/* Audience tags */}
                  <motion.div className="flex flex-wrap gap-2"
                    initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:.64 }}>
                    {['👨‍🎓 Students & PG','🏠 Families','🏢 Offices , Restorents','🎪 For All Types Of Events'].map(tag => (
                      <span key={tag} className="rounded-full border border-sky-400/24 bg-sky-400/7 px-3 py-1 text-xs font-medium text-sky-200">
                        {tag}
                      </span>
                    ))}
                  </motion.div>
                </motion.div>

              </div>
            </div>
          </div>

          {/* Wave */}
          <div className="relative z-10"><WaveDivider color="#f8fafc" /></div>
        </section>

        {/* ═══════ TRUST STRIP ═══════ */}
        <section className="bg-slate-50 py-4 border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-5">
            <div className="flex flex-wrap justify-center gap-x-7 gap-y-2 text-xs sm:text-sm text-slate-500 font-semibold">
              {TRUST_BADGES.map(b => <span key={b}>{b}</span>)}
            </div>
          </div>
        </section>

        {/* ═══════ THREE PATHS ═══════ */}
        <section className="bg-slate-50 py-16 sm:py-20 lg:py-24">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
            <motion.div className="text-center mb-12"
              initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
              <span className="aw-badge aw-badge-dk">Choose Your Role</span>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight">
                Three paths —<br className="hidden sm:block" /> pick the one that fits you
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
              {ROLES.map((role, i) => (
                <motion.div key={role.title}
                  className="aw-card bg-white rounded-3xl p-7 border border-slate-100 shadow-sm flex flex-col"
                  initial={{ opacity:0, y:28 }} whileInView={{ opacity:1, y:0 }}
                  viewport={{ once:true }} transition={{ delay:i*.1 }}>
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${role.gradient} flex items-center justify-center text-2xl mb-5 shadow-lg`}
                    style={{ boxShadow:`0 6px 20px ${role.shadow}` }}>
                    {role.icon}
                  </div>
                  <h3 className="font-display text-lg font-extrabold text-slate-900 mb-2">{role.title}</h3>
                  <p className="text-sm text-slate-500 mb-5 leading-relaxed flex-1">{role.desc}</p>
                  <ul className="space-y-2 mb-7">
                    {role.perks.map(p => (
                      <li key={p} className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="text-emerald-500 font-bold">✓</span> {p}
                      </li>
                    ))}
                  </ul>
                  <Link href={role.href}
                    className={`inline-flex items-center justify-center w-full rounded-2xl bg-gradient-to-r ${role.gradient} text-white px-6 py-3.5 text-sm font-bold font-display shadow hover:opacity-90 transition`}>
                    {role.cta}
                  </Link>
                </motion.div>
              ))}
            </div>

            <p className="mt-8 text-center text-sm text-slate-500">
              🛡️ Customers can add a contact number for delivery coordination. Supplier and technician access may require approval and verification.
            </p>
          </div>
        </section>

        {/* ═══════ SERVICES (dark) ═══════ */}
        <div className="bg-slate-50"><WaveDivider flip color="var(--navy)" /></div>
        <section className="py-16 sm:py-20 lg:py-24 relative overflow-hidden" style={{ background:'var(--navy)' }} id="services">
          <div className="absolute inset-0 pointer-events-none aw-grid-dots" style={{ opacity:.035 }} aria-hidden="true" />

          <div className="relative max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
            <motion.div className="text-center mb-12"
              initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
              <span className="aw-badge">What We Offer</span>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white">Water first. Plumbing when you need it.</h2>
            </motion.div>

            <div className="flex justify-center gap-2 flex-wrap mb-10">
              {SERVICES.map((s, i) => (
                <button key={s.title} type="button" onClick={() => setActiveSvc(i)}
                  className={`aw-tab ${activeSvc===i ? 'active' : ''}`}>
                  {s.icon} {s.title}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={activeSvc}
                initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:-16 }} transition={{ duration:.3 }}
                className="aw-glass max-w-3xl mx-auto p-8 sm:p-10">
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                    style={{ background:SERVICES[activeSvc].accentBg, border:`1.5px solid ${SERVICES[activeSvc].accent}44` }}>
                    {SERVICES[activeSvc].icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      <h3 className="font-display text-xl font-extrabold text-white">{SERVICES[activeSvc].title}</h3>
                      <span className="rounded-full text-xs font-bold px-3 py-0.5 border"
                        style={{ background:SERVICES[activeSvc].accentBg, borderColor:`${SERVICES[activeSvc].accent}44`, color:SERVICES[activeSvc].accent }}>
                        {SERVICES[activeSvc].badge}
                      </span>
                    </div>
                    <p className="text-sky-100/65 mb-5">{SERVICES[activeSvc].body}</p>
                    <div className="flex flex-wrap gap-2 mb-6">
                      {SERVICES[activeSvc].features.map(f => (
                        <span key={f} className="flex items-center gap-1.5 text-xs font-semibold rounded-full border border-emerald-400/25 bg-emerald-400/10 text-emerald-300 px-3 py-1">
                          ✓ {f}
                        </span>
                      ))}
                    </div>
                    <Link href={SERVICES[activeSvc].href} className="aw-btn px-7 py-3 text-sm shadow-lg">
                      {SERVICES[activeSvc].cta} →
                    </Link>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="flex justify-center gap-2 mt-6">
              {SERVICES.map((_, i) => (
                <button key={i} type="button" onClick={() => setActiveSvc(i)}
                  className={`aw-dot ${i===activeSvc ? 'active' : ''}`}
                  aria-label={`Service ${i+1}`} />
              ))}
            </div>
          </div>
          <div className="mt-16"><WaveDivider color="#f8fafc" /></div>
        </section>

        {/* ═══════ WHY AUROWATER ═══════ */}
        <section className="bg-slate-50 py-16 sm:py-20 lg:py-24">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
            <motion.div className="text-center mb-12"
              initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
              <span className="aw-badge aw-badge-dk">Our Promise</span>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900">Why AuroWater</h2>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {WHY_CARDS.map((f, i) => (
                <motion.div key={f.title}
                  className="aw-card bg-white rounded-3xl p-6 border border-slate-100 shadow-sm"
                  initial={{ opacity:0, y:28 }} whileInView={{ opacity:1, y:0 }}
                  viewport={{ once:true }} transition={{ delay:i*.09 }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl mb-4"
                    style={{ background:`${f.accent}14`, color:f.accent }}>
                    {f.icon}
                  </div>
                  <h3 className="font-display font-extrabold text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════ WHO WE SERVE ═══════ */}
        <section className="bg-white py-14 sm:py-16">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-12">
            <motion.h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 text-center mb-8"
              initial={{ opacity:0, y:16 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
              Who we serve
            </motion.h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SERVE_ITEMS.map((item, i) => (
                <motion.div key={item.label}
                  className="aw-card flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-4 text-center"
                  initial={{ opacity:0, scale:.88 }} whileInView={{ opacity:1, scale:1 }}
                  viewport={{ once:true }} transition={{ delay:i*.05 }}>
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-xs sm:text-sm font-semibold text-slate-700">{item.label}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════ REVIEWS MARQUEE ═══════ */}
        <section className="bg-slate-50 py-14 overflow-hidden">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 mb-10">
            <motion.div className="text-center"
              initial={{ opacity:0, y:16 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
              <span className="aw-badge aw-badge-dk">Social Proof</span>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900">Trusted by customers</h2>
              <p className="text-slate-500 mt-2 text-sm">Customer feedback and service updates.</p>
            </motion.div>
          </div>
          <div className="space-y-4">
            <div className="overflow-hidden">
              <div className="flex gap-4 aw-mql">
                {reviewsLeft.map((r, idx) => <ReviewCard key={`L${idx}`} r={r} />)}
              </div>
            </div>
            <div className="overflow-hidden">
              <div className="flex gap-4 aw-mqr">
                {reviewsRight.map((r, idx) => <ReviewCard key={`R${idx}`} r={r} />)}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════ HOW IT WORKS (dark) ═══════ */}
        <div className="bg-slate-50"><WaveDivider flip color="var(--navy)" /></div>
        <section className="py-16 sm:py-20 lg:py-24 relative overflow-hidden" style={{ background:'var(--navy)' }} id="how-it-works">
          <div className="absolute inset-0 pointer-events-none aw-grid-lines" style={{ opacity:.032 }} aria-hidden="true" />

          <div className="relative max-w-5xl mx-auto px-5 sm:px-8 lg:px-12">
            <motion.div className="text-center mb-12"
              initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
              <span className="aw-badge">Simple Process</span>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white">How it works</h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              <div className="hidden md:block absolute top-11 left-[35%] right-[35%] h-px"
                style={{ background:'linear-gradient(90deg,transparent,rgba(14,165,233,.5),transparent)' }}
                aria-hidden="true" />

              {STEPS.map((item, i) => (
                <motion.div key={item.n}
                  className="aw-glass flex flex-col items-center text-center p-7"
                  initial={{ opacity:0, y:28 }} whileInView={{ opacity:1, y:0 }}
                  viewport={{ once:true }} transition={{ delay:i*.12 }}>
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 flex items-center justify-center text-2xl mb-4 z-10"
                    style={{ boxShadow:'0 6px 24px rgba(14,165,233,.42)' }}>
                    {item.icon}
                  </div>
                  <div className="font-display text-xs font-extrabold text-sky-400 tracking-widest mb-2">{item.n}</div>
                  <h3 className="font-display text-base font-extrabold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-300/75 leading-relaxed">{item.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
          <div className="mt-16"><WaveDivider color="#f8fafc" /></div>
        </section>

        {/* ═══════ FOUNDING MEMBERS ═══════ */}
        <section className="bg-slate-50 py-16 sm:py-20 lg:py-24">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12">
            <div className="grid lg:grid-cols-[1.35fr,1fr] gap-10 items-center">

              <motion.div initial={{ opacity:0, x:-28 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }}>
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-4 py-1.5 mb-5">
                  <span>🔥</span>
                  <span className="font-display text-xs font-bold text-amber-700 uppercase tracking-wide">Limited Spots</span>
                </div>
                <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3 leading-tight">
                  Join Our First<br />
                  <span className="text-sky-600">100 Founding Members</span>
                </h2>
                <p className="text-slate-600 mb-5 leading-relaxed">
                  पहले 100 customers में शामिल हों और हमेशा के लिए बेहतर पानी और प्रायोरिटी सर्विस पाएं।
                </p>
                <ul className="space-y-2.5 mb-7">
                  {FOUNDING_PERKS.map(item => (
                    <li key={item.t} className="flex items-center gap-3 text-sm text-slate-700">
                      <span>{item.icon}</span> {item.t}
                    </li>
                  ))}
                </ul>
                {founding ? (
                  <>
                    <div className="mb-2 flex justify-between text-sm font-semibold">
                      <span className="text-slate-700">{claimed} of 100 spots claimed</span>
                      <span className="text-sky-600">{100 - claimed} remaining</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden mb-2">
                      <div className="h-full rounded-full aw-prog transition-[width] duration-700" style={{ width:`${progress}%` }} />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500 mb-3">Founding membership availability is confirmed when you submit your request.</p>
                )}
                <p className="text-xs text-slate-400">We&apos;ll confirm your spot by SMS/WhatsApp within 24 hours.</p>
              </motion.div>

              <motion.div className="aw-glass-light rounded-3xl p-7 sm:p-8 shadow-xl"
                initial={{ opacity:0, x:28 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }}>
                <h3 className="font-display text-xl font-extrabold text-slate-900 mb-5">Reserve your spot</h3>
                <form onSubmit={handleFoundingSubmit} className="space-y-4" noValidate>
                  <div>
                    <label htmlFor="f-name" className="block font-display text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Full Name</label>
                    <input id="f-name" type="text" value={formName} onChange={e => setFormName(e.target.value)}
                      className="aw-input" placeholder="e.g. Arjun Singh" autoComplete="name" required />
                  </div>
                  <div>
                    <label htmlFor="f-phone" className="block font-display text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Phone (WhatsApp)</label>
                    <input id="f-phone" type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)}
                      className="aw-input" placeholder="10-digit Indian mobile" autoComplete="tel" inputMode="tel" required />
                  </div>
                  <button type="submit" disabled={submitting}
                    className="aw-btn w-full justify-center py-3.5 text-sm" style={{ borderRadius:14 }}>
                    {submitting ? '⏳ Saving…' : 'Join the first 100 →'}
                  </button>
                  <AnimatePresence>
                    {foundingMsg && (
                      <motion.p key="msg"
                        initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
                        className={`text-sm text-center font-medium ${
                          foundingMsg.includes('Welcome') || foundingMsg.includes('🎉')
                            ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                        {foundingMsg}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </form>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ═══════ EARN (dark) ═══════ */}
        <div className="bg-slate-50"><WaveDivider flip color="var(--navy)" /></div>
        <section className="py-16 sm:py-20 relative" style={{ background:'var(--navy)' }}>
          <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12">
            <motion.div className="text-center mb-10"
              initial={{ opacity:0, y:16 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
              <span className="aw-badge">Partner With Us</span>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">Earn with AuroWater</h2>
            </motion.div>
            <div className="grid md:grid-cols-2 gap-5">
              {EARN_CARDS.map((c, i) => (
                <motion.div key={c.title}
                  className="rounded-3xl p-7 sm:p-8"
                  style={{ border:`1.5px solid ${c.borderColor}`, background:c.bgColor, backdropFilter:'blur(12px)' }}
                  initial={{ opacity:0, y:22 }} whileInView={{ opacity:1, y:0 }}
                  viewport={{ once:true }} transition={{ delay:i*.1 }}>
                  <div className="text-3xl mb-3">{c.icon}</div>
                  <h3 className="font-display text-lg font-extrabold text-white mb-1">{c.title}</h3>
                  <div className="font-display text-2xl font-extrabold mb-3" style={{ color:c.earnColor }}>{c.earn}</div>
                  <p className="text-sm text-slate-300/72 mb-5 leading-relaxed">{c.desc}</p>
                  <Link href={c.href}
                    className={`inline-flex items-center justify-center rounded-full bg-gradient-to-r ${c.btnClass} text-white px-6 py-3 text-sm font-bold font-display shadow hover:opacity-90 transition`}>
                    {c.cta}
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════ FINAL CTA ═══════ (gradient meets global Footer wave #08111F) */}
        <section
          className="relative overflow-hidden pt-16 pb-6 sm:pt-20 sm:pb-8"
          style={{
            background: 'linear-gradient(180deg, var(--navy) 0%, var(--navy) 45%, #08111F 100%)',
          }}
        >
          <div className="absolute inset-0 pointer-events-none"
            style={{ background:'radial-gradient(ellipse 80% 60% at 50% 50%,rgba(14,165,233,.11) 0%,transparent 70%)' }}
            aria-hidden="true" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
            {[1,2,3].map(i => (
              <div key={i} className="aw-ring absolute rounded-full border border-sky-400/10"
                style={{ width:i*200, height:i*200, animationDelay:`${i*.7}s` }} />
            ))}
          </div>

          <div className="relative max-w-4xl mx-auto px-5 sm:px-8 text-center">
            <motion.div initial={{ opacity:0, y:24 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
              <span className="aw-badge">Get Started Today</span>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-5">
                Water shouldn&apos;t be a<br className="hidden sm:block" /> daily headache.
              </h2>
              <p className="text-base sm:text-lg text-slate-300/72 mb-8 max-w-2xl mx-auto leading-relaxed">
                AuroWater keeps your cans filled, pumps running, and events flowing — so you can focus on life, not logistics.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/book" className="aw-btn px-8 py-4 text-base shadow-2xl">💧 Start in 30 seconds →</Link>
                <Link href="/pricing" className="aw-btn-ol px-8 py-4 text-base">View transparent pricing</Link>
              </div>
            </motion.div>
          </div>
        </section>

      </div>
    </>
  );
}
