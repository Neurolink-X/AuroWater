'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { TRUST_REVIEWS } from '@/lib/trust-reviews';
import SectionWrapper from '@/components/ui/SectionWrapper';

// ── Count-up hook ──────────────────────────────────────────────────────────
function useCountUp(target: number, durationMs: number) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        obs.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / durationMs);
          const eased = 1 - Math.pow(1 - t, 3);
          setValue(target * eased);
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.25 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, durationMs]);

  return { value, ref };
}

// ── Avatar gradient ────────────────────────────────────────────────────────
const AVATAR_COLORS: [string, string][] = [
  ['#0D9B6C', '#065F46'],
  ['#0369A1', '#0C4A6E'],
  ['#7C3AED', '#4C1D95'],
  ['#D97706', '#78350F'],
  ['#DC2626', '#7F1D1D'],
];
function avatarGradient(name: string): [string, string] {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

// ── Inline SVG icons ───────────────────────────────────────────────────────
const DropIcon = ({ size = 18, color = '#0D9B6C' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2C12 2 5 9.5 5 14.5C5 18.09 8.13 21 12 21C15.87 21 19 18.09 19 14.5C19 9.5 12 2 12 2Z"
      fill={color} opacity="0.18" stroke={color} strokeWidth="1.5" />
    <path d="M9 15.5C9.5 17.5 11 18.5 13 18" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const ArrowRightIcon = ({ color = '#fff' }: { color?: string }) => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M3 7.5h9M8.5 4L12 7.5 8.5 11" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckCircle = ({ color = '#0D9B6C' }: { color?: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="8" cy="8" r="8" fill={color} opacity="0.12" />
    <path d="M5 8L7 10L11 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <polygon points="7,1 8.8,5.2 13,5.6 10,8.4 10.9,12.5 7,10.3 3.1,12.5 4,8.4 1,5.6 5.2,5.2"
      fill={filled ? '#F59E0B' : '#E5E7EB'} />
  </svg>
);

// ── Reusable Pill label ────────────────────────────────────────────────────
function SectionPill({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: '#ECFDF5', border: '1px solid #A7F3D0',
      borderRadius: 999, padding: '4px 12px', marginBottom: 12,
    }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: '#065F46', letterSpacing: '0.1em' }}>{children}</span>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function AboutPage() {
  const stats = useMemo(() => [
    { label: 'Bookings Completed', value: 2400, suffix: '+', icon: '💧', format: (n: number) => Math.floor(n).toLocaleString('en-IN') },
    { label: 'Verified Technicians', value: 180, suffix: '+', icon: '👷', format: (n: number) => Math.floor(n).toLocaleString('en-IN') },
    { label: 'Cities in UP', value: 35, suffix: '', icon: '📍', format: (n: number) => Math.floor(n).toLocaleString('en-IN') },
    { label: 'Average Rating', value: 4.8, suffix: '★', icon: '⭐', format: (n: number) => n.toFixed(1) },
  ], []);

  const c1 = useCountUp(stats[0].value, 1600);
  const c2 = useCountUp(stats[1].value, 1600);
  const c3 = useCountUp(stats[2].value, 1600);
  const c4 = useCountUp(stats[3].value, 1600);
  const counts = [c1, c2, c3, c4];

  const team = useMemo(() => [
    { name: 'Arjun Chaurasiya', role: 'Founder & CEO', initials: 'AC', bio: 'Passionate about making essential services accessible to every household across UP.' },
    { name: 'Arjun Chauhan', role: 'Head of Operations', initials: 'AH', bio: 'Ensures every delivery and service call meets AuroWater\'s quality promise.' },
    { name: 'Vikram Singh', role: 'Lead Technician Network', initials: 'VS', bio: 'Built and manages our 180+ verified technician community across 35 cities.' },
  ], []);

  const cities = [
    'Delhi', 'Noida', 'Ghaziabad','Kanpur', 'Gorakhpur', 'Lucknow', 'Varanasi', 'Prayagraj',
    'Agra', 'Meerut', 'Bareilly', 'Aligarh', 'Mathura',
    
  ];

  const values = [
    { icon: '🤝', title: 'Transparency', desc: 'Full price shown before you confirm. No hidden charges, no surprise fees — ever.' },
    { icon: '⚡', title: 'Speed', desc: 'Same-day slots in most cities. Emergency response when you need it most.' },
    { icon: '🛡️', title: 'Verified Quality', desc: 'Every technician is ID-verified and rated before their first job on our platform.' },
    { icon: '💧', title: 'Water-first', desc: 'We exist solely for water services. Not a generic marketplace — deep expertise only.' },
    { icon: '📞', title: 'Real Support', desc: 'WhatsApp-first support. A real person responds, not a bot, within minutes.' },
    { icon: '🌱', title: 'Community', desc: 'We create livelihoods for local technicians while serving local households.' },
  ];

  const milestones = [
    { year: '2023', event: 'AuroWater founded in Kanpur — first 10 tanker deliveries' },
    { year: '2024', event: 'Expanded to 15 cities · Launched RO & plumbing verticals' },
    { year: '2025', event: '1,000+ bookings · 80 verified technicians onboarded' },
    { year: '2026', event: '35 cities · 2,400+ bookings · Can subscription launched' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Clash+Display:wght@600;700&family=Bricolage+Grotesque:wght@300;400;500;600;700;800&display=swap');

        .about-page * { box-sizing: border-box; }
        .about-page { font-family: 'Bricolage Grotesque', sans-serif; }
        .about-page .clash { font-family: 'Clash Display', sans-serif; }

        @keyframes floatA {
          0%, 100% { transform: translateY(0) rotate(-6deg); }
          50% { transform: translateY(-14px) rotate(-6deg); }
        }
        @keyframes floatB {
          0%, 100% { transform: translateY(0) rotate(10deg); }
          50% { transform: translateY(-10px) rotate(10deg); }
        }
        @keyframes pulseDot {
          0%, 100% { box-shadow: 0 0 0 3px rgba(52,211,153,0.25); }
          50% { box-shadow: 0 0 0 7px rgba(52,211,153,0.06); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.94); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideRight {
          from { width: 0; }
          to { width: 100%; }
        }

        .about-page .stat-card {
          animation: fadeUp 0.5s ease both;
        }
        .about-page .stat-card:nth-child(1) { animation-delay: 0ms; }
        .about-page .stat-card:nth-child(2) { animation-delay: 80ms; }
        .about-page .stat-card:nth-child(3) { animation-delay: 160ms; }
        .about-page .stat-card:nth-child(4) { animation-delay: 240ms; }

        .about-page .val-card {
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.2s;
        }
        .about-page .val-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 16px 40px rgba(13,155,108,0.1);
          border-color: #A7F3D0 !important;
        }

        .about-page .team-card {
          transition: transform 0.22s ease, box-shadow 0.22s ease;
        }
        .about-page .team-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 48px rgba(0,0,0,0.09);
        }

        .about-page .review-card {
          transition: transform 0.2s ease, box-shadow 0.2s;
        }
        .about-page .review-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 40px rgba(0,0,0,0.08);
        }

        .about-page .city-pill {
          transition: all 0.18s ease;
          cursor: default;
        }
        .about-page .city-pill:hover {
          background: #0D9B6C !important;
          color: #fff !important;
          border-color: #0D9B6C !important;
          transform: translateY(-2px);
        }

        .about-page .cta-btn {
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .about-page .cta-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(13,155,108,0.38);
        }
        .about-page .cta-btn:active { transform: scale(0.97); }
      `}</style>

      <div className="about-page" style={{ minHeight: '100vh', background: '#F7FAF8' }}>

        {/* ══ HERO ═══════════════════════════════════════════════════════════ */}
        <div style={{
          background: 'linear-gradient(150deg, #011F14 0%, #033D26 45%, #0A5535 100%)',
          padding: 'clamp(60px,9vw,100px) 24px clamp(80px,11vw,120px)',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* bg circles */}
          {[
            { s: 420, t: -120, r: -100, op: 0.07 },
            { s: 180, b: -60, l: -50, op: 0.05 },
            { s: 110, t: 60, l: '38%', op: 0.04 },
          ].map((c: { s: number; t?: number; r?: number; b?: number; l?: number | string; op: number }, i) => (
            <div key={i} style={{
              position: 'absolute', width: c.s, height: c.s,
              top: c.t, right: c.r, bottom: c.b, left: c.l as string | number | undefined,
              borderRadius: '50%', background: '#34D399', opacity: c.op, pointerEvents: 'none',
            }} />
          ))}
          {/* dot grid */}
          <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />

          {/* floating drops */}
          <div style={{ position: 'absolute', top: 40, right: '8%', animation: 'floatA 5s ease-in-out infinite', pointerEvents: 'none' }}>
            <svg width="100" height="120" viewBox="0 0 100 120" fill="none" opacity="0.13">
              <path d="M50 4C50 4 8 48 8 78C8 103 27 118 50 118C73 118 92 103 92 78C92 48 50 4 50 4Z" fill="#34D399" />
            </svg>
          </div>
          <div style={{ position: 'absolute', bottom: 30, right: '20%', animation: 'floatB 6.5s ease-in-out infinite', pointerEvents: 'none' }}>
            <svg width="50" height="60" viewBox="0 0 50 60" fill="none" opacity="0.09">
              <path d="M25 2C25 2 4 24 4 39C4 51.5 13.5 59 25 59C36.5 59 46 51.5 46 39C46 24 25 2 25 2Z" fill="#6EE7B7" />
            </svg>
          </div>

          <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
            {/* live badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.28)', borderRadius: 999, padding: '5px 14px', marginBottom: 24 }}>
              <span className="pulseDot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#34D399', display: 'inline-block', animation: 'pulseDot 2s infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6EE7B7', letterSpacing: '0.1em' }}>SERVING 35 CITIES ACROSS UTTAR PRADESH</span>
            </div>

            <h1 className="clash" style={{
              margin: 0, fontSize: 'clamp(2rem,7vw,4.6rem)',
              fontWeight: 700, color: '#fff', letterSpacing: '-1.5px',
              lineHeight: 1.05, maxWidth: 780,
            }}>
              Making water services
              <br />
              <span style={{ color: '#34D399' }}>simple, fair & reliable.</span>
            </h1>

            <p style={{ margin: '22px 0 0', fontSize: 16, color: 'rgba(255,255,255,0.55)', maxWidth: 520, lineHeight: 1.75 }}>
              We built AuroWater because booking essential water services shouldn't require endless calls, waiting, or guessing the price. Clean water is a right, not a privilege.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 32 }}>
              <Link href="/book" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#0D9B6C', color: '#fff', fontWeight: 700, fontSize: 14,
                padding: '13px 24px', borderRadius: 12, textDecoration: 'none',
                boxShadow: '0 4px 18px rgba(13,155,108,0.45)', transition: 'all 0.2s',
              }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)'; }}
              >
                Book a Service <ArrowRightIcon />
              </Link>
              <Link href="/contact" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 700, fontSize: 14,
                padding: '13px 24px', borderRadius: 12, textDecoration: 'none',
                border: '1.5px solid rgba(255,255,255,0.18)', transition: 'all 0.2s',
              }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.15)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.08)'; }}
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>

        {/* ══ STATS ══════════════════════════════════════════════════════════ */}
        <div style={{ maxWidth: 1200, margin: '-36px auto 0', padding: '0 24px', position: 'relative', zIndex: 10 }}>
          <div style={{ background: '#fff', borderRadius: 20, border: '1.5px solid #E5E7EB', boxShadow: '0 8px 36px rgba(0,0,0,0.09)', padding: '28px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1 }}>
              {stats.map((s, i) => {
                const counter = counts[i];
                return (
                  <div
                    key={s.label}
                    className="stat-card"
                    style={{
                      textAlign: 'center', padding: '20px 16px',
                      borderRight: i < stats.length - 1 ? '1px solid #F3F4F6' : 'none',
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
                    <div ref={counter.ref} className="clash" style={{ fontSize: 36, fontWeight: 700, color: '#0D9B6C', letterSpacing: '-1px', lineHeight: 1 }}>
                      {s.format(counter.value)}{s.suffix}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginTop: 6, letterSpacing: '0.03em' }}>{s.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ══ MISSION + STORY ════════════════════════════════════════════════ */}
        <div style={{ maxWidth: 1200, margin: '56px auto 0', padding: '0 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {/* Mission */}
            <div style={{ background: '#fff', borderRadius: 22, border: '1.5px solid #E5E7EB', padding: '36px 36px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: '#ECFDF5', pointerEvents: 'none' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <SectionPill>OUR MISSION</SectionPill>
                <h2 className="clash" style={{ margin: '0 0 14px', fontSize: 'clamp(1.4rem,3vw,2rem)', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.8px', lineHeight: 1.2 }}>
                  Clean water access,<br />for every household.
                </h2>
                <p style={{ margin: 0, fontSize: 14, color: '#6B7280', lineHeight: 1.8 }}>
                  To make water supply and water-system services easy to book, fair to pay, and dependable to receive — with clear pricing and verified technicians.
                </p>
                <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {['Transparent pricing before you confirm', 'Verified professionals on every job', 'Zero hidden charges or surprise fees'].map((f) => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: '#374151', fontWeight: 500 }}>
                      <CheckCircle /> {f}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Story / Timeline */}
            <div style={{ background: '#0F172A', borderRadius: 22, padding: '36px 36px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: '#0D9B6C', opacity: 0.08, pointerEvents: 'none' }} />
              <SectionPill>OUR JOURNEY</SectionPill>
              <h2 className="clash" style={{ margin: '0 0 24px', fontSize: 'clamp(1.4rem,3vw,2rem)', fontWeight: 700, color: '#fff', letterSpacing: '-0.8px', lineHeight: 1.2 }}>
                From Kanpur to<br />35 cities.
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {milestones.map((m, i) => (
                  <div key={m.year} style={{ display: 'flex', gap: 16, position: 'relative', paddingBottom: i < milestones.length - 1 ? 24 : 0 }}>
                    {/* line */}
                    {i < milestones.length - 1 && (
                      <div style={{ position: 'absolute', left: 19, top: 28, bottom: 0, width: 1, background: 'rgba(255,255,255,0.1)' }} />
                    )}
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: i === milestones.length - 1 ? '#0D9B6C' : 'rgba(255,255,255,0.07)', border: `1.5px solid ${i === milestones.length - 1 ? '#0D9B6C' : 'rgba(255,255,255,0.12)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: i === milestones.length - 1 ? '#fff' : 'rgba(255,255,255,0.5)', letterSpacing: '0.02em' }}>{m.year}</span>
                      </div>
                    </div>
                    <div style={{ paddingTop: 9 }}>
                      <p style={{ margin: 0, fontSize: 13, color: i === milestones.length - 1 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)', fontWeight: i === milestones.length - 1 ? 600 : 400, lineHeight: 1.6 }}>
                        {m.event}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ══ VALUES ══════════════════════════════════════════════════════════ */}
        <div style={{ maxWidth: 1200, margin: '56px auto 0', padding: '0 24px' }}>
          <div style={{ marginBottom: 28 }}>
            <SectionPill>OUR VALUES</SectionPill>
            <h2 className="clash" style={{ margin: 0, fontSize: 'clamp(1.5rem,4vw,2.4rem)', fontWeight: 700, color: '#0F172A', letterSpacing: '-1px' }}>
              What drives us every day
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {values.map((v, i) => (
              <div
                key={v.title}
                className="val-card"
                style={{
                  background: '#fff', borderRadius: 18, border: '1.5px solid #F3F4F6',
                  padding: '24px 24px', animation: 'fadeUp 0.4s ease both',
                  animationDelay: `${i * 60}ms`,
                }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F0FDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 14 }}>
                  {v.icon}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 7, letterSpacing: '-0.2px' }}>{v.title}</div>
                <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7 }}>{v.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ CUSTOMER REVIEWS ════════════════════════════════════════════════ */}
        <div style={{ maxWidth: 1200, margin: '56px auto 0', padding: '0 24px' }}>
          <div style={{ marginBottom: 28 }}>
            <SectionPill>CUSTOMER TRUST</SectionPill>
            <h2 className="clash" style={{ margin: '0 0 6px', fontSize: 'clamp(1.5rem,4vw,2.4rem)', fontWeight: 700, color: '#0F172A', letterSpacing: '-1px' }}>
              Real stories, real people
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: '#9CA3AF', fontWeight: 500 }}>
              Verified reviews from AuroWater customers across UP.
            </p>
          </div>

          <SectionWrapper>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
              {TRUST_REVIEWS.map((r) => (
                <div
                  key={`${r.name}-${r.date}`}
                  className="review-card"
                  style={{ background: '#fff', borderRadius: 20, border: '1.5px solid #F3F4F6', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      {(() => {
                        const [from, to] = avatarGradient(r.name);
                        return (
                          <div style={{
                            width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                            background: `linear-gradient(135deg, ${from}, ${to})`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontWeight: 800, fontSize: 16,
                            boxShadow: `0 4px 12px ${from}44`,
                          }}>
                            {r.initials}
                          </div>
                        );
                      })()}
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: '#111827', letterSpacing: '-0.2px' }}>{r.name}</div>
                        <div style={{ marginTop: 3 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#0D9B6C', background: '#ECFDF5', padding: '2px 8px', borderRadius: 999, border: '1px solid #A7F3D0' }}>
                            {r.city}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <div style={{ display: 'flex', gap: 1 }}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <StarIcon key={i} filled={i < r.rating} />
                        ))}
                      </div>
                      <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>{r.date}</span>
                    </div>
                  </div>

                  {/* Service tag */}
                  <span style={{ display: 'inline-flex', alignSelf: 'flex-start', fontSize: 11, fontWeight: 700, color: '#374151', background: '#F9FAFB', padding: '4px 10px', borderRadius: 999, border: '1.5px solid #E5E7EB' }}>
                    {r.service}
                  </span>

                  {/* Review text */}
                  <p style={{ margin: 0, fontSize: 13, color: '#4B5563', lineHeight: 1.75, fontStyle: 'italic', borderLeft: '3px solid #A7F3D0', paddingLeft: 12 }}>
                    "{r.text}"
                  </p>
                </div>
              ))}
            </div>
          </SectionWrapper>
        </div>

        {/* ══ TEAM ═══════════════════════════════════════════════════════════ */}
        <div style={{ maxWidth: 1200, margin: '56px auto 0', padding: '0 24px' }}>
          <div style={{ marginBottom: 28 }}>
            <SectionPill>THE TEAM</SectionPill>
            <h2 className="clash" style={{ margin: 0, fontSize: 'clamp(1.5rem,4vw,2.4rem)', fontWeight: 700, color: '#0F172A', letterSpacing: '-1px' }}>
              People behind AuroWater
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            {team.map((m) => {
              const [from, to] = avatarGradient(m.name);
              return (
                <div
                  key={m.name}
                  className="team-card"
                  style={{ background: '#fff', borderRadius: 22, border: '1.5px solid #F3F4F6', padding: '32px 28px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}
                >
                  <div style={{
                    width: 80, height: 80, borderRadius: '50%', margin: '0 auto 16px',
                    background: `linear-gradient(135deg, ${from}, ${to})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 800, fontSize: 24,
                    boxShadow: `0 8px 24px ${from}50`,
                  }}>
                    {m.initials}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#0F172A', letterSpacing: '-0.3px' }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: '#0D9B6C', fontWeight: 700, marginTop: 4, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>{m.role}</div>
                  <p style={{ margin: '12px 0 0', fontSize: 13, color: '#6B7280', lineHeight: 1.7 }}>{m.bio}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ══ COVERAGE ════════════════════════════════════════════════════════ */}
        <div style={{ maxWidth: 1200, margin: '56px auto 0', padding: '0 24px' }}>
          <div style={{ background: '#fff', borderRadius: 22, border: '1.5px solid #E5E7EB', padding: 'clamp(28px,4vw,44px)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: '#ECFDF5', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <SectionPill>SERVICE COVERAGE</SectionPill>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
                <h2 className="clash" style={{ margin: 0, fontSize: 'clamp(1.4rem,3.5vw,2rem)', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.8px' }}>
                  35 cities & growing across UP
                </h2>
                <span style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>New cities added regularly</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {cities.map((c) => (
                  <span
                    key={c}
                    className="city-pill"
                    style={{
                      padding: '8px 16px', borderRadius: 999,
                      border: '1.5px solid #E5E7EB', background: '#F9FAFB',
                      color: '#374151', fontSize: 13, fontWeight: 600,
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <DropIcon size={12} color="#0D9B6C" />
                    {c}
                  </span>
                ))}
                <span style={{ padding: '8px 16px', borderRadius: 999, border: '1.5px dashed #E5E7EB', background: '#F9FAFB', color: '#9CA3AF', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  + 22 more
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ══ PARTNER CTA ═════════════════════════════════════════════════════ */}
        <div style={{ maxWidth: 1200, margin: '56px auto 0', padding: '0 24px 80px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {/* Technician */}
            <div style={{
              background: 'linear-gradient(135deg, #022C22 0%, #065F46 100%)',
              borderRadius: 22, padding: 'clamp(28px,4vw,40px)', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: '#34D399', opacity: 0.1, pointerEvents: 'none' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>👷</div>
                <div className="clash" style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px', marginBottom: 8 }}>Are you a Technician?</div>
                <p style={{ margin: '0 0 22px', fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
                  Join our verified network. Accept job requests in your city, build your rating, and grow your income.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
                  {['Earn ₹30,000+ / month', 'Flexible working hours', 'ID verified badge'].map((f) => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
                      <CheckCircle color="#34D399" /> {f}
                    </div>
                  ))}
                </div>
                <Link href="/contact" className="cta-btn" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: '#fff', color: '#065F46', fontWeight: 800, fontSize: 14,
                  padding: '12px 24px', borderRadius: 12, textDecoration: 'none',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                }}>
                  Apply Now <ArrowRightIcon color="#065F46" />
                </Link>
              </div>
            </div>

            {/* Supplier */}
            <div style={{
              background: '#fff', borderRadius: 22, border: '1.5px solid #E5E7EB',
              padding: 'clamp(28px,4vw,40px)', position: 'relative', overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            }}>
              <div style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: '#ECFDF5', pointerEvents: 'none' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🚛</div>
                <div className="clash" style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.5px', marginBottom: 8 }}>Are you a Supplier?</div>
                <p style={{ margin: '0 0 22px', fontSize: 13, color: '#6B7280', lineHeight: 1.7 }}>
                  Get your AuroTap ID, receive digital orders, manage deliveries, and grow your tanker or can supply business.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
                  {['Digital order management', 'Route-optimised delivery', 'Monthly GST invoicing'].map((f) => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', fontWeight: 500 }}>
                      <CheckCircle /> {f}
                    </div>
                  ))}
                </div>
                <Link href="/contact" className="cta-btn" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: '#0D9B6C', color: '#fff', fontWeight: 800, fontSize: 14,
                  padding: '12px 24px', borderRadius: 12, textDecoration: 'none',
                  boxShadow: '0 4px 16px rgba(13,155,108,0.35)',
                }}>
                  Partner with Us <ArrowRightIcon />
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom CTA Banner */}
          <div style={{
            marginTop: 20,
            background: 'linear-gradient(135deg, #022C22 0%, #065F46 55%, #0D9B6C 100%)',
            borderRadius: 22, padding: 'clamp(36px,5vw,52px) clamp(28px,5vw,52px)',
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 24,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: -70, right: -70, width: 260, height: 260, borderRadius: '50%', background: '#34D399', opacity: 0.09, pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 999, padding: '4px 12px', marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#6EE7B7', letterSpacing: '0.1em' }}>CLEAN WATER FOR ALL</span>
              </div>
              <div className="clash" style={{ fontSize: 'clamp(1.3rem,3.5vw,2rem)', fontWeight: 700, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                Ready to experience<br />water services done right?
              </div>
            </div>
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <Link href="/book" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#fff', color: '#065F46', fontWeight: 800, fontSize: 14,
                padding: '13px 28px', borderRadius: 12, textDecoration: 'none',
                boxShadow: '0 4px 18px rgba(0,0,0,0.2)', transition: 'all 0.2s',
              }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)'; }}
              >
                Book Now <ArrowRightIcon color="#065F46" />
              </Link>
              <Link href="/pricing" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 700, fontSize: 14,
                padding: '13px 24px', borderRadius: 12, textDecoration: 'none',
                border: '1.5px solid rgba(255,255,255,0.2)', transition: 'all 0.2s',
              }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.18)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.1)'; }}
              >
                View Pricing
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

























// 'use client';

// import React, { useEffect, useMemo, useRef, useState } from 'react';
// import Link from 'next/link';
// import { TRUST_REVIEWS } from '@/lib/trust-reviews';
// import SectionWrapper from '@/components/ui/SectionWrapper';

// function useCountUp(target: number, durationMs: number) {
//   const [value, setValue] = useState(0);
//   const ref = useRef<HTMLDivElement | null>(null);

//   useEffect(() => {
//     if (!ref.current) return;
//     const el = ref.current;
//     const obs = new IntersectionObserver(
//       (entries) => {
//         const entry = entries[0];
//         if (!entry?.isIntersecting) return;
//         obs.disconnect();

//         const start = performance.now();
//         const from = 0;
//         const to = target;

//         const tick = (now: number) => {
//           const t = Math.min(1, (now - start) / durationMs);
//           const next = from + (to - from) * t;
//           setValue(next);
//           if (t < 1) requestAnimationFrame(tick);
//         };

//         requestAnimationFrame(tick);
//       },
//       { threshold: 0.2 }
//     );

//     obs.observe(el);
//     return () => obs.disconnect();
//   }, [target, durationMs]);

//   return { value, ref };
// }

// export default function AboutPage() {
//   const stats = useMemo(
//     () => [
//       { label: 'Bookings Completed', value: 2400, suffix: '+', format: (n: number) => Math.floor(n).toLocaleString('en-IN') },
//       { label: 'Verified Technicians', value: 180, suffix: '+', format: (n: number) => Math.floor(n).toLocaleString('en-IN') },
//       { label: 'Cities in UP', value: 35, suffix: '', format: (n: number) => Math.floor(n).toLocaleString('en-IN') },
//       { label: 'Average Rating', value: 4.8, suffix: '', format: (n: number) => n.toFixed(1) },
//     ],
//     []
//   );

//   const count1 = useCountUp(stats[0].value, 1400);
//   const count2 = useCountUp(stats[1].value, 1400);
//   const count3 = useCountUp(stats[2].value, 1400);
//   const count4 = useCountUp(stats[3].value, 1400);

//   const team = useMemo(
//     () => [
//       { name: 'Arjun Chaurasiya', role: 'Founder & CEO', initials: 'AC' },
//       { name: 'Arjun Chauhan', role: 'Head of Operations', initials: 'AH' },
//       { name: 'Vikram Singh', role: 'Lead Technician Network', initials: 'VS' },
//     ],
//     []
//   );

//   const colors = [
//     'from-blue-400 to-blue-600',
//     'from-green-400 to-green-600',
//     'from-purple-400 to-purple-600',
//     'from-orange-400 to-orange-600',
//     'from-pink-400 to-pink-600',
//   ];

//   const avatarGradient = (name: string) => {
//     const idx = (name.charCodeAt(0) || 0) % colors.length;
//     return colors[idx];
//   };

//   return (
//     <div className="min-h-screen gradient-section">
//       <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8">
//         <div className="rounded-2xl bg-gradient-to-r from-[#0D9B6C] to-[#38BDF8] p-8 text-white overflow-hidden relative">
//           <div className="hero-water-bg" />
//           <h1 className="relative text-[clamp(1.75rem,5vw,3.5rem)] font-extrabold">Making water services simple, fair, and reliable</h1>
//           <p className="relative mt-3 text-white/90 text-base sm:text-lg">
//             We built AuroWater because booking basic water services shouldn’t require endless calls and waiting.
//           </p>
//         </div>
//       </section>

//       <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
//         <div className="mt-2 rounded-2xl bg-white/70 border border-slate-100 shadow-card p-6">
//           <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
//             <div className="rounded-xl border border-slate-100 bg-white p-4 text-center">
//               <div className="text-xl">💧</div>
//               <div ref={count1.ref} className="text-3xl font-extrabold text-[#0D9B6C]">
//                 {stats[0].format(count1.value)}{stats[0].suffix}
//               </div>
//               <div className="text-xs font-semibold text-slate-600 mt-1">{stats[0].label}</div>
//             </div>
//             <div className="rounded-xl border border-slate-100 bg-white p-4 text-center">
//               <div className="text-xl">👷</div>
//               <div ref={count2.ref} className="text-3xl font-extrabold text-[#0D9B6C]">
//                 {stats[1].format(count2.value)}{stats[1].suffix}
//               </div>
//               <div className="text-xs font-semibold text-slate-600 mt-1">{stats[1].label}</div>
//             </div>
//             <div className="rounded-xl border border-slate-100 bg-white p-4 text-center">
//               <div className="text-xl">📍</div>
//               <div ref={count3.ref} className="text-3xl font-extrabold text-[#0D9B6C]">
//                 {stats[2].format(count3.value)}{stats[2].suffix}
//               </div>
//               <div className="text-xs font-semibold text-slate-600 mt-1">{stats[2].label}</div>
//             </div>
//             <div className="rounded-xl border border-slate-100 bg-white p-4 text-center">
//               <div className="text-xl">⭐</div>
//               <div ref={count4.ref} className="text-3xl font-extrabold text-[#0D9B6C]">
//                 {stats[3].format(count4.value)}{stats[3].suffix}
//               </div>
//               <div className="text-xs font-semibold text-slate-600 mt-1">{stats[3].label}</div>
//             </div>
//           </div>
//         </div>
//       </section>

//       <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//           <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-8">
//             <h2 className="text-2xl font-extrabold text-[#0F1C18]">Our mission</h2>
//             <p className="text-slate-600 mt-3">
//               To make water supply and water-system services easy to book, fair to pay, and dependable to receive—
//               with clear pricing and verified technicians.
//             </p>
//           </div>
//           <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-8">
//             <h2 className="text-2xl font-extrabold text-[#0F1C18]">Reliability</h2>
//             <p className="text-slate-600 mt-3">
//               We verify every technician, show the full price before confirmation, and provide a trackable timeline.
//               Support is available when you need help.
//             </p>
//           </div>
//         </div>
//       </section>

//       <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//         <h2 className="text-2xl font-extrabold text-[#0F1C18]">Our Values</h2>
//         <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
//           {[
//             { icon: '🤝', title: 'Transparency', desc: 'Full price shown before you confirm. Always.' },
//             { icon: '⚡', title: 'Speed', desc: 'Same-day slots in most cities. Emergency options when available.' },
//             { icon: '🛡️', title: 'Verified Quality', desc: 'Every technician is ID-verified before their first job.' },
//           ].map((v) => (
//             <div key={v.title} className="rounded-2xl bg-white border border-slate-100 shadow-card p-6">
//               <div className="text-3xl">{v.icon}</div>
//               <div className="font-extrabold text-[#0F1C18] mt-3">{v.title}</div>
//               <div className="text-slate-600 mt-2 text-sm">{v.desc}</div>
//             </div>
//           ))}
//         </div>
//       </section>

//       {/* TRUST REVIEWS */}
//       <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//         <h2 className="text-2xl font-extrabold text-[#0F1C18]">Customer Trust Reviews</h2>
//         <p className="text-slate-600 mt-2 text-sm sm:text-base">
//           Real experiences from verified AuroWater customers across UP.
//         </p>

//         <div className="mt-6">
//           <SectionWrapper className="grid grid-cols-1 md:grid-cols-3 gap-6">
//             {TRUST_REVIEWS.map((r) => (
//               <div
//                 key={`${r.name}-${r.date}`}
//                 className="min-w-0 rounded-2xl border border-slate-100 bg-white/80 backdrop-blur-sm p-6 shadow-card"
//               >
//                 <div className="flex items-start justify-between gap-4">
//                   <div className="flex items-center gap-3">
//                     <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${r.color} text-white flex items-center justify-center font-extrabold`}>
//                       {r.initials}
//                     </div>
//                     <div>
//                       <div className="font-extrabold text-slate-900 leading-tight">{r.name}</div>
//                       <div className="mt-1">
//                         <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-[#E8F8F2] text-[#0D9B6C] border border-[#0D9B6C]/20">
//                           {r.city}
//                         </span>
//                       </div>
//                     </div>
//                   </div>

//                   <div className="text-right">
//                     <div className="flex justify-end gap-0.5">
//                       {Array.from({ length: 5 }).map((_, i) => {
//                         const filled = i < r.rating;
//                         return (
//                           <span
//                             key={i}
//                             className={filled ? 'text-[#0D9B6C]' : 'text-slate-300'}
//                             aria-hidden="true"
//                           >
//                             ★
//                           </span>
//                         );
//                       })}
//                     </div>
//                     <div className="text-[10px] sm:text-xs text-slate-500 font-semibold mt-1">{r.date}</div>
//                   </div>
//                 </div>

//                 <div className="mt-4">
//                   <span className="text-xs font-extrabold px-3 py-1 rounded-full border border-slate-200 text-slate-700 bg-white">
//                     {r.service}
//                   </span>
//                 </div>

//                 <p className="mt-3 italic text-sm text-gray-600 leading-relaxed">“{r.text}”</p>
//               </div>
//             ))}
//           </SectionWrapper>
//         </div>
//       </section>

//       <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//         <h2 className="text-2xl font-extrabold text-[#0F1C18]">Coverage</h2>
//         <div className="mt-4 flex flex-wrap gap-2">
//           {[
//             'Delhi',
//             'Gorakhpur',
//             'Lucknow',
//             'Varanasi',
//             'Prayagraj',
//             'Agra',
//             'Meerut',
//             'Bareilly',
//             'Aligarh',
//             'Mathura',
//             'Kanpur',
//             'Noida',
//             'Ghaziabad',
//           ].map((c) => (
//             <span key={c} className="px-4 py-2 rounded-full border border-slate-200 bg-white text-slate-700 text-sm font-semibold">
//               {c}
//             </span>
//           ))}
//         </div>
//       </section>

//       <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//         <h2 className="text-2xl font-extrabold text-[#0F1C18]">Team</h2>
//         <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
//           {team.map((m) => (
//             <div key={m.name} className="rounded-2xl bg-white border border-slate-100 shadow-card p-6 text-center">
//               <div className={`w-20 h-20 mx-auto rounded-full bg-gradient-to-br ${avatarGradient(m.name)} flex items-center justify-center text-white font-extrabold text-2xl`}>
//                 {m.initials}
//               </div>
//               <div className="font-extrabold text-[#0F1C18] mt-4">{m.name}</div>
//               <div className="text-sm text-slate-600 mt-1">{m.role}</div>
//             </div>
//           ))}
//         </div>
//       </section>

//       <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//           <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-8">
//             <div className="text-2xl font-extrabold text-[#0F1C18]">Are you a Technician?</div>
//             <p className="text-slate-600 mt-2">Join the verified network and accept job requests.</p>
//             <Link href="/contact" className="mt-6 inline-flex items-center justify-center w-full px-6 py-3 rounded-xl bg-[#0D9B6C] text-white font-extrabold hover:bg-[#086D4C] active:scale-95 transition-all">
//               Apply / Onboard
//             </Link>
//           </div>
//           <div className="rounded-2xl bg-[#E8F8F2] border border-[#0D9B6C]/20 shadow-card p-8">
//             <div className="text-2xl font-extrabold text-[#0F1C18]">Are you a Supplier?</div>
//             <p className="text-slate-700 mt-2">Get your AuroTap ID, receive orders, and manage deliveries.</p>
//             <Link href="/contact" className="mt-6 inline-flex items-center justify-center w-full px-6 py-3 rounded-xl bg-white text-[#0D9B6C] font-extrabold hover:bg-white/90 active:scale-95 transition-all border-2 border-white/80">
//               Partner with us
//             </Link>
//           </div>
//         </div>
//       </section>
//     </div>
//   );
// }
