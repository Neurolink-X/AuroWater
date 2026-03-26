'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */
type ServiceKey = 'water_can' | 'water_tanker' | 'ro_service' | 'plumbing' | 'borewell' | 'motor_pump' | 'tank_cleaning';
type ServiceCategory = 'All' | 'Water' | 'Plumbing' | 'Electrical' | 'Cleaning';

type Service = {
  key: ServiceKey;
  category: Exclude<ServiceCategory, 'All'>;
  title: string;
  tag: string;
  fromPrice: number;
  unit: string;
  desc: string;
  accent: string;
  accentLight: string;
  includes: string[];
  badge?: string;
};

/* ─────────────────────────────────────────────
   DATA  (all errors fixed — fromPrice is always a number)
───────────────────────────────────────────── */
const SERVICES: Service[] = [
  {
    key: 'water_can',
    category: 'Water',
    title: 'RO Water Can',
    tag: 'Most Ordered',
    fromPrice: 10,
    unit: '/ can',
    desc: 'Sealed 20L RO cans delivered to your door. BIS certified, no hidden charges.',
    accent: '#1D6FC4',
    accentLight: '#EFF6FF',
    includes: ['BIS Certified 20L cans', 'Same-day delivery', 'Subscription discounts'],
    badge: 'From ₹10',
  },
  {
    key: 'water_tanker',
    category: 'Water',
    title: 'Water Tanker Delivery',
    tag: 'Bulk Orders',
    fromPrice: 299,
    unit: '/ delivery',
    desc: 'Fresh tanker delivery with reliable scheduling for homes, offices, and events.',
    accent: '#0284C7',
    accentLight: '#F0F9FF',
    includes: ['Priority slot confirmation', 'Clean delivery protocols', 'Live tracking updates'],
  },
  {
    key: 'ro_service',
    category: 'Plumbing',
    title: 'RO Service & Repair',
    tag: 'Filter Experts',
    fromPrice: 199,
    unit: '/ visit',
    desc: 'Filter change, AMC options, and repairs. Fast diagnostics with fair pricing.',
    accent: '#0369A1',
    accentLight: '#E0F2FE',
    includes: ['Filter replacement', 'One-time repairs', 'AMC-friendly service'],
  },
  {
    key: 'plumbing',
    category: 'Plumbing',
    title: 'Plumbing Services',
    tag: 'Quick Fix',
    fromPrice: 149,
    unit: '/ visit',
    desc: 'Leaks, fittings, pipe repair and more. Clear estimates before work begins.',
    accent: '#1E40AF',
    accentLight: '#EFF6FF',
    includes: ['Leak fixing', 'Fittings & repair', 'Pipe maintenance'],
  },
  {
    key: 'borewell',
    category: 'Plumbing',
    title: 'Borewell Services',
    tag: 'Deep Work',
    fromPrice: 499,
    unit: '/ service',
    desc: 'Boring, installation, and repairs. Dependable scheduling, transparent options.',
    accent: '#1D4ED8',
    accentLight: '#EEF2FF',
    includes: ['Borewell repair', 'New installation', 'Diagnostic support'],
  },
  {
    key: 'motor_pump',
    category: 'Electrical',
    title: 'Motor Pump Repair',
    tag: 'Certified',
    fromPrice: 249,
    unit: '/ visit',
    desc: 'Submersible & motor pump servicing with transparent pricing and quick turnaround.',
    accent: '#2563EB',
    accentLight: '#EFF6FF',
    includes: ['Motor servicing', 'Pump repair', 'System health check'],
  },
  {
    key: 'tank_cleaning',
    category: 'Cleaning',
    title: 'Water Tank Cleaning',
    tag: 'Hygienic',
    fromPrice: 349,
    unit: '/ tank',
    desc: 'Hygienic tank sanitation & disinfection. Safer water for your daily needs.',
    accent: '#075985',
    accentLight: '#F0F9FF',
    includes: ['Deep clean & sanitization', 'Disinfection spray', 'After-care guidance'],
  },
];

const CATEGORIES: ServiceCategory[] = ['All', 'Water', 'Plumbing', 'Electrical', 'Cleaning'];

