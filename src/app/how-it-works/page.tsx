'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/* ─────────────────────────────────────────────
   ICONS
───────────────────────────────────────────── */
const IconPin = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const IconGrid = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);
const IconCalendar = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IconShield = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>
);
const IconArrow = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="8" fill="currentColor" fillOpacity="0.12"/>
    <path d="M5 8l2.2 2.2 3.8-4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconChevron = ({ open }: { open: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transition: 'transform 0.25s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconDroplet = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" fill="currentColor" fillOpacity="0.2"/>
    <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
  </svg>
);
const IconStar = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="#FBBF24">
    <path d="M8 1l1.8 4h4.2l-3.4 2.6 1.3 4L8 9.2l-3.9 2.4 1.3-4L2 5h4.2z"/>
  </svg>
);

/* ─────────────────────────────────────────────
   DATA
───────────────────────────────────────────── */
const STEPS = [
  {
    step: '01', icon: <IconPin />, color: '#2563EB', light: '#EFF6FF',
    title: 'Share your address',
    desc: 'Enter your location or pick a saved address. We use it for scheduling, technician matching, and accurate pricing.',
    detail: 'Works for homes, offices, apartments & events',
  },
  {
    step: '02', icon: <IconGrid />, color: '#0891B2', light: '#ECFEFF',
    title: 'Choose your service',
    desc: 'Browse 7 categories. Tap the one you need — RO service, water cans, plumbing, borewell, motor pump, or tank cleaning.',
    detail: 'Upfront pricing shown before you confirm',
  },
  {
    step: '03', icon: <IconCalendar />, color: '#7C3AED', light: '#F5F3FF',
    title: 'Pick a date & time',
    desc: 'Select a convenient slot. Same-day emergency options are available in most cities depending on technician availability.',
    detail: 'Flexible rescheduling up to 2 hours before',
  },
  {
    step: '04', icon: <IconShield />, color: '#059669', light: '#ECFDF5',
    title: 'We handle everything',
    desc: 'A verified pro arrives on time. Track your booking live in the dashboard. Pay on completion — zero surprises.',
    detail: 'Rated 4.8★ across 3,000+ jobs',
  },
];

const TECH_STEPS = ['Sign up for free', 'Upload ID & skills', 'Pass verification', 'Start accepting jobs & earn'];
const SUPPLIER_STEPS = ['Get your AuroTap ID', 'Receive direct orders', 'Manage delivery fleet', 'Grow your water business'];

const FAQ = [
  { q: 'How fast is delivery?', a: 'Most cities have same-day slots. For water cans, we target delivery within 3 hours. Emergency options depend on technician availability in your area.' },
  { q: 'What areas do you serve?', a: 'We operate across 13 UP cities including Kanpur, Lucknow, Varanasi, Gorakhpur, Prayagraj, Agra, Meerut and more. Enter your pincode to check availability.' },
  { q: 'How do I track my booking?', a: 'After booking confirmation, visit "Dashboard" to see a live status timeline — Pending → Assigned → En Route → Completed.' },
  { q: 'Can I reschedule or cancel?', a: 'Pending bookings can be rescheduled anytime. Accepted jobs can be adjusted up to 2 hours before the slot. Contact support for urgent changes.' },
  { q: 'How are technicians verified?', a: 'Every technician goes through a 3-step process: ID verification, skill assessment, and an onboarding call. Only verified pros receive job requests.' },
  { q: 'What payment methods are accepted?', a: 'Cash on service completion is the primary method today. Online payment (UPI, cards) is rolling out city by city — check your booking confirmation for your area.' },
];

const TRUST_STATS = [
  { value: '3,200+', label: 'Jobs completed', icon: '✦' },
  { value: '4.8★',   label: 'Average rating',  icon: '◈' },
  { value: '13',     label: 'Cities covered',  icon: '⬡' },
  { value: '<3hr',   label: 'Avg response',    icon: '⚡' },
];

/* ─────────────────────────────────────────────
   ANIMATED STEP CARD
───────────────────────────────────────────── */
function StepCard({ step, index, active, onClick }: { step: typeof STEPS[number]; index: number; active: boolean; onClick: () => void }) {
  return (
    <div
      className={`hiw-step-card${active ? ' hiw-step-card-active' : ''}`}
      style={{
        animationDelay: `${index * 100}ms`,
        borderColor: active ? step.color + '40' : undefined,
        boxShadow: active ? `0 8px 32px ${step.color}18` : undefined,
      }}
      onClick={onClick}
    >
      {/* Number */}
      <div className="hiw-step-num" style={{ color: step.color, background: step.light }}>
        {step.step}
      </div>

      {/* Icon bubble */}
      <div
        className="hiw-step-icon"
        style={{
          background: active ? step.color : step.light,
          color: active ? '#fff' : step.color,
          border: `1.5px solid ${active ? step.color : step.color + '30'}`,
        }}
      >
        {step.icon}
      </div>

      {/* Text */}
      <h3 className="hiw-step-title" style={{ color: active ? step.color : '#0A1628' }}>{step.title}</h3>
      <p className="hiw-step-desc">{step.desc}</p>

      {/* Detail badge */}
      <div className="hiw-step-detail" style={{ color: step.color, background: step.light }}>
        <IconCheck />
        {step.detail}
      </div>

      {/* Active indicator line */}
      <div className="hiw-step-bar" style={{ background: active ? step.color : 'transparent' }} />
    </div>
  );
}

/* ─────────────────────────────────────────────
   FAQ ITEM
───────────────────────────────────────────── */
function FaqItem({ item, open, onToggle }: { item: typeof FAQ[number]; open: boolean; onToggle: () => void }) {
  const bodyRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`hiw-faq-item${open ? ' hiw-faq-open' : ''}`}>
      <button type="button" className="hiw-faq-btn" onClick={onToggle}>
        <span className="hiw-faq-q">{item.q}</span>
        <span className="hiw-faq-icon" style={{ color: open ? '#2563EB' : '#9CA3AF' }}>
          <IconChevron open={open} />
        </span>
      </button>
      <div
        className="hiw-faq-body"
        ref={bodyRef}
        style={{ maxHeight: open ? (bodyRef.current?.scrollHeight ?? 200) + 'px' : '0px' }}
      >
        <p className="hiw-faq-answer">{item.a}</p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