const CATEGORY_ICONS: Record<ServiceCategory, string> = {
  All: '◈', Water: '⬡', Plumbing: '⚙', Electrical: '⚡', Cleaning: '✦',
};

/* ─────────────────────────────────────────────
   SVG ICONS
───────────────────────────────────────────── */
const IconCheck = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
    <circle cx="6" cy="6" r="6" fill="currentColor" fillOpacity={0.15}/>
    <path d="M3.5 6l1.8 1.8 3.2-3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconArrow = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconDroplet = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" fill="currentColor" fillOpacity={0.25}/>
    <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
  </svg>
);

/* ─────────────────────────────────────────────
   SERVICE CARD
───────────────────────────────────────────── */
function ServiceCard({ s, index }: { s: Service; index: number }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  return (
    <article
      className="sv-card"
      style={{ animationDelay: `${index * 70}ms` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top color stripe */}
      <div className="sv-card-stripe" style={{ background: hovered ? s.accent : '#E8F0FE' }} />

      {/* Category tag */}
      <div className="sv-card-tag" style={{ color: s.accent, background: s.accentLight }}>
        {s.tag}
      </div>

      <div className="sv-card-body">
        {/* Icon + Title */}
        <div className="sv-card-top">
          <div
            className="sv-card-icon"
            style={{
              background: hovered ? s.accent : s.accentLight,
              border: `1.5px solid ${hovered ? s.accent : s.accent + '33'}`,
              transform: hovered ? 'scale(1.08) rotate(-4deg)' : 'scale(1)',
              color: hovered ? '#fff' : s.accent,
            }}
          >
            <IconDroplet />
          </div>

          <div className="sv-card-title-wrap">
            <h3 className="sv-card-title">{s.title}</h3>
            <span className="sv-card-category" style={{ color: s.accent }}>{s.category}</span>
          </div>

          {/* Price */}
          <div className="sv-card-price-wrap">
            <div className="sv-card-from">From</div>
            <div className="sv-card-price" style={{ color: s.accent }}>
              ₹{s.fromPrice.toLocaleString('en-IN')}
            </div>
            <div className="sv-card-unit">{s.unit}</div>
          </div>
        </div>

        {/* Description */}
        <p className="sv-card-desc">{s.desc}</p>

        {/* Divider */}
        <div className="sv-card-divider" />

        {/* Includes */}
        <div className="sv-card-includes">
          <div className="sv-includes-label">What's included</div>
          <ul className="sv-includes-list">
            {s.includes.map((it) => (
              <li key={it} className="sv-includes-item" style={{ color: '#374151' }}>
                <span style={{ color: s.accent }}><IconCheck /></span>
                {it}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={() => router.push(`/book?service=${encodeURIComponent(s.key)}`)}
          className="sv-cta"
          style={{
            background: hovered ? s.accent : 'transparent',
            border: `1.5px solid ${s.accent}`,
            color: hovered ? '#fff' : s.accent,
            boxShadow: hovered ? `0 8px 24px ${s.accent}40` : 'none',
          }}
        >
          <span>Book Now</span>
          <IconArrow />
        </button>
      </div>

      {/* Hover glow */}
      <div
        className="sv-card-glow"
        style={{
          background: `radial-gradient(circle at 50% 100%, ${s.accent}12, transparent 70%)`,
          opacity: hovered ? 1 : 0,
        }}
      />
    </article>
  );
}

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
export default function ServicesPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<ServiceCategory>('All');
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => filter === 'All' ? SERVICES : SERVICES.filter((s) => s.category === filter),
    [filter],
  );

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@300;400;500;600;700&display=swap');

        /* ── Base ── */
        .sv-page { font-family: 'DM Sans', sans-serif; min-height: 100vh; background: #F0F4FF; }
        .sv-syne { font-family: 'Syne', sans-serif; }

        /* ══ HERO ══════════════════════════════════════════ */
        .sv-hero {
          position: relative;
          background: linear-gradient(150deg, #0A1628 0%, #0F2557 45%, #1A3A8F 100%);
          overflow: hidden;
          padding: 68px 24px 100px;
          text-align: center;
        }

        /* Grid overlay */
        .sv-hero-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(99,155,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,155,255,0.06) 1px, transparent 1px);
          background-size: 52px 52px;
          pointer-events: none;
        }

        /* Animated orb */
        .sv-hero-orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          animation: orbDrift 8s ease-in-out infinite;
        }
        @keyframes orbDrift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(30px, -20px) scale(1.05); }
          66%       { transform: translate(-20px, 15px) scale(0.96); }
        }

        /* Ripple rings */
        .sv-ripple {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(99,155,255,0.2);
          pointer-events: none;
          animation: rippleGrow 5s ease-out infinite;
        }
        .sv-ripple-2 { animation-delay: 1.7s; }
        .sv-ripple-3 { animation-delay: 3.4s; }
        @keyframes rippleGrow {
          0%   { transform: scale(0.5); opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }

        /* Floating particles */
        .sv-particle {
          position: absolute;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          animation: particleDrift 7s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes particleDrift {
          0%   { opacity: 0;   transform: rotate(-45deg) translateY(0) scale(0.4); }
          20%  { opacity: 0.7; }
          80%  { opacity: 0.3; }
          100% { opacity: 0;   transform: rotate(-45deg) translateY(-100px) scale(1); }
        }

        /* Wave bottom */
        .sv-wave { position: absolute; bottom: -2px; left: 0; right: 0; height: 100px; pointer-events: none; }
        .sv-wave-path { animation: waveShift 7s ease-in-out infinite; }
        .sv-wave-path-2 { animation: waveShift 9s ease-in-out infinite reverse; opacity: 0.5; }
        @keyframes waveShift { 0%, 100% { d: path("M0,60 C240,90 480,20 720,60 C960,100 1200,30 1440,60 L1440,100 L0,100 Z"); } 50% { d: path("M0,40 C200,80 500,10 720,50 C940,90 1200,40 1440,40 L1440,100 L0,100 Z"); } }

        /* Hero text */
        .sv-hero-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(99,155,255,0.12); border: 1px solid rgba(99,155,255,0.3);
          padding: 6px 16px; border-radius: 99px;
          font-size: 11px; font-weight: 700; color: #93C5FD;
          letter-spacing: 0.1em; text-transform: uppercase;
          margin-bottom: 18px;
          animation: fadeSlide 0.6s ease both;
        }
        .sv-hero-title {
          font-family: 'Syne', sans-serif; font-weight: 900;
          font-size: clamp(2.2rem, 5vw, 3.8rem);
          color: #fff; letter-spacing: -2px; line-height: 1.0;
          margin: 0 0 14px;
          animation: fadeSlide 0.6s 0.1s ease both;
        }
        .sv-hero-title span { color: #60A5FA; }
        .sv-hero-sub {
          font-size: clamp(0.9rem, 1.8vw, 1.05rem);
          color: rgba(255,255,255,0.55); max-width: 480px;
          margin: 0 auto; line-height: 1.65;
          animation: fadeSlide 0.6s 0.2s ease both;
        }
        .sv-hero-stats {
          display: flex; justify-content: center;
          gap: 10px; flex-wrap: wrap; margin-top: 28px;
          animation: fadeSlide 0.6s 0.3s ease both;
        }
        .sv-stat {
          display: flex; align-items: center; gap: 7px;
          background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);
          backdrop-filter: blur(8px);
          padding: 8px 15px; border-radius: 99px;
          font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.8);
        }
        .sv-stat-dot { width: 6px; height: 6px; border-radius: 50%; background: #60A5FA; }

        @keyframes fadeSlide { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }

        /* ══ FILTER BAR ════════════════════════════════════ */
        .sv-filter-bar {
          position: sticky; top: 0; z-index: 40;
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid #E8EEFF;
          transition: box-shadow 0.2s;
        }
        .sv-filter-bar.scrolled { box-shadow: 0 4px 24px rgba(29,111,196,0.10); }
        .sv-filter-inner {
          max-width: 1160px; margin: 0 auto;
          padding: 12px 24px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; flex-wrap: wrap;
        }
        .sv-filter-pills { display: flex; gap: 8px; flex-wrap: wrap; }
        .sv-pill {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 99px;
          font-size: 13px; font-weight: 600;
          border: 1.5px solid #E2E8F0;
          background: #fff; color: #64748B;
          cursor: pointer; transition: all 0.18s;
        }
        .sv-pill:hover { border-color: #93C5FD; color: #1D6FC4; background: #EFF6FF; }
        .sv-pill.active { background: #1D6FC4; color: #fff; border-color: #1D6FC4; box-shadow: 0 4px 14px rgba(29,111,196,0.25); }
        .sv-pill-icon { font-size: 13px; }
        .sv-count {
          font-size: 11px; font-weight: 700;
          color: #9CA3AF;
          white-space: nowrap;
          font-family: 'Syne', sans-serif;
        }

        /* ══ BODY ══════════════════════════════════════════ */
        .sv-body { max-width: 1160px; margin: 0 auto; padding: 40px 24px 80px; }

        /* Section heading */
        .sv-section-head {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 12px; flex-wrap: wrap; margin-bottom: 28px;
        }
        .sv-section-title {
          font-family: 'Syne', sans-serif; font-weight: 900;
          font-size: 1.5rem; color: #0A1628; letter-spacing: -0.5px; margin: 0;
        }
        .sv-section-sub { font-size: 13px; color: #6B7280; margin: 4px 0 0; }

        /* ══ GRID ══════════════════════════════════════════ */
        .sv-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 22px;
        }

        /* ══ CARD ══════════════════════════════════════════ */
        .sv-card {
          background: #fff;
          border-radius: 22px;
          border: 1px solid #E8EEFF;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04), 0 6px 20px rgba(29,111,196,0.05);
          overflow: hidden;
          position: relative;
          transition: transform 0.25s ease, box-shadow 0.25s ease;
          animation: cardRise 0.5s ease both;
        }
        .sv-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.04), 0 16px 48px rgba(29,111,196,0.12);
        }
        @keyframes cardRise { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }

        .sv-card-stripe { height: 3px; width: 100%; transition: background 0.3s; }

        .sv-card-tag {
          position: absolute; top: 18px; right: 18px;
          font-size: 9px; font-weight: 800;
          letter-spacing: 0.1em; text-transform: uppercase;
          padding: 3px 9px; border-radius: 99px;
        }

        .sv-card-body { padding: 20px 22px 22px; }

        .sv-card-top { display: flex; align-items: flex-start; gap: 13px; margin-bottom: 12px; }
        .sv-card-icon {
          width: 44px; height: 44px; border-radius: 13px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: all 0.25s ease;
        }

        .sv-card-title-wrap { flex: 1; min-width: 0; }
        .sv-card-title {
          font-family: 'Syne', sans-serif; font-weight: 900;
          font-size: 0.95rem; color: #0A1628;
          letter-spacing: -0.3px; margin: 0 0 3px;
          line-height: 1.2;
        }
        .sv-card-category { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }

        .sv-card-price-wrap { text-align: right; flex-shrink: 0; }
        .sv-card-from { font-size: 9px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.07em; }
        .sv-card-price { font-family: 'Syne', sans-serif; font-weight: 900; font-size: 22px; letter-spacing: -1px; line-height: 1.1; }
        .sv-card-unit { font-size: 10px; color: #9CA3AF; font-weight: 500; margin-top: 1px; }

        .sv-card-desc { font-size: 13px; color: #6B7280; line-height: 1.55; margin: 0 0 14px; }

        .sv-card-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, #E8EEFF 30%, #E8EEFF 70%, transparent);
          margin-bottom: 14px;
        }

        .sv-card-includes { margin-bottom: 18px; }
        .sv-includes-label { font-size: 10px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
        .sv-includes-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .sv-includes-item { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 500; }

        .sv-cta {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 12px 20px; border-radius: 12px;
          font-family: 'DM Sans', sans-serif; font-weight: 700; font-size: 13px;
          cursor: pointer; transition: all 0.2s ease;
          letter-spacing: -0.1px;
        }
        .sv-cta:active { transform: scale(0.97); }

        .sv-card-glow {
          position: absolute; inset: 0;
          pointer-events: none;
          transition: opacity 0.3s;
        }

        /* ══ CTA BANNER ════════════════════════════════════ */
        .sv-banner {
          margin-top: 52px;
          border-radius: 24px;
          background: linear-gradient(135deg, #0A1628 0%, #0F2557 60%, #1A3A8F 100%);
          padding: 44px 48px;
          position: relative;
          overflow: hidden;
        }
        .sv-banner::before {
          content: '';
          position: absolute; inset: 0;
          background: repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.02) 20px, rgba(255,255,255,0.02) 40px);
        }
        .sv-banner-orb {
          position: absolute; top: -60px; right: -60px;
          width: 240px; height: 240px; border-radius: 50%;
          background: radial-gradient(circle, rgba(96,165,250,0.15), transparent 70%);
          pointer-events: none;
        }
        .sv-banner-content { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 28px; flex-wrap: wrap; }
        .sv-banner-eyebrow { font-size: 10px; font-weight: 700; color: #93C5FD; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 8px; }
        .sv-banner-title { font-family: 'Syne', sans-serif; font-weight: 900; font-size: clamp(1.4rem, 3vw, 2rem); color: #fff; letter-spacing: -1px; line-height: 1.1; margin: 0; }
        .sv-banner-title span { color: #60A5FA; }
        .sv-banner-sub { font-size: 13px; color: rgba(255,255,255,0.5); margin-top: 8px; }
        .sv-banner-btn {
          display: inline-flex; align-items: center; gap: 9px;
          padding: 15px 28px; border-radius: 14px;
          background: #fff; color: #1D4ED8;
          font-family: 'DM Sans', sans-serif; font-weight: 800; font-size: 14px;
          border: none; cursor: pointer;
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
          transition: all 0.2s; white-space: nowrap;
          letter-spacing: -0.2px;
        }
        .sv-banner-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,0,0,0.25); }
        .sv-banner-btn:active { transform: scale(0.97); }

        /* ══ RESPONSIVE ════════════════════════════════════ */
        @media (max-width: 1024px) {
          .sv-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .sv-hero { padding: 52px 20px 88px; }
          .sv-body { padding: 28px 16px 60px; }
          .sv-grid { grid-template-columns: 1fr; gap: 16px; }
          .sv-filter-inner { padding: 10px 16px; }
          .sv-banner { padding: 28px 24px; }
          .sv-card-title { font-size: 0.9rem; }
          .sv-section-head { flex-direction: column; align-items: flex-start; }
        }
        @media (max-width: 400px) {
          .sv-hero-title { font-size: 2rem; letter-spacing: -1px; }
          .sv-pill { padding: 7px 12px; font-size: 12px; }
        }
      `}</style>

      <div className="sv-page">

        {/* ══ HERO ══════════════════════════════════════════ */}
        <div className="sv-hero" ref={heroRef}>
          <div className="sv-hero-grid" />

          {/* Glow orbs */}
          <div className="sv-hero-orb" style={{ width: 400, height: 400, top: -100, left: '50%', transform: 'translateX(-50%)', background: 'radial-gradient(circle, rgba(96,165,250,0.15), transparent 70%)' }} />
          <div className="sv-hero-orb" style={{ width: 250, height: 250, bottom: 20, left: '10%', background: 'radial-gradient(circle, rgba(96,165,250,0.1), transparent 70%)', animationDelay: '2s' }} />

          {/* Ripple rings */}
          {[0, 1, 2].map((i) => (
            <div key={i} className={`sv-ripple sv-ripple-${i}`} style={{ width: 160, height: 160, top: '30%', left: '15%', animationDelay: `${i * 1.7}s` }} />
          ))}

          {/* Floating particles */}
          {[
            { left: '7%',  top: '25%', size: 10, delay: '0s',   dur: '6s'  },
            { left: '20%', top: '60%', size: 7,  delay: '1.5s', dur: '7.5s'},
            { left: '80%', top: '20%', size: 11, delay: '0.7s', dur: '5.5s'},
            { left: '73%', top: '65%', size: 8,  delay: '2.2s', dur: '7s'  },
            { left: '52%', top: '12%', size: 6,  delay: '1s',   dur: '6.5s'},
          ].map((p, i) => (
            <div key={i} className="sv-particle" style={{ left: p.left, top: p.top, width: p.size, height: p.size, background: 'rgba(147,197,253,0.5)', animationDelay: p.delay, animationDuration: p.dur }} />
          ))}

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div className="sv-hero-eyebrow">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#60A5FA', display: 'inline-block' }} />
              Trusted across 13 cities in UP
            </div>

            <h1 className="sv-hero-title">
              Every water service<br />
              <span>you'll ever need.</span>
            </h1>

            <p className="sv-hero-sub">
              Verified technicians, transparent pricing, same-day slots. Pick a service and book in under 60 seconds.
            </p>

            <div className="sv-hero-stats">
              {['7 services', '500+ verified pros', 'Upfront pricing', 'Same-day available'].map((s) => (
                <div key={s} className="sv-stat">
                  <span className="sv-stat-dot" />
                  {s}
                </div>
              ))}
            </div>
          </div>

          {/* SVG waves */}
          <svg className="sv-wave" viewBox="0 0 1440 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path fill="#F0F4FF" opacity="0.4" d="M0,50 C240,85 480,15 720,50 C960,85 1200,20 1440,50 L1440,100 L0,100 Z" />
            <path fill="#F0F4FF" opacity="0.6" d="M0,65 C200,40 500,88 720,65 C940,42 1200,82 1440,65 L1440,100 L0,100 Z" />
            <path fill="#F0F4FF" d="M0,80 C180,65 360,92 540,80 C720,68 900,88 1080,78 C1260,68 1360,84 1440,80 L1440,100 L0,100 Z" />
          </svg>
        </div>

        {/* ══ FILTER BAR ══════════════════════════════════════ */}
        <div className={`sv-filter-bar${scrolled ? ' scrolled' : ''}`}>
          <div className="sv-filter-inner">
            <div className="sv-filter-pills">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilter(cat)}
                  className={`sv-pill${filter === cat ? ' active' : ''}`}
                >
                  <span className="sv-pill-icon">{CATEGORY_ICONS[cat]}</span>
                  {cat}
                </button>
              ))}
            </div>
            <div className="sv-count">
              {filtered.length} service{filtered.length !== 1 ? 's' : ''} found
            </div>
          </div>
        </div>

        {/* ══ BODY ════════════════════════════════════════════ */}
        <div className="sv-body">

          <div className="sv-section-head">
            <div>
              <h2 className="sv-section-title">
                {filter === 'All' ? 'All Services' : `${filter} Services`}
              </h2>
              <p className="sv-section-sub">Transparent pricing · Verified pros · Book in 60 seconds</p>
            </div>
          </div>

          {/* Cards grid */}
          <div className="sv-grid">
            {filtered.map((s, i) => (
              <ServiceCard key={s.key} s={s} index={i} />
            ))}
          </div>

          {/* CTA Banner */}
          <div className="sv-banner">
            <div className="sv-banner-orb" />
            <div className="sv-banner-content">
              <div>
                <div className="sv-banner-eyebrow">Full transparency</div>
                <h3 className="sv-banner-title">
                  Want to compare<br />
                  <span>all prices first?</span>
                </h3>
                <p className="sv-banner-sub">No hidden fees. No surprises. See the full pricing breakdown.</p>
              </div>
              <button
                type="button"
                onClick={() => router.push('/pricing')}
                className="sv-banner-btn"
              >
                <IconDroplet />
                View Full Pricing
                <IconArrow />
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}










// 'use client';

// import React, { useMemo, useState } from 'react';
// import { useRouter } from 'next/navigation';

// type ServiceKey =
//   | 'water_tanker'
//   | 'ro_service'
//   | 'plumbing'
//   | 'borewell'
//   | 'motor_pump'
//   | 'tank_cleaning';

// type ServiceCategory = 'All' | 'Water' | 'Plumbing' | 'Electrical' | 'Cleaning';

// type Service = {
//   key: ServiceKey;
//   category: Exclude<ServiceCategory, 'All'>;
//   emoji: string;
//   title: string;
//   fromPrice: number;
//   desc: string;
//   color: string; // hex
//   includes: string[];
// };

// const SERVICES: Service[] = [

//   {
//     key: 'RO Can',
//     category: 'Water',
//     emoji: '💧',
//     title: 'Water Tanker Delivery',
//     fromPrice: 10 rupey/can,
//     desc: 'Fresh water can with delivery with reliable scheduling for homes, offices, and events.',
//     color: '#38BDF8',
//     includes: ['Priority slot confirmation', 'Clean delivery protocols', 'Live updates'],
//   },
//   {
//     key: 'water_tanker',
//     category: 'Water',
//     emoji: '💧',
//     title: 'Water Tanker Delivery',
//     fromPrice: 299,
//     desc: 'Fresh tanker delivery with reliable scheduling for homes, offices, and events.',
//     color: '#38BDF8',
//     includes: ['Priority slot confirmation', 'Clean delivery protocols', 'Live updates'],
//   },
//   {
//     key: 'ro_service',
//     category: 'Plumbing',
//     emoji: '🔧',
//     title: 'RO Service & Repair',
//     fromPrice: 199,
//     desc: 'Filter change, AMC options, and repairs. Fast diagnostics with fair pricing.',
//     color: '#0D9B6C',
//     includes: ['Filter change options', 'One-time repairs', 'AMC-friendly service'],
//   },
//   {
//     key: 'plumbing',
//     category: 'Plumbing',
//     emoji: '🪠',
//     title: 'Plumbing Services',
//     fromPrice: 149,
//     desc: 'Leaks, fittings, pipe repair, and more. Clear estimates before work begins.',
//     color: '#FEF3C7',
//     includes: ['Leak fixing', 'Fittings & repair', 'Pipe maintenance support'],
//   },
//   {
//     key: 'borewell',
//     category: 'Plumbing',
//     emoji: '⛏️',
//     title: 'Borewell Services',
//     fromPrice: 499,
//     desc: 'Boring, installation, and repairs. Dependable scheduling with transparent options.',
//     color: '#E0E7FF',
//     includes: ['Borewell repair', 'Installation options', 'Diagnostic support'],
//   },
//   {
//     key: 'motor_pump',
//     category: 'Electrical',
//     emoji: '⚙️',
//     title: 'Motor Pump Repair',
//     fromPrice: 249,
//     desc: 'Submersible & motor pump servicing with transparent pricing and quick turnaround.',
//     color: '#FCE7F3',
//     includes: ['Motor servicing', 'Pump repair', 'System checks'],
//   },
//   {
//     key: 'tank_cleaning',
//     category: 'Cleaning',
//     emoji: '🪣',
//     title: 'Water Tank Cleaning',
//     fromPrice: 349,
//     desc: 'Hygienic tank sanitation & disinfection. Safer water usage for daily needs.',
//     color: '#ECFDF5',
//     includes: ['Deep clean & sanitization', 'Safety-first handling', 'After-care guidance'],
//   },
// ];

// export default function ServicesPage() {
//   const router = useRouter();
//   const [filter, setFilter] = useState<ServiceCategory>('All');

//   const filtered = useMemo(() => {
//     if (filter === 'All') return SERVICES;
//     return SERVICES.filter((s) => s.category === filter);
//   }, [filter]);

//   return (
//     <div className="min-h-screen gradient-section">
//       <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
//         <h1 className="text-[clamp(1.75rem,5vw,3.5rem)] font-extrabold text-[#0F1C18]">Our Services</h1>
//         <p className="text-base sm:text-lg text-slate-600 mt-3">
//           Filter services and book in seconds. Transparent pricing, verified pros.
//         </p>
//       </section>

//       <div className="sticky top-20 z-40 bg-white/90 backdrop-blur-md border-y border-slate-100">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
//           <div className="flex flex-wrap gap-2">
//             {(['All', 'Water', 'Plumbing', 'Electrical', 'Cleaning'] as const).map((p) => {
//               const active = filter === p;
//               return (
//                 <button
//                   key={p}
//                   type="button"
//                   onClick={() => setFilter(p)}
//                   className={[
//                     'px-4 py-2 rounded-full border text-sm font-semibold transition-all duration-150',
//                     active
//                       ? 'border-[#0D9B6C] bg-[#E8F8F2] text-[#0D9B6C]'
//                       : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
//                   ].join(' ')}
//                 >
//                   {p}
//                 </button>
//               );
//             })}
//           </div>
//         </div>
//       </div>

//       <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-20">
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
//           {filtered.map((s) => (
//             <article
//               key={s.key}
//               className="rounded-2xl bg-white border border-slate-100 shadow-card overflow-hidden group relative"
//             >
//               <div className="p-6">
//                 <div className="flex items-start justify-between gap-4">
//                   <div>
//                     <div className="flex items-center gap-3">
//                       <div
//                         className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-[#E8F8F2] transition-transform duration-150 group-hover:scale-[1.1]"
//                         style={{ backgroundColor: `${s.color}33` }}
//                       >
//                         {s.emoji}
//                       </div>
//                       <div className="font-extrabold text-[#0F1C18] leading-tight">{s.title}</div>
//                     </div>
//                     <p className="text-sm text-slate-600 mt-3">{s.desc}</p>
//                     <div className="mt-4 flex flex-wrap gap-2">
//                       {s.includes.slice(0, 2).map((it) => (
//                         <span
//                           key={it}
//                           className="text-xs font-semibold px-3 py-1 rounded-full border border-slate-200 text-slate-600 bg-white"
//                         >
//                           {it}
//                         </span>
//                       ))}
//                     </div>
//                   </div>
//                   <div className="text-right">
//                     <div className="text-xs font-semibold text-slate-500">From</div>
//                     <div className="text-2xl font-extrabold text-[#0D9B6C] bg-clip-text">
//                       ₹{s.fromPrice.toLocaleString('en-IN')}
//                     </div>
//                   </div>
//                 </div>

//                 <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 transition-all duration-150 group-hover:bg-slate-50">
//                   <div className="text-sm font-bold text-slate-800">Includes</div>
//                   <ul className="text-sm text-slate-600 mt-2 space-y-1">
//                     {s.includes.map((it) => (
//                       <li key={it}>✓ {it}</li>
//                     ))}
//                   </ul>
//                 </div>

//                 <button
//                   type="button"
//                   onClick={() => router.push(`/book?service=${encodeURIComponent(s.key)}`)}
//                   className="mt-5 w-full rounded-xl bg-[#0D9B6C] text-white font-extrabold py-3 shadow-sm hover:bg-[#086D4C] active:scale-95 transition-all duration-150 group-hover:pr-1"
//                 >
//                   <span className="inline-flex items-center justify-center gap-2">
//                     Book Now <span className="transform transition-transform group-hover:translate-x-1">→</span>
//                   </span>
//                 </button>
//               </div>

//               <div
//                 className="absolute left-0 top-0 bottom-0 w-1 opacity-0 group-hover:opacity-100 transition-opacity"
//                 style={{ backgroundColor: s.color }}
//               />
//               <div
//                 className="absolute inset-x-0 bottom-0 h-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
//                 style={{ background: `linear-gradient(90deg, ${s.color}33, transparent)` }}
//               />
//             </article>
//           ))}
//         </div>

//         <div className="mt-10 text-center">
//           <button
//             type="button"
//             onClick={() => router.push('/pricing')}
//             className="inline-flex items-center justify-center px-6 py-3 rounded-xl border-2 border-[#0D9B6C] text-[#0D9B6C] font-extrabold hover:bg-[#E8F8F2] active:scale-95 transition-all"
//           >
//             View pricing details →
//           </button>
//         </div>
//       </section>
//     </div>
//   );
// }