export default function HowItWorksPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  // Auto-advance active step
  useEffect(() => {
    const timer = setInterval(() => setActiveStep((s) => (s + 1) % STEPS.length), 3200);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:wght@300;400;500;600;700&display=swap');

        /* ── Base ── */
        .hiw-page { font-family: 'DM Sans', sans-serif; min-height: 100vh; background: #F5F7FF; }

        /* ══ HERO ══════════════════════════════════════════ */
        .hiw-hero {
          position: relative;
          background: linear-gradient(150deg, #0A1628 0%, #1A2B6B 50%, #1E3A8A 100%);
          padding: 72px 24px 106px;
          overflow: hidden;
          text-align: center;
        }
        .hiw-hero-grid {
          position: absolute; inset: 0;
          background-image: linear-gradient(rgba(99,155,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(99,155,255,0.05) 1px, transparent 1px);
          background-size: 56px 56px;
          pointer-events: none;
        }
        .hiw-hero-glow {
          position: absolute; border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle, rgba(96,165,250,0.18), transparent 70%);
        }
        /* animated flowing water lines */
        .hiw-flow-line {
          position: absolute; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(96,165,250,0.4), transparent);
          pointer-events: none;
          animation: flowRight 5s linear infinite;
        }
        @keyframes flowRight { from { transform: translateX(-100%); } to { transform: translateX(200%); } }

        .hiw-particle {
          position: absolute; border-radius: 50% 50% 50% 0; transform: rotate(-45deg);
          animation: particleLift 7s ease-in-out infinite; pointer-events: none;
        }
        @keyframes particleLift {
          0%   { opacity: 0;   transform: rotate(-45deg) translateY(0) scale(0.4); }
          20%  { opacity: 0.6; }
          80%  { opacity: 0.2; }
          100% { opacity: 0;   transform: rotate(-45deg) translateY(-110px) scale(1); }
        }

        .hiw-hero-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(96,165,250,0.12); border: 1px solid rgba(96,165,250,0.28);
          padding: 6px 16px; border-radius: 99px;
          font-size: 11px; font-weight: 700; color: #93C5FD;
          letter-spacing: 0.1em; text-transform: uppercase;
          margin-bottom: 18px; animation: hiwFadeDown 0.6s ease both;
        }
        .hiw-hero-title {
          font-family: 'Syne', sans-serif; font-weight: 900;
          font-size: clamp(2.2rem, 5.5vw, 4rem);
          color: #fff; letter-spacing: -2.5px; line-height: 0.97;
          margin: 0 0 18px; animation: hiwFadeDown 0.6s 0.1s ease both;
        }
        .hiw-hero-title span { color: #60A5FA; }
        .hiw-hero-sub {
          font-size: clamp(0.9rem, 1.8vw, 1.05rem);
          color: rgba(255,255,255,0.5); max-width: 500px;
          margin: 0 auto 28px; line-height: 1.65;
          animation: hiwFadeDown 0.6s 0.2s ease both;
        }
        .hiw-hero-cta {
          display: inline-flex; align-items: center; gap: 9px;
          padding: 14px 28px; border-radius: 14px;
          background: #2563EB; color: #fff;
          font-family: 'DM Sans', sans-serif; font-weight: 700; font-size: 14px;
          border: none; cursor: pointer;
          box-shadow: 0 6px 20px rgba(37,99,235,0.45);
          transition: all 0.2s; letter-spacing: -0.2px;
          animation: hiwFadeDown 0.6s 0.3s ease both;
        }
        .hiw-hero-cta:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(37,99,235,0.5); }

        .hiw-wave { position: absolute; bottom: -2px; left: 0; right: 0; height: 108px; pointer-events: none; }

        @keyframes hiwFadeDown { from { opacity:0; transform:translateY(-14px); } to { opacity:1; transform:translateY(0); } }

        /* ══ TRUST STRIP ═══════════════════════════════════ */
        .hiw-trust-strip {
          background: #fff;
          border-bottom: 1px solid #E8EEFF;
          padding: 20px 24px;
        }
        .hiw-trust-inner {
          max-width: 1160px; margin: 0 auto;
          display: flex; justify-content: center; gap: 0;
          flex-wrap: wrap;
        }
        .hiw-trust-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 28px; border-right: 1px solid #E8EEFF;
          flex: 1; min-width: 140px; justify-content: center;
        }
        .hiw-trust-item:last-child { border-right: none; }
        .hiw-trust-icon { font-size: 16px; color: #2563EB; }
        .hiw-trust-val { font-family: 'Syne', sans-serif; font-weight: 900; font-size: 1.3rem; color: #0A1628; letter-spacing: -0.5px; line-height: 1; }
        .hiw-trust-lbl { font-size: 11px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.07em; margin-top: 2px; }

        /* ══ BODY ══════════════════════════════════════════ */
        .hiw-body { max-width: 1160px; margin: 0 auto; padding: 52px 24px 80px; }

        /* Section label */
        .hiw-section-label {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 10px; font-weight: 800; letter-spacing: 0.12em;
          text-transform: uppercase; color: #2563EB;
          margin-bottom: 10px;
        }
        .hiw-section-label-dot { width: 6px; height: 6px; border-radius: 50%; background: #2563EB; }
        .hiw-section-title {
          font-family: 'Syne', sans-serif; font-weight: 900;
          font-size: clamp(1.6rem, 3.5vw, 2.4rem);
          color: #0A1628; letter-spacing: -1px; line-height: 1.05; margin: 0;
        }
        .hiw-section-sub { font-size: 14px; color: #6B7280; margin-top: 6px; }

        /* ══ STEPS GRID ════════════════════════════════════ */
        .hiw-steps-grid {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 18px; margin-top: 32px;
          position: relative;
        }
        /* connector line behind cards */
        .hiw-steps-grid::before {
          content: '';
          position: absolute; top: 52px; left: calc(12.5% + 18px); right: calc(12.5% + 18px);
          height: 2px;
          background: linear-gradient(90deg, #2563EB22, #2563EB44 50%, #2563EB22);
          border-radius: 2px; pointer-events: none;
          z-index: 0;
        }

        .hiw-step-card {
          background: #fff; border-radius: 22px;
          border: 1.5px solid #E8EEFF;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04), 0 6px 20px rgba(29,111,196,0.05);
          padding: 24px 20px 22px;
          position: relative; overflow: hidden;
          cursor: pointer; transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
          animation: stepRise 0.5s ease both;
          z-index: 1;
        }
        .hiw-step-card:hover { transform: translateY(-4px); }
        .hiw-step-card-active { transform: translateY(-5px) !important; }
        @keyframes stepRise { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }

        .hiw-step-num {
          display: inline-flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 8px;
          font-family: 'Syne', sans-serif; font-weight: 900; font-size: 12px;
          margin-bottom: 14px;
        }
        .hiw-step-icon {
          width: 52px; height: 52px; border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 16px; transition: all 0.25s ease;
        }
        .hiw-step-title {
          font-family: 'Syne', sans-serif; font-weight: 900;
          font-size: 0.95rem; letter-spacing: -0.3px; margin: 0 0 10px;
          line-height: 1.2; transition: color 0.2s;
        }
        .hiw-step-desc { font-size: 13px; color: #6B7280; line-height: 1.55; margin: 0 0 14px; }
        .hiw-step-detail {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px;
        }
        .hiw-step-bar {
          position: absolute; bottom: 0; left: 0; right: 0; height: 3px;
          transition: background 0.3s;
        }

        /* Step dots navigator */
        .hiw-step-dots {
          display: flex; justify-content: center; gap: 8px; margin-top: 22px;
        }
        .hiw-step-dot {
          height: 6px; border-radius: 3px;
          cursor: pointer; transition: all 0.25s;
          border: none; padding: 0;
        }

        /* ══ PARTNER CARDS ═════════════════════════════════ */
        .hiw-partner-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 22px; margin-top: 32px;
        }

        .hiw-partner-card {
          border-radius: 24px; padding: 34px 32px;
          position: relative; overflow: hidden;
          animation: stepRise 0.5s 0.2s ease both;
        }
        .hiw-partner-card-tech {
          background: linear-gradient(140deg, #0A1628 0%, #1E3A8A 100%);
        }
        .hiw-partner-card-supplier {
          background: linear-gradient(140deg, #0C2340 0%, #0369A1 100%);
        }
        .hiw-partner-blob {
          position: absolute; border-radius: 50%; pointer-events: none;
          animation: blobPulse 5s ease-in-out infinite;
        }
        @keyframes blobPulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.15);} }

        .hiw-partner-tag {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
          color: #93C5FD; background: rgba(96,165,250,0.12);
          border: 1px solid rgba(96,165,250,0.25);
          padding: 4px 12px; border-radius: 99px; margin-bottom: 14px;
        }
        .hiw-partner-title {
          font-family: 'Syne', sans-serif; font-weight: 900;
          font-size: 1.45rem; color: #fff; letter-spacing: -0.5px;
          margin: 0 0 6px;
        }
        .hiw-partner-sub { font-size: 13px; color: rgba(255,255,255,0.55); margin-bottom: 24px; line-height: 1.5; }

        .hiw-partner-steps { display: flex; flex-direction: column; gap: 10px; margin-bottom: 28px; }
        .hiw-partner-step {
          display: flex; align-items: center; gap: 12px;
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px; padding: 10px 14px;
          transition: background 0.2s;
        }
        .hiw-partner-step:hover { background: rgba(255,255,255,0.1); }
        .hiw-partner-step-num {
          width: 28px; height: 28px; border-radius: 8px;
          background: rgba(96,165,250,0.15); border: 1px solid rgba(96,165,250,0.25);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Syne', sans-serif; font-weight: 900; font-size: 11px; color: #93C5FD;
          flex-shrink: 0;
        }
        .hiw-partner-step-text { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.85); }

        .hiw-partner-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 13px 22px; border-radius: 13px;
          font-family: 'DM Sans', sans-serif; font-weight: 700; font-size: 13px;
          cursor: pointer; transition: all 0.2s; letter-spacing: -0.1px;
          border: none; white-space: nowrap;
        }
        .hiw-partner-btn-tech {
          background: #2563EB; color: #fff;
          box-shadow: 0 4px 16px rgba(37,99,235,0.4);
        }
        .hiw-partner-btn-tech:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(37,99,235,0.45); }
        .hiw-partner-btn-supplier {
          background: rgba(255,255,255,0.12); color: #fff;
          border: 1px solid rgba(255,255,255,0.2) !important;
        }
        .hiw-partner-btn-supplier:hover { background: rgba(255,255,255,0.2); transform: translateY(-2px); }

        /* ══ FAQ ═══════════════════════════════════════════ */
        .hiw-faq-wrap { max-width: 780px; margin-top: 32px; display: flex; flex-direction: column; gap: 10px; }

        .hiw-faq-item {
          background: #fff; border-radius: 16px;
          border: 1.5px solid #E8EEFF;
          overflow: hidden; transition: border-color 0.2s, box-shadow 0.2s;
        }
        .hiw-faq-open {
          border-color: #BFDBFE;
          box-shadow: 0 4px 16px rgba(37,99,235,0.08);
        }
        .hiw-faq-btn {
          width: 100%; display: flex; align-items: center;
          justify-content: space-between; gap: 16px;
          padding: 18px 22px; text-align: left;
          background: none; border: none; cursor: pointer;
          transition: background 0.15s;
        }
        .hiw-faq-btn:hover { background: #FAFBFF; }
        .hiw-faq-q { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 0.95rem; color: #0A1628; letter-spacing: -0.2px; }
        .hiw-faq-icon { flex-shrink: 0; }
        .hiw-faq-body {
          overflow: hidden; transition: max-height 0.32s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .hiw-faq-answer {
          padding: 0 22px 18px;
          font-size: 13.5px; color: #6B7280; line-height: 1.65; margin: 0;
          border-top: 1px solid #EEF2FF;
          padding-top: 14px;
        }

        /* ══ BOTTOM CTA ════════════════════════════════════ */
        .hiw-bottom-cta {
          margin-top: 60px; border-radius: 28px;
          background: linear-gradient(135deg, #0A1628 0%, #1E3A8A 60%, #1D4ED8 100%);
          padding: 52px 56px; position: relative; overflow: hidden;
          text-align: center;
        }
        .hiw-cta-rings {
          position: absolute; border-radius: 50%;
          border: 1px solid rgba(96,165,250,0.15);
          pointer-events: none; animation: ringPulse 4s ease-out infinite;
        }
        @keyframes ringPulse { 0%{transform:scale(0.6);opacity:0.8;} 100%{transform:scale(2.2);opacity:0;} }
        .hiw-cta-grid {
          position: absolute; inset: 0;
          background-image: linear-gradient(rgba(99,155,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,155,255,0.04) 1px, transparent 1px);
          background-size: 40px 40px; pointer-events: none;
        }
        .hiw-cta-content { position: relative; z-index: 1; }
        .hiw-cta-title {
          font-family: 'Syne', sans-serif; font-weight: 900;
          font-size: clamp(1.6rem, 3.5vw, 2.6rem);
          color: #fff; letter-spacing: -1.5px; line-height: 1.0; margin: 0 0 12px;
        }
        .hiw-cta-title span { color: #60A5FA; }
        .hiw-cta-sub { font-size: 15px; color: rgba(255,255,255,0.5); margin-bottom: 32px; }
        .hiw-cta-btns { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
        .hiw-cta-btn-primary {
          display: inline-flex; align-items: center; gap: 9px;
          padding: 15px 32px; border-radius: 14px;
          background: #fff; color: #1D4ED8;
          font-family: 'DM Sans', sans-serif; font-weight: 800; font-size: 15px;
          border: none; cursor: pointer;
          box-shadow: 0 8px 28px rgba(0,0,0,0.22);
          transition: all 0.2s; letter-spacing: -0.2px;
        }
        .hiw-cta-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 36px rgba(0,0,0,0.28); }
        .hiw-cta-btn-secondary {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 15px 26px; border-radius: 14px;
          background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.85);
          border: 1px solid rgba(255,255,255,0.18);
          font-family: 'DM Sans', sans-serif; font-weight: 700; font-size: 15px;
          cursor: pointer; transition: all 0.2s;
        }
        .hiw-cta-btn-secondary:hover { background: rgba(255,255,255,0.18); transform: translateY(-2px); }

        /* ══ RESPONSIVE ════════════════════════════════════ */
        @media (max-width: 900px) {
          .hiw-steps-grid { grid-template-columns: repeat(2, 1fr); }
          .hiw-steps-grid::before { display: none; }
          .hiw-partner-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .hiw-hero { padding: 52px 20px 92px; }
          .hiw-body { padding: 32px 16px 60px; }
          .hiw-steps-grid { grid-template-columns: 1fr; gap: 14px; }
          .hiw-trust-item { min-width: 120px; padding: 10px 16px; }
          .hiw-bottom-cta { padding: 36px 24px; border-radius: 22px; }
          .hiw-partner-card { padding: 26px 22px; }
        }
        @media (max-width: 400px) {
          .hiw-hero-title { font-size: 2rem; letter-spacing: -1.5px; }
          .hiw-trust-inner { flex-direction: column; align-items: center; }
          .hiw-trust-item { border-right: none; border-bottom: 1px solid #E8EEFF; width: 100%; }
        }
      `}</style>

      <div className="hiw-page">

        {/* ══ HERO ══════════════════════════════════════════ */}
        <div className="hiw-hero">
          <div className="hiw-hero-grid" />
          {/* Orbs */}
          <div className="hiw-hero-glow" style={{ width: 500, height: 500, top: -150, left: '50%', transform: 'translateX(-50%)' }} />
          <div className="hiw-hero-glow" style={{ width: 200, height: 200, bottom: 10, left: '5%', opacity: 0.6 }} />
          {/* Flowing water lines */}
          {[18, 36, 55, 72].map((top, i) => (
            <div key={i} className="hiw-flow-line" style={{ top: `${top}%`, width: '40%', left: `${i * 15}%`, animationDelay: `${i * 1.3}s`, animationDuration: `${4 + i}s` }} />
          ))}
          {/* Particles */}
          {[
            { l: '6%',  t: '20%', s: 9,  d: '0s',   dr: '6.5s' },
            { l: '22%', t: '65%', s: 7,  d: '1.4s',  dr: '7s'   },
            { l: '80%', t: '22%', s: 11, d: '0.6s',  dr: '5.5s' },
            { l: '72%', t: '68%', s: 8,  d: '2.1s',  dr: '7.5s' },
            { l: '50%', t: '10%', s: 6,  d: '0.9s',  dr: '6s'   },
          ].map((p, i) => (
            <div key={i} className="hiw-particle" style={{ left: p.l, top: p.t, width: p.s, height: p.s, background: 'rgba(147,197,253,0.55)', animationDelay: p.d, animationDuration: p.dr }} />
          ))}

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div className="hiw-hero-eyebrow">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#60A5FA', display: 'inline-block' }} />
              Simple · Fast · Transparent
            </div>
            <h1 className="hiw-hero-title">
              How AuroWater<br />
              <span>works for you.</span>
            </h1>
            <p className="hiw-hero-sub">
              From address to booked service in under 60 seconds. Verified technicians, live tracking, zero surprises.
            </p>
            <button className="hiw-hero-cta" type="button" onClick={() => router.push('/book')}>
              <IconDroplet size={16} />
              Book a Service Now
              <IconArrow />
            </button>
          </div>

          {/* Waves */}
          <svg className="hiw-wave" viewBox="0 0 1440 108" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path fill="#F5F7FF" fillOpacity="0.4" d="M0,54 C240,88 480,18 720,54 C960,90 1200,24 1440,54 L1440,108 L0,108 Z"/>
            <path fill="#F5F7FF" fillOpacity="0.65" d="M0,70 C200,44 500,92 720,70 C940,48 1200,84 1440,70 L1440,108 L0,108 Z"/>
            <path fill="#F5F7FF" d="M0,84 C180,68 360,95 540,84 C720,73 900,92 1080,82 C1260,72 1360,88 1440,84 L1440,108 L0,108 Z"/>
          </svg>
        </div>

        {/* ══ TRUST STRIP ═════════════════════════════════ */}
        <div className="hiw-trust-strip">
          <div className="hiw-trust-inner">
            {TRUST_STATS.map((s) => (
              <div key={s.label} className="hiw-trust-item">
                <span className="hiw-trust-icon">{s.icon}</span>
                <div>
                  <div className="hiw-trust-val">{s.value}</div>
                  <div className="hiw-trust-lbl">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ BODY ════════════════════════════════════════ */}
        <div className="hiw-body">

          {/* ── How it works steps ── */}
          <div>
            <div className="hiw-section-label">
              <span className="hiw-section-label-dot" />
              The process
            </div>
            <h2 className="hiw-section-title">Four steps to clean water</h2>
            <p className="hiw-section-sub">Click any step to explore it — or watch them cycle automatically.</p>

            <div className="hiw-steps-grid">
              {STEPS.map((step, i) => (
                <StepCard key={step.step} step={step} index={i} active={activeStep === i} onClick={() => setActiveStep(i)} />
              ))}
            </div>

            {/* Dot navigator */}
            <div className="hiw-step-dots">
              {STEPS.map((step, i) => (
                <button
                  key={i}
                  type="button"
                  className="hiw-step-dot"
                  onClick={() => setActiveStep(i)}
                  aria-label={`Step ${i + 1}`}
                  style={{
                    width: activeStep === i ? 24 : 6,
                    background: activeStep === i ? STEPS[i].color : '#CBD5E1',
                  }}
                />
              ))}
            </div>
          </div>

          {/* ── Partner cards ── */}
          <div style={{ marginTop: 64 }}>
            <div className="hiw-section-label">
              <span className="hiw-section-label-dot" />
              Join the network
            </div>
            <h2 className="hiw-section-title">Work with AuroWater</h2>
            <p className="hiw-section-sub">Whether you're a skilled technician or a water supplier — there's a place for you.</p>

            <div className="hiw-partner-grid">
              {/* Technician */}
              <div className="hiw-partner-card hiw-partner-card-tech">
                <div className="hiw-partner-blob" style={{ width: 220, height: 220, bottom: -60, right: -60, background: 'radial-gradient(circle, rgba(37,99,235,0.25), transparent 70%)' }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div className="hiw-partner-tag">
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#60A5FA', display: 'inline-block' }} />
                    For Technicians
                  </div>
                  <h3 className="hiw-partner-title">Earn on your schedule</h3>
                  <p className="hiw-partner-sub">Verified job requests, transparent earnings, flexible hours across your city.</p>
                  <div className="hiw-partner-steps">
                    {TECH_STEPS.map((s, i) => (
                      <div key={s} className="hiw-partner-step">
                        <div className="hiw-partner-step-num">{i + 1}</div>
                        <div className="hiw-partner-step-text">{s}</div>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="hiw-partner-btn hiw-partner-btn-tech" onClick={() => router.push('/contact?subject=technician')}>
                    <IconDroplet size={15} />
                    Join as Technician
                    <IconArrow />
                  </button>
                </div>
              </div>

              {/* Supplier */}
              <div className="hiw-partner-card hiw-partner-card-supplier">
                <div className="hiw-partner-blob" style={{ width: 200, height: 200, top: -50, right: -50, background: 'radial-gradient(circle, rgba(14,165,233,0.2), transparent 70%)' }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div className="hiw-partner-tag">
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#7DD3FC', display: 'inline-block' }} />
                    For Suppliers
                  </div>
                  <h3 className="hiw-partner-title">Grow your water business</h3>
                  <p className="hiw-partner-sub">Get an AuroTap ID, receive direct orders, and manage your fleet through our platform.</p>
                  <div className="hiw-partner-steps">
                    {SUPPLIER_STEPS.map((s, i) => (
                      <div key={s} className="hiw-partner-step">
                        <div className="hiw-partner-step-num">{i + 1}</div>
                        <div className="hiw-partner-step-text">{s}</div>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="hiw-partner-btn hiw-partner-btn-supplier" onClick={() => router.push('/contact?subject=supplier')}>
                    Become a Supplier
                    <IconArrow />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── FAQ ── */}
          <div style={{ marginTop: 64 }}>
            <div className="hiw-section-label">
              <span className="hiw-section-label-dot" />
              Common questions
            </div>
            <h2 className="hiw-section-title">Everything you need to know</h2>
            <p className="hiw-section-sub">Can't find an answer? WhatsApp us — we reply in 30 minutes.</p>

            <div className="hiw-faq-wrap">
              {FAQ.map((item, idx) => (
                <FaqItem
                  key={item.q}
                  item={item}
                  open={openFaq === idx}
                  onToggle={() => setOpenFaq((c) => c === idx ? null : idx)}
                />
              ))}
            </div>
          </div>

          {/* ── Bottom CTA ── */}
          <div className="hiw-bottom-cta">
            {[0, 1, 2].map((i) => (
              <div key={i} className="hiw-cta-rings" style={{ width: 200, height: 200, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', animationDelay: `${i * 1.4}s` }} />
            ))}
            <div className="hiw-cta-grid" />
            <div className="hiw-cta-content">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)', padding: '5px 14px', borderRadius: 99 }}>
                {[1,2,3,4,5].map((i) => <IconStar key={i} />)}
                <span style={{ fontSize: 12, fontWeight: 700, color: '#93C5FD', marginLeft: 4 }}>4.8 from 3,200+ bookings</span>
              </div>
              <h3 className="hiw-cta-title">
                Ready to get started?<br />
                <span>Book in under 60 seconds.</span>
              </h3>
              <p className="hiw-cta-sub">Verified pros · Upfront pricing · Same-day slots available</p>
              <div className="hiw-cta-btns">
                <button type="button" className="hiw-cta-btn-primary" onClick={() => router.push('/book')}>
                  <IconDroplet size={16} />
                  Book a Service
                </button>
                <button type="button" className="hiw-cta-btn-secondary" onClick={() => router.push('/services')}>
                  Browse Services
                  <IconArrow />
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}