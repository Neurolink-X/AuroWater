'use client';

import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSettings, type PlatformSettings } from '@/hooks/useSettings';
import {
  CITIES, FAQS, SERVICE_CARDS, WHATSAPP, type FaqItem,
} from './pricing-shared';

type PricingTab = 'individual' | 'business';
type BillingCycle = 'weekly' | 'monthly';

// ─── Visitor city (no visible selector) ───────────────────────────────────────
// Prices stay admin-controlled per city through useSettings(undefined, city).
// City is resolved silently: ?city=Lucknow in the URL, then the city the visitor
// already saved elsewhere on the site, then the default.
const DEFAULT_CITY = 'Kanpur';
const CITY_STORAGE_KEY = 'auro_city';
const SUPPORTED_CITIES = ['Kanpur', 'Lucknow', 'Gorakhpur', 'Noida', 'Delhi', 'Ghaziabad', 'Gurugram'];

function useVisitorCity(): string {
  const [city] = useState(() => {
    // Resolve client-only inputs lazily to avoid a synchronous state update in an effect.
    // The server render uses the safe default; URL/storage preferences are applied on mount.
    if (typeof window === 'undefined') return DEFAULT_CITY;
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('city');
      const fromStore = window.localStorage.getItem(CITY_STORAGE_KEY);
      const match = [fromUrl, fromStore]
        .map((v) => SUPPORTED_CITIES.find((c) => v && c.toLowerCase() === v.trim().toLowerCase()))
        .find(Boolean);
      if (match) {
        window.localStorage.setItem(CITY_STORAGE_KEY, match);
        return match;
      }
    } catch { /* storage blocked: keep default */ }
    return DEFAULT_CITY;
  });
  return city;
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function IconCheck() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }} aria-hidden>
      <circle cx="7.5" cy="7.5" r="7" fill="#DCFCE7" />
      <path d="M4.5 7.5L6.5 9.5L10.5 5.5" stroke="#16A34A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconX() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }} aria-hidden>
      <circle cx="7.5" cy="7.5" r="7" fill="#F3F4F6" />
      <path d="M5.5 9.5L9.5 5.5M9.5 9.5L5.5 5.5" stroke="#9CA3AF" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconWA() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M20 11.5C20 15.64 16.42 19 12.2 19C10.7 19 9.3 18.61 8.1 17.9L4 19L5.1 15.2C4.45 14 4.1 12.7 4.1 11.5C4.1 7.36 7.68 4 11.9 4C16.12 4 20 7.36 20 11.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9.2 9.4C9.4 9.1 9.7 9 10 9C10.3 9 10.6 9.1 10.7 9.4L11.3 10.7C11.4 10.9 11.4 11.1 11.3 11.3L11 11.7C10.9 11.8 10.9 12 11 12.2C11.3 12.8 11.8 13.4 12.4 13.7C12.6 13.8 12.8 13.8 12.9 13.7L13.3 13.4C13.5 13.3 13.7 13.3 13.9 13.4L15.2 14C15.5 14.1 15.6 14.4 15.6 14.7C15.6 15 15.5 15.3 15.3 15.5C15 15.7 14.7 15.9 14.4 16C14 16.1 13.6 16.1 13.2 16C10.8 15.2 9 13.4 8.2 11C8.1 10.6 8.1 10.2 8.2 9.8C8.3 9.5 8.5 9.2 9.2 9.4Z" fill="currentColor" opacity="0.95" />
    </svg>
  );
}

// ─── Pill tag ─────────────────────────────────────────────────────────────────
function Pill({ children, color = 'green' }: { children: React.ReactNode; color?: 'green' | 'blue' | 'amber' | 'slate' }) {
  const map = {
    green: { bg: '#ECFDF5', color: '#065F46', border: '#6EE7B7' },
    blue: { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
    amber: { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
    slate: { bg: '#F8FAFC', color: '#475569', border: '#CBD5E1' },
  };
  const s = map[color];
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '3px 10px', letterSpacing: '0.04em', display: 'inline-block' }}>
      {children}
    </span>
  );
}

// ─── Spatial water scene (fixed, GPU-only transforms, pointer + scroll parallax via CSS variables) ───
const BUBBLES = [
  { l: 6, s: 14, d: 19, t: 0 }, { l: 14, s: 8, d: 24, t: 6 }, { l: 23, s: 20, d: 28, t: 2 }, { l: 31, s: 10, d: 21, t: 11 },
  { l: 42, s: 16, d: 26, t: 4 }, { l: 51, s: 9, d: 20, t: 9 }, { l: 60, s: 22, d: 30, t: 1 }, { l: 68, s: 11, d: 23, t: 13 },
  { l: 76, s: 15, d: 27, t: 5 }, { l: 84, s: 8, d: 22, t: 8 }, { l: 91, s: 18, d: 29, t: 3 }, { l: 97, s: 12, d: 25, t: 10 },
];

const SpatialScene = memo(function SpatialScene() {
  return (
    <div className="scene" aria-hidden>
      <span className="orb" style={{ width: 420, height: 420, left: '-8%', top: '8%', ['--dx' as string]: -26, ['--dy' as string]: -18, ['--sp' as string]: 0.06 }} />
      <span className="orb" style={{ width: 320, height: 320, right: '-6%', top: '34%', ['--dx' as string]: 34, ['--dy' as string]: 22, ['--sp' as string]: 0.1 }} />
      <span className="orb" style={{ width: 240, height: 240, left: '38%', top: '62%', ['--dx' as string]: -14, ['--dy' as string]: 30, ['--sp' as string]: 0.14 }} />
      {BUBBLES.map((b, i) => (
        <span key={i} className="bubble" style={{ left: `${b.l}%`, width: b.s, height: b.s, animationDuration: `${b.d}s`, animationDelay: `-${b.t}s` }} />
      ))}
      <svg className="wave w1" viewBox="0 0 2880 160" preserveAspectRatio="none"><path d="M0 80 C 240 20 480 140 720 80 S 1200 20 1440 80 S 1920 140 2160 80 S 2640 20 2880 80 V160 H0 Z" fill="rgba(125,200,240,.22)" /></svg>
      <svg className="wave w2" viewBox="0 0 2880 160" preserveAspectRatio="none"><path d="M0 90 C 300 150 600 30 900 90 S 1500 150 1800 90 S 2400 30 2880 90 V160 H0 Z" fill="rgba(56,189,248,.16)" /></svg>
    </div>
  );
});

// ─── Subscription card ────────────────────────────────────────────────────────
type SubPlan = {
  id: string;
  name: string;
  tagline: string;
  badge?: string;
  badgeColor?: 'green' | 'blue' | 'amber';
  pricePerDelivery: number;
  unitPrice: number | null;
  cansPerDelivery: number | string;
  perCan: string;
  features: { text: string; included: boolean }[];
  cta: string;
  ctaVariant: 'primary' | 'outline' | 'dark';
  highlight?: boolean;
};

const SubCard = memo(function SubCard({ plan, frequency, onCta }: { plan: SubPlan; frequency: BillingCycle; onCta: () => void }) {
  const price = plan.pricePerDelivery;
  return (
    <article
      className={plan.highlight ? 'plan-hl' : 'nu nu-hover'}
      style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', background: plan.highlight ? 'linear-gradient(160deg,#022C22,#065F46)' : undefined }}
    >
      <div style={{
        height: 5,
        background: plan.highlight
          ? 'linear-gradient(90deg,#34D399,#0D9B6C)'
          : plan.id === 'pay-per-can' ? 'linear-gradient(90deg,#38BDF8,#0369A1)'
          : plan.id === 'office' ? 'linear-gradient(90deg,#F59E0B,#D97706)'
          : 'linear-gradient(90deg,#CBD5E1,#94A3B8)',
      }} />

      {plan.badge && (
        <div style={{ position: 'absolute', top: 18, right: 18 }}>
          <Pill color={plan.badgeColor ?? 'green'}>{plan.badge}</Pill>
        </div>
      )}

      <div style={{ padding: '24px 26px', flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ marginBottom: 18, paddingRight: plan.badge ? 84 : 0 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: plan.highlight ? '#fff' : '#0F172A', letterSpacing: '-0.3px' }}>{plan.name}</h3>
          <div style={{ fontSize: 12.5, color: plan.highlight ? 'rgba(255,255,255,0.75)' : '#475569', marginTop: 3, fontWeight: 500, lineHeight: 1.4 }}>{plan.tagline}</div>
        </div>

        <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${plan.highlight ? 'rgba(255,255,255,0.12)' : 'rgba(148,163,184,.35)'}` }}>
          {plan.pricePerDelivery > 0 ? (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <span style={{ fontSize: 38, fontWeight: 900, letterSpacing: '-1.5px', color: plan.highlight ? '#34D399' : '#0F172A', lineHeight: 1 }}>₹{price.toLocaleString('en-IN')}</span>
              <span style={{ fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.65)' : '#64748B', marginBottom: 4, fontWeight: 500 }}>/delivery</span>
            </div>
          ) : (
            <div style={{ fontSize: 32, fontWeight: 900, color: plan.highlight ? '#34D399' : '#0F172A', letterSpacing: '-1px' }}>Custom</div>
          )}
          <div style={{ marginTop: 6, fontSize: 13, color: plan.highlight ? '#6EE7B7' : '#047857', fontWeight: 700, lineHeight: 1.45 }}>{plan.perCan}</div>
          <div style={{ marginTop: 7, fontSize: 11.5, fontWeight: 700, color: plan.highlight ? '#A7F3D0' : '#475569' }}>Delivery included. No separate water handling fee.</div>
          {typeof plan.cansPerDelivery === 'number' && (
            <div style={{ marginTop: 3, fontSize: 12, color: plan.highlight ? 'rgba(255,255,255,0.65)' : '#64748B' }}>
              {plan.id === 'pay-per-can' ? 'Example total for 1 can' : `${plan.id === 'office' ? '' : 'Up to '}${plan.cansPerDelivery} cans per delivery`}
            </div>
          )}
          {plan.id !== 'pay-per-can' && plan.id !== 'business' && plan.id !== 'office' ? (
            <div style={{ marginTop: 4, fontSize: 12, color: plan.highlight ? '#A7F3D0' : '#475569' }}>
              Schedule: {frequency === 'weekly' ? 'weekly' : 'monthly'}, pay per delivery
            </div>
          ) : null}
        </div>

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          {plan.features.map((f) => (
            <li key={f.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              {f.included ? <IconCheck /> : <IconX />}
              <span style={{ fontSize: 13, fontWeight: 500, color: plan.highlight ? (f.included ? '#D1FAE5' : 'rgba(255,255,255,0.55)') : (f.included ? '#334155' : '#64748B'), lineHeight: 1.4 }}>
                {f.included ? '' : <span className="sr-only">Not included: </span>}{f.text}
              </span>
            </li>
          ))}
        </ul>

        <button type="button" onClick={onCta} className={`cta cta-${plan.ctaVariant}`} style={{ marginTop: 24 }}>
          {plan.cta}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </article>
  );
});

// ─── FAQ accordion (answers stay in the DOM, so they are crawlable and animate smoothly) ───
function FaqAccordion({ faq }: { faq: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {faq.map((item, idx) => {
        const isOpen = open === idx;
        return (
          <div key={item.q} className={isOpen ? 'nu-in' : 'nu-sm'} style={{ borderRadius: 16, overflow: 'hidden', transition: 'box-shadow .25s' }}>
            <h3 style={{ margin: 0 }}>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`faq-a-${idx}`}
                id={`faq-q-${idx}`}
                onClick={() => setOpen((cur) => (cur === idx ? null : idx))}
                style={{ width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', minHeight: 52 }}
              >
                <span style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{item.q}</span>
                <span aria-hidden style={{ fontSize: 20, color: '#047857', fontWeight: 700, flexShrink: 0, transform: isOpen ? 'rotate(45deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>+</span>
              </button>
            </h3>
            <div id={`faq-a-${idx}`} role="region" aria-labelledby={`faq-q-${idx}`} className="faq-a" data-open={isOpen}>
              <div><p style={{ margin: 0, padding: '0 20px 16px', fontSize: 13, color: '#475569', lineHeight: 1.65 }}>{item.a}</p></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Compare table ────────────────────────────────────────────────────────────
function CompareTable({ settings, officeQuantity, normalPrice }: { settings: PlatformSettings; officeQuantity: number; normalPrice: number }) {
  const rows = [
    { feature: 'Per-can rate', payg: `₹${normalPrice}`, starter: `₹${settings.subscription_can_price}`, pro: `₹${settings.subscription_can_price}`, office: `₹${normalPrice}`, business: 'Quote' },
    { feature: 'Separate water handling fee', payg: 'None for water cans', starter: 'None for water cans', pro: 'None for water cans', office: 'None for water cans', business: 'Confirmed in quote' },
    { feature: 'Cans per delivery', payg: 'As needed', starter: 'Up to 10', pro: 'Up to 20', office: `${officeQuantity}+`, business: 'Custom' },
    { feature: 'Recurring schedule', payg: 'Not required', starter: 'Weekly / monthly', pro: 'Weekly / monthly', office: 'Weekly / monthly', business: 'By agreement' },
    { feature: 'Payment', payg: 'Cash / UPI', starter: 'Cash / UPI per delivery', pro: 'Cash / UPI per delivery', office: 'Cash / UPI per delivery', business: 'Confirmed before order' },
    { feature: 'Automatic debit', payg: 'No', starter: 'No', pro: 'No', office: 'No', business: 'Only if separately agreed' },
    { feature: 'Service availability', payg: 'Address checked', starter: 'Address checked', pro: 'Address checked', office: 'Capacity checked', business: 'Confirmed in quote' },
  ];
  const cols = ['Feature', 'Pay as you go', 'Home Starter', 'Family', 'Bulk Delivery', 'Business / Society'];

  return (
    <div className="nu" style={{ overflowX: 'auto', borderRadius: 20 }} tabIndex={0} role="region" aria-label="Plan comparison table, scrollable">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 760 }}>
        <caption className="sr-only">Comparison of all water delivery plans</caption>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,.45)' }}>
            {cols.map((c, i) => (
              <th key={c} scope="col" style={{ padding: '14px 18px', textAlign: i === 0 ? 'left' : 'center', fontWeight: 700, color: i === 2 ? '#065F46' : '#334155', fontSize: 12, letterSpacing: '0.04em', borderBottom: '1.5px solid rgba(148,163,184,.4)', background: i === 2 ? '#D1FAE5' : undefined }}>
                {c}{i === 2 ? ' ⭐' : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row.feature} style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.35)' }}>
              <th scope="row" style={{ padding: '13px 18px', textAlign: 'left', fontWeight: 600, color: '#334155', borderBottom: '1px solid rgba(148,163,184,.25)' }}>{row.feature}</th>
              {[row.payg, row.starter, row.pro, row.office, row.business].map((val, ci) => (
                <td key={ci} style={{ padding: '13px 18px', textAlign: 'center', color: ci === 1 ? '#065F46' : '#334155', fontWeight: ci === 1 ? 700 : 500, borderBottom: '1px solid rgba(148,163,184,.25)', background: ci === 1 ? 'rgba(209,250,229,.45)' : undefined }}>
                  {val}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Monthly water cost estimator ─────────────────────────────────────────────
function WaterCalculator({ onOrder, normalPrice, chilledPrice, recurringPrice }: { onOrder: (water: 'normal' | 'chilled') => void; normalPrice: number; chilledPrice: number; recurringPrice: number }) {
  const [cans, setCans] = useState(10);
  const [water, setWater] = useState<'normal' | 'chilled'>('normal');
  const [cycle, setCycle] = useState<BillingCycle>('weekly');
  // Weekly/monthly deliveries are recurring, so Normal RO uses the admin recurring rate.
  const normalRate = recurringPrice || normalPrice;
  const rate = water === 'normal' ? normalRate : chilledPrice;
  const perDelivery = cans * rate;
  const monthly = Math.round(perDelivery * (cycle === 'weekly' ? 52 / 12 : 1));
  const pct = ((cans - 1) / 99) * 100;
  const seg = (on: boolean): React.CSSProperties => ({ flex: 1, minHeight: 44, padding: '0 14px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: on ? '#047857' : '#475569', background: '#E3EDF6', boxShadow: on ? 'inset 4px 4px 8px #b7c8d9, inset -4px -4px 8px #fff' : '5px 5px 10px #b7c8d9, -5px -5px 10px #fff', transition: 'box-shadow .2s, color .2s' });

  return (
    <div className="nu" style={{ borderRadius: 24, padding: 'clamp(20px,4vw,32px)', display: 'grid', gap: 28, gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))' }}>
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#047857' }}>Cost estimator</p>
        <h2 id="calc-title" style={{ margin: '6px 0 0', fontSize: 'clamp(1.35rem,3vw,1.8rem)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.5px' }}>Plan your monthly water spend</h2>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: '#475569', lineHeight: 1.6 }}>Pick the water, the cans per delivery and how often you want it. This is an estimate; the final payable total is shown before you confirm.</p>

        <div role="group" aria-label="Water type" style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <button type="button" aria-pressed={water === 'normal'} onClick={() => setWater('normal')} style={seg(water === 'normal')}>Normal RO · ₹{normalRate}</button>
          <button type="button" aria-pressed={water === 'chilled'} onClick={() => setWater('chilled')} style={seg(water === 'chilled')}>Chilled RO · ₹{chilledPrice}</button>
        </div>
        <div role="group" aria-label="Delivery frequency" style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button type="button" aria-pressed={cycle === 'weekly'} onClick={() => setCycle('weekly')} style={seg(cycle === 'weekly')}>Weekly</button>
          <button type="button" aria-pressed={cycle === 'monthly'} onClick={() => setCycle('monthly')} style={seg(cycle === 'monthly')}>Monthly</button>
        </div>

        <label htmlFor="calc-cans" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
          Cans per delivery <span style={{ color: '#047857' }}>{cans}</span>
        </label>
        <input id="calc-cans" className="range" type="range" min={1} max={100} value={cans} onChange={(e) => setCans(Number(e.target.value))} style={{ width: '100%', marginTop: 10, background: `linear-gradient(90deg,#0EA5E9 ${pct}%,#cfdeeb ${pct}%)` }} />
        {cans >= 50 && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#92400E', fontWeight: 600 }}>50+ cans: confirm a volume quote before booking.</p>}
      </div>

      <div className="nu-in" style={{ borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }} aria-live="polite">
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#64748B' }}>Each delivery</p>
        <p style={{ margin: '2px 0 0', fontSize: 30, fontWeight: 900, color: '#0F172A', letterSpacing: '-1px' }}>₹{perDelivery.toLocaleString('en-IN')}</p>
        <p style={{ margin: '16px 0 0', fontSize: 12, fontWeight: 700, color: '#64748B' }}>About per month</p>
        <p style={{ margin: '2px 0 0', fontSize: 38, fontWeight: 900, color: '#047857', letterSpacing: '-1.5px' }}>₹{monthly.toLocaleString('en-IN')}</p>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748B' }}>{cans} × ₹{rate}. Delivery included, no separate water handling fee.</p>
        <button type="button" onClick={() => onOrder(water)} className="cta cta-primary" style={{ marginTop: 20 }}>
          Order {water === 'normal' ? 'Normal' : 'Chilled'} RO
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden><path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const CSS = `
  .pricing-page * { box-sizing: border-box; font-family: var(--font-dm), 'DM Sans', system-ui, sans-serif; }
  .pricing-page h1, .pricing-page h2, .pricing-page .display { font-family: var(--font-syne), 'Syne', system-ui, sans-serif; }
  .pricing-page .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; }
  .pricing-page { position: relative; min-height: 100vh; background: #E3EDF6; overflow-x: clip; scroll-behavior: smooth; }
  .pricing-page > .layer { position: relative; z-index: 1; display: block; }

  @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse { 0%,100%{box-shadow:0 0 0 3px rgba(16,185,129,0.2);} 50%{box-shadow:0 0 0 7px rgba(16,185,129,0.06);} }
  @keyframes rise { from { transform: translate3d(0,105vh,0); } to { transform: translate3d(0,-15vh,0); } }
  @keyframes drift { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50%,0,0); } }

  .pricing-page .nu { background:#E3EDF6; box-shadow: 9px 9px 18px #b7c8d9, -9px -9px 18px #ffffff; }
  .pricing-page .nu-sm { background:#E3EDF6; box-shadow: 5px 5px 10px #b7c8d9, -5px -5px 10px #ffffff; }
  .pricing-page .nu-in { background:#E3EDF6; box-shadow: inset 5px 5px 10px #b7c8d9, inset -5px -5px 10px #ffffff; }
  .pricing-page .nu-hover { transition: transform .3s cubic-bezier(.22,1,.36,1); }
  .pricing-page .nu-hover:hover { transform: translateY(-5px); }
  .pricing-page .nu-press:active { box-shadow: inset 4px 4px 8px #b7c8d9, inset -4px -4px 8px #ffffff; }
  .pricing-page .plan-hl { border: 2px solid #0D9B6C; box-shadow: 0 20px 60px rgba(13,155,108,0.28); }
  .pricing-page :is(a,button,input,[tabindex]):focus-visible { outline: 3px solid rgba(2,132,199,.6); outline-offset: 3px; }

  .pricing-page .cta { width:100%; padding:13px 0; min-height:48px; border-radius:14px; font-weight:800; font-size:14px; cursor:pointer; letter-spacing:-0.2px; transition: transform .2s, box-shadow .2s, background .2s; display:flex; align-items:center; justify-content:center; gap:7px; border:none; text-decoration:none; }
  .pricing-page .cta:active { transform: scale(.98); }
  .pricing-page .cta-primary { background: linear-gradient(135deg,#0D9B6C,#059652); color:#fff; box-shadow: 0 4px 14px rgba(13,155,108,0.3); }
  .pricing-page .cta-primary:hover { box-shadow: 0 8px 24px rgba(13,155,108,0.45); transform: translateY(-1px); }
  .pricing-page .cta-outline { background:#E3EDF6; color:#047857; box-shadow: 5px 5px 10px #b7c8d9, -5px -5px 10px #fff; }
  .pricing-page .cta-outline:hover { color:#065F46; }
  .pricing-page .cta-outline:active { box-shadow: inset 4px 4px 8px #b7c8d9, inset -4px -4px 8px #fff; }
  .pricing-page .cta-dark { background:#0F172A; color:#fff; border:1px solid rgba(255,255,255,0.12); }
  .pricing-page .cta-dark:hover { background:#1E293B; }

  .pricing-page .faq-a { display:grid; grid-template-rows: 0fr; transition: grid-template-rows .3s ease; }
  .pricing-page .faq-a[data-open="true"] { grid-template-rows: 1fr; }
  .pricing-page .faq-a > div { overflow:hidden; }

  .pricing-page .scene { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; background: linear-gradient(180deg,#EAF3FA 0%,#E3EDF6 55%,#D6E7F4 100%); contain: strict; }
  .pricing-page .orb { position: absolute; border-radius: 50%; background: radial-gradient(circle at 30% 28%, rgba(255,255,255,.95), rgba(125,200,240,.30) 52%, rgba(125,200,240,0) 70%); transform: translate3d(calc(var(--px,0) * var(--dx) * 1px), calc(var(--py,0) * var(--dy) * 1px - var(--sy,0) * var(--sp) * 1px), 0); transition: transform .5s cubic-bezier(.22,1,.36,1); will-change: transform; }
  .pricing-page .bubble { position: absolute; top: 0; border-radius: 50%; background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.95), rgba(186,230,253,.35) 60%, rgba(186,230,253,.05)); box-shadow: inset -2px -2px 4px rgba(56,189,248,.18), 1px 1px 3px rgba(255,255,255,.7); animation: rise linear infinite; will-change: transform; opacity: .7; }
  .pricing-page .wave { position: absolute; left: 0; width: 200%; height: 160px; animation: drift linear infinite; will-change: transform; }
  .pricing-page .w1 { bottom: 0; animation-duration: 36s; }
  .pricing-page .w2 { bottom: -18px; animation-duration: 54s; animation-direction: reverse; }

  .pricing-page .h-orb { position:absolute; border-radius:50%; border:1px solid rgba(255,255,255,.14); background: radial-gradient(circle at 30% 28%, rgba(255,255,255,.22), rgba(52,211,153,.08) 55%, rgba(52,211,153,0) 72%); pointer-events:none; transform: translate3d(calc(var(--px,0) * var(--dx) * 1px), calc(var(--py,0) * var(--dy) * 1px), 0); transition: transform .5s cubic-bezier(.22,1,.36,1); will-change: transform; }

  /* Hero */
  .pricing-page .hero { background: linear-gradient(135deg,#022C22 0%,#064E3B 55%,#0D9B6C 100%); padding: clamp(40px,7vw,72px) 24px clamp(88px,10vw,112px); position: relative; overflow: hidden; }
  .pricing-page .hero-inner { max-width: 1160px; margin: 0 auto; position: relative; z-index: 1; }
  .pricing-page .hero-copy { max-width: min(100%, 620px); }
  .pricing-page .hero h1 { margin: 0; font-weight: 900; line-height: 1.04; letter-spacing: -1.2px; font-size: clamp(2rem, 5.2vw, 3.5rem); color: #fff; text-wrap: balance; }
  .pricing-page .hero h1 em { font-style: normal; color: #34D399; display: block; }
  .pricing-page .hero-sub { margin: 16px 0 0; font-family: var(--font-syne), 'Syne', system-ui, sans-serif; font-weight: 800; letter-spacing: -0.5px; line-height: 1.2; font-size: clamp(1.15rem, 2.6vw, 1.7rem); color: #fff; }
  .pricing-page .hero-sub span { color: #34D399; }
  .pricing-page .hero-sub small { display: block; margin-top: 4px; font-size: .68em; font-weight: 600; letter-spacing: 0; color: rgba(255,255,255,.72); }
  .pricing-page .hero-lead { margin: 16px 0 0; font-size: clamp(14.5px, 1.6vw, 16.5px); color: rgba(255,255,255,.8); max-width: 520px; line-height: 1.65; }
  .pricing-page .hero-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
  .pricing-page .h-btn { border-radius: 999px; padding: 12px 20px; min-height: 46px; font-weight: 800; font-size: 14px; cursor: pointer; transition: transform .18s, box-shadow .18s, background .18s; }
  .pricing-page .h-btn:hover { transform: translateY(-1px); }
  .pricing-page .h-btn-main { border: 0; background: #34D399; color: #022C22; box-shadow: 0 6px 20px rgba(52,211,153,.35); }
  .pricing-page .h-btn-main:hover { background: #6EE7B7; }
  .pricing-page .h-btn-ghost { border: 1px solid rgba(255,255,255,.4); background: rgba(255,255,255,.08); color: #fff; }
  .pricing-page .h-btn-ghost:hover { background: rgba(255,255,255,.16); }
  .pricing-page .hero-points { display: flex; flex-wrap: wrap; gap: 10px; margin: 26px 0 0; padding: 0; list-style: none; }
  .pricing-page .hero-points li { display: flex; align-items: center; gap: 7px; background: rgba(255,255,255,.09); border-radius: 999px; padding: 7px 14px; border: 1px solid rgba(255,255,255,.14); font-size: 13px; color: rgba(255,255,255,.9); font-weight: 600; }
  .pricing-page .hero-areas { display: inline-flex; align-items: center; gap: 8px; background: rgba(52,211,153,0.15); border: 1px solid rgba(52,211,153,0.3); border-radius: 999px; padding: 6px 14px; margin-bottom: 20px; font-size: 12px; font-weight: 700; color: #A7F3D0; letter-spacing: .03em; max-width: 100%; }

  .pricing-hero-illustration { position: absolute; right: max(20px, calc((100vw - 1160px) / 2)); top: 50%; transform: translateY(-50%); width: min(30vw, 340px); height: auto; opacity: .95; pointer-events: none; }
  @media (max-width: 1100px) { .pricing-hero-illustration { display: none; } }
  .pricing-page .plan-card { animation: fadeUp 0.5s ease both; }
  .pricing-page .plan-card:nth-child(1){animation-delay:0ms}
  .pricing-page .plan-card:nth-child(2){animation-delay:80ms}
  .pricing-page .plan-card:nth-child(3){animation-delay:160ms}
  .pricing-page .defer { content-visibility: auto; contain-intrinsic-size: auto 520px; }

  .pricing-page input[type=range].range { -webkit-appearance:none; appearance:none; height:8px; border-radius:8px; box-shadow: inset 2px 2px 4px #b7c8d9, inset -2px -2px 4px #fff; cursor:pointer; }
  .pricing-page input[type=range].range::-webkit-slider-thumb { -webkit-appearance:none; width:24px; height:24px; border-radius:50%; background:#0EA5E9; border:3px solid #E3EDF6; box-shadow: 3px 3px 6px #b7c8d9; cursor:pointer; }
  .pricing-page input[type=range].range::-moz-range-thumb { width:18px; height:18px; border-radius:50%; background:#0EA5E9; border:3px solid #E3EDF6; cursor:pointer; }
  .pricing-page .billing-toggle button { transition: color .2s, background .2s; }

  .pricing-page .m-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; display: flex; gap: 10px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: linear-gradient(180deg, rgba(227,237,246,0), #E3EDF6 35%); }
  .pricing-page .m-spacer { height: 84px; }
  @media (min-width: 900px) { .pricing-page .m-bar, .pricing-page .m-spacer { display: none; } }
  @media (max-width: 640px) { .pricing-page .bubble:nth-child(n+7) { display: none; } }
  @media (prefers-reduced-motion: reduce) {
    .pricing-page *, .pricing-page *::before { animation: none !important; transition: none !important; }
    .pricing-page { scroll-behavior: auto; }
    .pricing-page .bubble { display: none; }
  }

  .pc-root { max-width: 1160px; margin: -44px auto 0; padding: 0 24px; position: relative; z-index: 10; }
  .pc-card { background: #E3EDF6; border-radius: 24px; box-shadow: 9px 9px 22px #b7c8d9, -9px -9px 22px #ffffff, 0 24px 56px rgba(13,155,108,0.10); overflow: hidden; }
  .pc-accent-bar { height: 3px; background: linear-gradient(90deg, #0D9B6C 0%, #34D399 50%, #0D9B6C 100%); }
  .pc-grid { display: grid; grid-template-columns: auto 1px 1fr; align-items: stretch; }
  .pc-left { display: flex; align-items: center; gap: 16px; padding: 24px 28px; }
  .pc-icon { width: 52px; height: 52px; border-radius: 15px; background: #E3EDF6; box-shadow: inset 4px 4px 8px #b7c8d9, inset -4px -4px 8px #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .pc-label { font-size: 11px; font-weight: 700; color: #475569; letter-spacing: 0.08em; text-transform: uppercase; }
  .pc-badge { font-size: 10px; font-weight: 700; color: #065F46; background: #ECFDF5; border: 1px solid #A7F3D0; padding: 2px 7px; border-radius: 99px; letter-spacing: 0.04em; white-space: nowrap; }
  .pc-price-main { font-family: var(--font-syne), 'Syne', sans-serif; font-weight: 900; font-size: 32px; color: #0F1C18; letter-spacing: -1.5px; line-height: 1; }
  .pc-save-pill { display: inline-flex; align-items: center; gap: 4px; background: #FEF9C3; border: 1px solid #FDE047; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; color: #78350F; }
  .pc-vdivider { width: 1px; align-self: stretch; background: linear-gradient(to bottom, transparent 10%, #b7c8d9 40%, #b7c8d9 60%, transparent 90%); }
  .pc-right { display: flex; flex-direction: column; justify-content: center; gap: 16px; padding: 22px 24px 22px 28px; min-width: 0; }
  .pc-tiers { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .pc-tier { border-radius: 14px; padding: 12px 14px; position: relative; box-shadow: 4px 4px 9px #b7c8d9, -4px -4px 9px #fff; transition: transform 0.2s ease; min-width: 0; }
  .pc-tier:hover { transform: translateY(-2px); }
  .pc-tier-label { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px; }
  .pc-tier-price { font-family: var(--font-syne), 'Syne', sans-serif; font-weight: 900; font-size: 17px; letter-spacing: -0.4px; line-height: 1.15; }
  .pc-tier-sub { font-size: 11px; font-weight: 600; margin-top: 3px; line-height: 1.35; }
  .pc-cta-row { display: flex; align-items: center; gap: 12px 18px; flex-wrap: wrap; }
  .pc-cta-btn { background: #0D9B6C; color: #fff; font-weight: 700; font-size: 14px; letter-spacing: -0.2px; padding: 13px 24px; min-height: 48px; border-radius: 13px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; flex-shrink: 0; box-shadow: 0 4px 16px rgba(13,155,108,0.30); transition: transform 0.18s ease, box-shadow 0.18s ease; }
  .pc-cta-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(13,155,108,0.40); }
  .pc-cta-btn:active { transform: scale(0.97); }
  .pc-cta-arrow { background: rgba(255,255,255,0.2); padding: 2px 7px; border-radius: 6px; font-size: 11px; font-weight: 600; }
  .pc-trust { display: flex; align-items: center; gap: 5px 8px; font-size: 12px; color: #475569; font-weight: 500; flex-wrap: wrap; }
  .pc-trust-dot { width: 3px; height: 3px; border-radius: 50%; background: #94A3B8; flex-shrink: 0; display: inline-block; }

  @media (max-width: 960px) {
    .pc-grid { grid-template-columns: 1fr; }
    .pc-vdivider { display: none; }
    .pc-left { padding: 22px 22px 16px; border-bottom: 1px solid rgba(148,163,184,.3); }
    .pc-right { padding: 18px 22px 22px; }
  }
  @media (max-width: 760px) {
    .pc-tiers { grid-template-columns: 1fr; }
    .pc-tier { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 14px; }
    .pc-tier-sub { margin-top: 0; text-align: right; }
  }
  @media (max-width: 560px) {
    .pricing-page .hero { padding-left: 16px; padding-right: 16px; }
    .pc-root { padding: 0 16px; margin-top: -32px; }
    .pc-card { border-radius: 18px; }
    .pc-left { padding: 18px 18px 14px; gap: 12px; }
    .pc-icon { width: 44px; height: 44px; border-radius: 12px; }
    .pc-price-main { font-size: 28px; }
    .pc-right { padding: 16px 18px 20px; gap: 14px; }
    .pc-cta-btn { width: 100%; justify-content: center; }
    .pricing-page .hero-actions .h-btn { flex: 1 1 100%; }
  }
  @media (max-width: 360px) { .pc-price-main { font-size: 24px; } .pc-left { gap: 10px; } }
`;

// Rendered once; state changes elsewhere on the page never re-parse the stylesheet.
const PageStyles = memo(function PageStyles() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
});

const H2: React.CSSProperties = { margin: 0, fontSize: 'clamp(1.3rem,3vw,2rem)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.5px' };

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function PricingClient() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<PricingTab>('individual');
  const [billing, setBilling] = useState<BillingCycle>('weekly');
  const [showCompare, setShowCompare] = useState(false);
  const city = useVisitorCity();
  // Every price on this page comes from admin settings (per city). Change a price
  // in the admin panel and this page shows it, with no code change.
  const { settings } = useSettings(undefined, city);
  const normalPrice = settings.default_can_price;
  const chilledPrice = settings.chilled_can_price;
  const recurringPrice = settings.subscription_can_price;

  // Pointer + scroll parallax: CSS variables only (no re-render), rAF-throttled, mouse only, off for reduced motion.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0, px = 0, py = 0, sy = 0;
    const apply = () => {
      raf = 0;
      el.style.setProperty('--px', px.toFixed(3));
      el.style.setProperty('--py', py.toFixed(3));
      el.style.setProperty('--sy', String(sy));
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(apply); };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      px = (e.clientX / window.innerWidth - 0.5) * 2;
      py = (e.clientY / window.innerHeight - 0.5) * 2;
      schedule();
    };
    const onScroll = () => { sy = Math.min(window.scrollY, 2400); schedule(); };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Public totals follow the server-authoritative launch pricing in /api/customer/orders.
  const deliveryTotal = (quantity: number, orderType: 'one_time' | 'subscription' = 'subscription') => {
    const unit = orderType === 'subscription' ? recurringPrice : normalPrice;
    return quantity * unit;
  };
  const officeQuantity = Math.max(50, settings.bulk_threshold);

  const faq: FaqItem[] = FAQS;

  const individualPlans: SubPlan[] = [
    {
      id: 'pay-per-can',
      name: 'Pay as you go',
      tagline: 'No commitment. Order only when needed.',
      pricePerDelivery: deliveryTotal(1, 'one_time'),
      unitPrice: normalPrice,
      cansPerDelivery: 1,
      perCan: `₹${normalPrice}/can, no separate water handling fee, before any legally applicable tax`,
      features: [
        { text: '20L water can delivery', included: true },
        { text: 'Choose from available delivery slots', included: true },
        { text: 'Pay on delivery (Cash/UPI)', included: true },
        { text: 'View order status in your account', included: true },
        { text: 'Subscription discount', included: false },
        { text: 'Scheduled repeat deliveries', included: false },
        { text: 'Priority support', included: false },
      ],
      cta: 'Order a Can',
      ctaVariant: 'outline',
    },
    {
      id: 'starter',
      name: 'Home Starter',
      tagline: 'A convenient recurring schedule for home.',
      badge: 'Most Popular',
      badgeColor: 'green',
      pricePerDelivery: deliveryTotal(10),
      unitPrice: recurringPrice,
      cansPerDelivery: 10,
      perCan: `₹${recurringPrice}/can recurring rate, no separate water handling fee, before any legally applicable tax`,
      features: [
        { text: '10 cans per delivery at the recurring rate', included: true },
        { text: 'Flexible delivery schedule', included: true },
        { text: 'Select weekly or monthly delivery', included: true },
        { text: 'Pay on delivery (Cash/UPI)', included: true },
        { text: 'Pay separately for each delivery', included: true },
        { text: 'Pause or cancel future deliveries', included: true },
        { text: 'Priority support', included: false },
      ],
      cta: 'Start Starter Plan',
      ctaVariant: 'primary',
      highlight: true,
    },
    {
      id: 'pro',
      name: 'Family',
      tagline: 'For households that need more cans per delivery.',
      badge: 'Best Value',
      badgeColor: 'blue',
      pricePerDelivery: deliveryTotal(20),
      unitPrice: recurringPrice,
      cansPerDelivery: 20,
      perCan: `₹${recurringPrice}/can recurring rate, no separate water handling fee, before any legally applicable tax`,
      features: [
        { text: '20 cans per delivery at the recurring rate', included: true },
        { text: 'Choose weekly or monthly delivery', included: true },
        { text: 'Clear total before each booking', included: true },
        { text: 'Cash or UPI payment per delivery', included: true },
        { text: 'Order history and status updates', included: true },
        { text: 'Pause or cancel future deliveries', included: true },
        { text: 'No automatic debit', included: true },
      ],
      cta: 'Start Family Plan',
      ctaVariant: 'outline',
    },
  ];

  const businessPlans: SubPlan[] = [
    {
      id: 'office',
      name: 'Bulk Delivery',
      tagline: 'For offices, shops and high-volume households.',
      badge: 'Popular',
      badgeColor: 'amber',
      pricePerDelivery: deliveryTotal(officeQuantity, 'one_time'),
      unitPrice: normalPrice,
      cansPerDelivery: officeQuantity,
      // Uses the same rate the order API charges, so the card total and per-can line always agree.
      perCan: `₹${normalPrice}/can, no separate water handling fee, before any legally applicable tax`,
      features: [
        { text: `${officeQuantity} cans per delivery`, included: true },
        { text: 'Scheduled bulk deliveries', included: true },
        { text: 'Final total shown before confirmation', included: true },
        { text: 'Scheduled recurring delivery', included: true },
        { text: 'Cash or UPI payment per delivery', included: true },
        { text: 'Dedicated account manager', included: false },
        { text: 'Delivery availability depends on your area', included: true },
      ],
      cta: 'Get Office Plan',
      ctaVariant: 'outline',
    },
    {
      id: 'business',
      name: 'Business / Society',
      tagline: 'For bulk supply enquiries and multiple-site needs.',
      badge: 'Enterprise',
      badgeColor: 'green',
      pricePerDelivery: 0,
      unitPrice: null,
      cansPerDelivery: 'Custom volume',
      perCan: 'Request a volume and locality-based quote',
      features: [
        { text: 'Custom volume and delivery schedule', included: true },
        { text: 'Confirm address coverage before contracting', included: true },
        { text: 'Supplier capacity and service area confirmed', included: true },
        { text: 'Written price and service terms before order', included: true },
        { text: 'Ask about business documentation needs', included: true },
        { text: 'No unconfirmed service add-ons', included: true },
        { text: 'Optional related services quoted separately', included: true },
      ],
      cta: 'Get Custom Quote',
      ctaVariant: 'dark',
      highlight: true,
    },
  ];

  const activePlans = tab === 'individual' ? individualPlans : businessPlans;

  const handlePlanCta = (plan: SubPlan) => {
    if (plan.id === 'business') window.open(WHATSAPP, '_blank', 'noopener,noreferrer');
    else if (plan.id === 'pay-per-can') router.push('/book?service=water_can');
    else router.push(`/book?service=water_can&plan=${plan.id}&frequency=${billing}`);
  };

  const prices = (settings.service_base_prices ?? {}) as Record<string, number>;
  const inr = (n: number) => '₹' + Number(n).toLocaleString('en-IN');
  const waText = encodeURIComponent('Hi, I want to order water cans. Please share availability for my address.');

  const spotlight = [
    {
      key: 'plumbing', emoji: '🔧', title: 'Plumber', tag: 'Fix it right',
      lead: 'Leaks, taps, pipes and bathroom or kitchen fittings, handled by a technician you can see before you book.',
      points: ['Leak and pipe repair', 'Tap, mixer and fitting installation', 'Bathroom and kitchen plumbing', 'Scope and final price confirmed before work'],
      book: '/book?service=plumbing', browse: '/technicians?skill=Plumbing',
    },
    {
      key: 'tank_cleaning', emoji: '🪣', title: 'Tank cleaning', tag: 'Cleaner storage',
      lead: 'Keep stored water cleaner with a booked tank cleaning visit for overhead and underground tanks.',
      points: ['Overhead and underground water tanks', 'Price depends on capacity and access', 'Scope agreed before work begins', 'Ask us about repeat cleaning schedules'],
      book: '/book?service=tank_cleaning', browse: '/technicians?skill=Tank%20Cleaning',
    },
  ];

  // Structured data for rich results. Built from the same admin prices shown on screen.
  const jsonLd = useMemo(() => {
    const offer = (name: string, price: number) => ({
      '@type': 'Offer', name, price: String(price), priceCurrency: 'INR', availability: 'https://schema.org/InStock',
      areaServed: city,
    });
    return JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Product',
          name: '20L RO Drinking Water Can',
          description: 'Doorstep delivery of 20 litre Normal and Chilled RO drinking water cans. One-time or recurring weekly or monthly delivery.',
          brand: { '@type': 'Brand', name: 'AuroWater' },
          offers: [offer('Normal RO, 20L can', normalPrice), offer('Chilled RO, 20L can', chilledPrice), offer('Recurring delivery, 20L can', recurringPrice)],
        },
        {
          '@type': 'FAQPage',
          mainEntity: faq.map((f) => ({ '@type': 'Question', name: String(f.q), acceptedAnswer: { '@type': 'Answer', text: String(f.a) } })),
        },
      ],
    }).replace(/</g, '\\u003c');
  }, [city, normalPrice, chilledPrice, recurringPrice, faq]);

  return (
    <div className="pricing-page" ref={rootRef}>
      <PageStyles />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <SpatialScene />

      <main className="layer" id="main-content">
        {/* ── HERO ── */}
        <header className="hero">
          <div aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0.06, backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />
          <div aria-hidden style={{ position: 'absolute', top: -100, right: -80, width: 360, height: 360, borderRadius: '50%', background: '#34D399', opacity: 0.07, pointerEvents: 'none' }} />
          {/* depth orbs sit away from the text column */}
          <span aria-hidden className="h-orb" style={{ width: 120, height: 120, right: '38%', top: '12%', ['--dx' as string]: -30, ['--dy' as string]: 20 }} />
          <span aria-hidden className="h-orb" style={{ width: 70, height: 70, right: '8%', bottom: '14%', ['--dx' as string]: 36, ['--dy' as string]: 22 }} />
          <Image
            src="/illustrations/water-can-delivery.svg"
            alt=""
            aria-hidden="true"
            width={640}
            height={420}
            priority
            sizes="(max-width: 1100px) 0px, 30vw"
            className="pricing-hero-illustration"
          />

          <div className="hero-inner">
            <div className="hero-copy">
              <div className="hero-areas">
                <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: '#34D399', display: 'inline-block', flexShrink: 0, animation: 'pulse 2s infinite' }} />
                <span>Serving {CITIES.join(', ')}</span>
              </div>

              <h1>
                Clear water-can pricing.
                <em>20L cans from ₹{normalPrice}.</em>
              </h1>
              <p className="hero-sub">
                Recurring delivery at <span>₹{recurringPrice} / can</span>
                <small>Final rate shown before booking.</small>
              </p>
              <p className="hero-lead">
                Normal RO ₹{normalPrice} and Chilled RO ₹{chilledPrice} per 20L can, delivery included and no separate water handling fee. Need a water-system repair? Book a plumber from AuroWater too. Review your payable total before confirming.
              </p>
              <div className="hero-actions">
                <button type="button" className="h-btn h-btn-main" onClick={() => router.push('/book?service=water_can&water=normal')}>Order Normal RO</button>
                <button type="button" className="h-btn h-btn-ghost" onClick={() => router.push('/book?service=plumbing')}>Find a Plumber</button>
                <button type="button" className="h-btn h-btn-ghost" onClick={() => router.push('/book?service=tank_cleaning')}>Book Tank Cleaning</button>
              </div>

              <ul className="hero-points">
                {[`₹${recurringPrice}/can on recurring deliveries`, '50+ cans: confirm volume quote before booking', 'Pause future deliveries', 'Cash or UPI per delivery'].map((t) => (
                  <li key={t}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden style={{ flexShrink: 0 }}><path d="M2 6l3 3 5-5" stroke="#34D399" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </header>

        {/* ── 20L CAN PRICE CARD ── */}
        <div className="pc-root">
          <div className="pc-card">
            <div className="pc-accent-bar" />
            <div className="pc-grid">
              <div className="pc-left">
                <div className="pc-icon">
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" fill="#0D9B6C" fillOpacity={0.2} />
                    <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" stroke="#0D9B6C" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2, flexWrap: 'wrap' }}>
                    <span className="pc-label">20L Water Can</span>
                    <span className="pc-badge">Price shown before booking</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, margin: '4px 0 6px', flexWrap: 'wrap' }}>
                    <span className="pc-price-main">₹{normalPrice}</span>
                    <span style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>/ can, one-time</span>
                  </div>
                  <span className="pc-save-pill">Delivery included. No separate water delivery fee.</span>
                </div>
              </div>

              <div className="pc-vdivider" />

              <div className="pc-right">
                <div className="pc-tiers">
                  {(
                    [
                      { label: 'Pay-as-you-go', sublabel: 'No commitment', price: `₹${normalPrice}/can`, bg: '#EEF4FF', tc: '#1E3A8A', lc: '#1D4ED8', sc: '#2D5BC4' },
                      { label: 'Subscription', sublabel: 'Recurring delivery', price: `₹${recurringPrice}/can`, bg: '#E8F7F1', tc: '#065F46', lc: '#047857', sc: '#0B7A55' },
                      { label: `Bulk ${officeQuantity}+`, sublabel: 'Confirm volume quote before booking', price: 'Quote required', bg: '#FFF7E0', tc: '#78350F', lc: '#92400E', sc: '#92400E' },
                    ] as const
                  ).map((t) => (
                    <div key={t.label} className="pc-tier" style={{ background: t.bg }}>
                      <div>
                        <div className="pc-tier-label" style={{ color: t.lc }}>{t.label}</div>
                        <div className="pc-tier-price" style={{ color: t.tc }}>{t.price}</div>
                      </div>
                      <div className="pc-tier-sub" style={{ color: t.sc }}>{t.sublabel}</div>
                    </div>
                  ))}
                </div>

                <div className="pc-cta-row">
                  <button type="button" onClick={() => router.push('/book?service=water_can')} className="pc-cta-btn">
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" fill="rgba(255,255,255,0.35)" />
                      <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
                    </svg>
                    Order a Can Now
                    <span className="pc-cta-arrow" aria-hidden>→</span>
                  </button>
                  <div className="pc-trust">
                    <span>Availability checked for your address</span>
                    <span className="pc-trust-dot" aria-hidden />
                    <span>Clear order total</span>
                    <span className="pc-trust-dot" aria-hidden />
                    <span>Pause future deliveries</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Water product prices */}
        <section aria-labelledby="water-products-title" className="defer" style={{ maxWidth: 1160, margin: '0 auto', padding: '40px 24px 0' }}>
          <div style={{ marginBottom: 20 }}>
            <h2 id="water-products-title" style={H2}>Choose your water</h2>
            <p style={{ margin: '6px 0 0', color: '#475569', fontSize: 14 }}>Straightforward pricing for everyday use or events.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,250px),1fr))', gap: 22 }}>
            <article className="nu nu-hover" style={{ borderRadius: 22, padding: 24 }}>
              <p style={{ margin: 0, color: '#047857', fontSize: 12, fontWeight: 800 }}>Everyday essential</p>
              <h3 style={{ margin: '8px 0 0', color: '#0F172A', fontSize: 20, fontWeight: 900 }}>Normal RO Water</h3>
              <p style={{ margin: '8px 0 0', color: '#047857', fontSize: 30, fontWeight: 900 }}>₹{normalPrice}<span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}> / 20L can</span></p>
              <p style={{ margin: '8px 0 16px', color: '#475569', fontSize: 13, lineHeight: 1.55 }}>For daily home and office drinking-water needs. Delivery included in the displayed water-can price.</p>
              <button type="button" onClick={() => router.push('/book?service=water_can&water=normal')} className="cta" style={{ background: '#047857', color: '#fff' }}>Order Normal RO</button>
            </article>
            <article className="nu nu-hover" style={{ borderRadius: 22, padding: 24 }}>
              <p style={{ margin: 0, color: '#0369A1', fontSize: 12, fontWeight: 800 }}>For events &amp; gatherings</p>
              <h3 style={{ margin: '8px 0 0', color: '#0F172A', fontSize: 20, fontWeight: 900 }}>Chilled RO Water</h3>
              <p style={{ margin: '8px 0 0', color: '#0369A1', fontSize: 30, fontWeight: 900 }}>₹{chilledPrice}<span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}> / 20L can</span></p>
              <p style={{ margin: '8px 0 16px', color: '#475569', fontSize: 13, lineHeight: 1.55 }}>Chilled and delivered for weddings, parties, functions and office gatherings.</p>
              <button type="button" onClick={() => router.push('/book?service=water_can&water=chilled')} className="cta" style={{ background: '#0369A1', color: '#fff' }}>Order Chilled Water</button>
            </article>
          </div>
        </section>

        {/* Monthly cost estimator */}
        <section aria-labelledby="calc-title" className="defer" style={{ maxWidth: 1160, margin: '0 auto', padding: '56px 24px 0' }}>
          <WaterCalculator normalPrice={normalPrice} chilledPrice={chilledPrice} recurringPrice={recurringPrice} onOrder={(w) => router.push(`/book?service=water_can&water=${w}`)} />
        </section>

        {/* ── MAIN CONTENT ── */}
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '56px 24px 40px' }}>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <h2 style={{ ...H2, fontSize: 'clamp(1.5rem,3.5vw,2.2rem)', letterSpacing: '-0.8px' }}>Choose your plan</h2>
              <p style={{ margin: '6px 0 0', fontSize: 14, color: '#475569' }}>Transparent per-delivery pricing. Pause or cancel future deliveries.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
              <div className="nu-in" role="group" aria-label="Customer type" style={{ display: 'flex', borderRadius: 14, padding: 5, gap: 4 }}>
                {(['individual', 'business'] as PricingTab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={tab === t}
                    onClick={() => setTab(t)}
                    className={tab === t ? 'nu-sm' : ''}
                    style={{ padding: '9px 18px', minHeight: 40, borderRadius: 10, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', background: tab === t ? '#E3EDF6' : 'transparent', color: tab === t ? '#0F172A' : '#475569', transition: 'color .2s' }}
                  >
                    {t === 'individual' ? '👤 Individual' : '🏢 Business'}
                  </button>
                ))}
              </div>

              <div className="billing-toggle nu-in" role="group" aria-label="Delivery frequency" style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 999, padding: '5px 8px' }}>
                <button type="button" aria-pressed={billing === 'weekly'} onClick={() => setBilling('weekly')} className={billing === 'weekly' ? 'nu-sm' : ''} style={{ padding: '6px 14px', minHeight: 36, borderRadius: 999, fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', background: billing === 'weekly' ? '#E3EDF6' : 'transparent', color: billing === 'weekly' ? '#0F172A' : '#475569' }}>Weekly</button>
                <button type="button" aria-pressed={billing === 'monthly'} onClick={() => setBilling('monthly')} className={billing === 'monthly' ? 'nu-sm' : ''} style={{ padding: '6px 14px', minHeight: 36, borderRadius: 999, fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', background: billing === 'monthly' ? '#E3EDF6' : 'transparent', color: billing === 'monthly' ? '#0F172A' : '#475569' }}>Monthly</button>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: 24 }}>
            {activePlans.map((plan) => (
              <div key={plan.id} className="plan-card">
                <SubCard plan={plan} frequency={billing} onCta={() => handlePlanCta(plan)} />
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <button
              type="button"
              aria-expanded={showCompare}
              onClick={() => setShowCompare((v) => !v)}
              className="nu-sm nu-press"
              style={{ border: 'none', borderRadius: 14, padding: '11px 24px', minHeight: 46, fontSize: 13, fontWeight: 700, color: '#334155', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}
            >
              {showCompare ? 'Hide comparison' : 'Compare all plans'}
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden style={{ transform: showCompare ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M2.5 4.5L6.5 8.5L10.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>

          {showCompare && (
            <div style={{ marginTop: 24, animation: 'fadeUp 0.3s ease both' }}>
              <CompareTable settings={settings} officeQuantity={officeQuantity} normalPrice={normalPrice} />
            </div>
          )}

          <div className="nu defer" style={{ marginTop: 64, borderRadius: 24, padding: 28 }}>
            <h2 style={{ ...H2, color: '#064E3B' }}>A simpler way to manage water delivery</h2>
            <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.7, color: '#475569', maxWidth: 760 }}>Choose one-time delivery when you need it, or schedule recurring deliveries for convenience. There is no automatic debit. The price shown for each delivery is reviewed before you confirm, and you can pause or cancel future schedules.</p>
          </div>

          {/* Plumber & tank cleaning spotlight */}
          <section aria-labelledby="spot-h" className="defer" style={{ marginTop: 64 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#047857' }}>Beyond water cans</p>
            <h2 id="spot-h" style={{ ...H2, marginTop: 6 }}>Plumber and tank cleaning, booked the same way</h2>
            <p style={{ margin: '8px 0 24px', fontSize: 14, color: '#475569', maxWidth: 640, lineHeight: 1.65 }}>Use one account for water cans and for the people who keep your water system working. See the starting estimate, check availability for your address, and confirm the scope before work begins.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 24 }}>
              {spotlight.map((s) => (
                <article key={s.key} className="nu nu-hover" style={{ borderRadius: 24, padding: 26, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span aria-hidden className="nu-in" style={{ width: 56, height: 56, borderRadius: 18, display: 'grid', placeItems: 'center', fontSize: 28 }}>{s.emoji}</span>
                    <Pill color="green">{s.tag}</Pill>
                  </div>
                  <h3 style={{ margin: '16px 0 0', fontSize: 22, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.4px' }}>{s.title}</h3>
                  <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.65, color: '#475569' }}>{s.lead}</p>
                  <p style={{ margin: '14px 0 0', fontSize: 13, color: '#475569' }}>
                    <span style={{ fontSize: 26, fontWeight: 900, color: '#047857', letterSpacing: '-0.5px' }}>{inr(prices[s.key] ?? 0)}</span> starting estimate
                  </p>
                  <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
                    {s.points.map((p) => (
                      <li key={p} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13, color: '#334155', fontWeight: 500, lineHeight: 1.4 }}><IconCheck />{p}</li>
                    ))}
                  </ul>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 22 }}>
                    <Link href={s.book} className="cta cta-primary" style={{ flex: '1 1 150px', width: 'auto' }}>Book {s.title.toLowerCase()}</Link>
                    <Link href={s.browse} className="cta cta-outline" style={{ flex: '1 1 150px', width: 'auto' }}>See technicians</Link>
                  </div>
                </article>
              ))}
            </div>

            <ol style={{ listStyle: 'none', margin: '28px 0 0', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: 16 }}>
              {[
                ['Choose your service', 'Pick plumbing, tank cleaning, RO, borewell, motor or tanker.'],
                ['Check price and area', 'See the starting estimate and whether we cover your address.'],
                ['Confirm and track', 'Confirm the scope, then follow your booking from your account.'],
              ].map(([t, d], i) => (
                <li key={t} className="nu-sm" style={{ borderRadius: 18, padding: 18, display: 'flex', gap: 14 }}>
                  <span className="nu-in" style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', fontWeight: 900, color: '#047857', flexShrink: 0 }}>{i + 1}</span>
                  <span><strong style={{ display: 'block', color: '#0F172A', fontSize: 14 }}>{t}</strong><span style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5 }}>{d}</span></span>
                </li>
              ))}
            </ol>
          </section>

          {/* Other home services pricing */}
          <section aria-labelledby="svc-h" className="defer" style={{ marginTop: 64 }}>
            <h2 id="svc-h" style={{ ...H2, margin: '0 0 6px' }}>Water &amp; home services</h2>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: '#475569' }}>Starting estimates come from our current prices. Confirm scope, availability and the final price before booking.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,240px),1fr))', gap: 20 }}>
              {SERVICE_CARDS.map((s) => (
                <Link key={s.key} href={`/services/${s.key}`} aria-label={`View details for ${s.name}`} className="nu nu-hover" style={{ borderRadius: 20, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10, textDecoration: 'none' }}>
                  <span aria-hidden style={{ fontSize: 28 }}>{s.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{s.note}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: '#047857', letterSpacing: '-0.5px' }}>{inr(prices[s.key] ?? 0)}</span>
                    <span style={{ fontSize: 12, color: '#64748B' }}>starting estimate</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* AMC */}
          <div className="defer" style={{ marginTop: 56 }}>
            <div style={{ borderRadius: 24, background: 'linear-gradient(135deg,#0C4A6E,#0369A1 55%,#0284C7)', padding: 'clamp(28px,5vw,40px) clamp(20px,4vw,36px)', position: 'relative', overflow: 'hidden', boxShadow: '0 20px 50px rgba(3,105,161,.25)' }}>
              <div aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize: '24px 24px', pointerEvents: 'none' }} />
              <div aria-hidden style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: '#38BDF8', opacity: 0.1, pointerEvents: 'none' }} />
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                  <Pill color="blue">Maintenance &amp; repeat service</Pill>
                  <h2 style={{ margin: '12px 0 6px', fontSize: 'clamp(1.3rem,3.5vw,1.8rem)', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>Need help maintaining your water system?</h2>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 1.6, maxWidth: 440 }}>
                    Ask for a tailored maintenance quote based on your purifier, equipment and service needs. We will confirm the included work and price before you commit.
                  </p>
                  <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14, padding: 0, listStyle: 'none' }}>
                    {['Scope agreed before work', 'Parts quoted separately where needed', 'Availability checked by area', 'Written quote before commitment'].map((t) => (
                      <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.09)', borderRadius: 999, padding: '5px 12px', border: '1px solid rgba(255,255,255,0.12)' }}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button type="button" onClick={() => router.push('/contact')} style={{ background: '#fff', color: '#0C4A6E', fontWeight: 800, fontSize: 14, padding: '14px 28px', minHeight: 48, borderRadius: 14, border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Request a Quote
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden><path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="#0C4A6E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>
            </div>
          </div>

          {/* Trust strip */}
          <section aria-labelledby="trust-h" className="defer" style={{ marginTop: 56 }}>
            <h2 id="trust-h" style={{ ...H2, margin: '0 0 20px' }}>Built to be trusted</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))', gap: 18 }}>
              {[
                { icon: '🔒', title: 'No hidden charges', sub: 'Full breakdown shown at checkout.' },
                { icon: '↩️', title: 'Manage future deliveries', sub: 'Pause or cancel future deliveries where supported.' },
                { icon: '📋', title: 'Tax documents', sub: 'Ask support to confirm the documentation available for your order.' },
                { icon: '💬', title: 'WhatsApp support', sub: 'Contact support for order and service questions.' },
                { icon: '💳', title: 'No automatic debit', sub: 'You pay by cash or UPI for each delivery.' },
                { icon: '📍', title: 'Address checked first', sub: 'Availability is confirmed from your delivery address.' },
              ].map((t) => (
                <div key={t.title} className="nu-sm" style={{ borderRadius: 18, padding: '18px 20px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span aria-hidden className="nu-in" style={{ width: 40, height: 40, borderRadius: 13, display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0 }}>{t.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{t.title}</div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 2, lineHeight: 1.45 }}>{t.sub}</div>
                  </div>
                </div>
              ))}
            </div>
            <ul aria-label="Service areas" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '22px 0 0', padding: 0, listStyle: 'none', alignItems: 'center' }}>
              <li style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>We serve:</li>
              {CITIES.map((c) => (
                <li key={c} className="nu-sm" style={{ borderRadius: 999, padding: '7px 16px', fontSize: 13, fontWeight: 700, color: '#065F46' }}>{c}</li>
              ))}
            </ul>
          </section>

          {/* FAQ */}
          <section aria-labelledby="faq-h" className="defer" style={{ marginTop: 64 }}>
            <div style={{ maxWidth: 700 }}>
              <h2 id="faq-h" style={{ ...H2, margin: '0 0 6px' }}>Frequently asked questions</h2>
              <p style={{ margin: '0 0 24px', fontSize: 14, color: '#475569' }}>Everything you need to know about pricing and delivery.</p>
              <FaqAccordion faq={faq} />
            </div>
          </section>

          {/* Bottom CTA */}
          <div style={{ marginTop: 64, borderRadius: 24, background: 'linear-gradient(135deg,#022C22,#065F46 60%,#0D9B6C)', padding: 'clamp(32px,6vw,48px) clamp(20px,5vw,40px)', position: 'relative', overflow: 'hidden', textAlign: 'center', boxShadow: '0 24px 60px rgba(6,95,70,.28)' }}>
            <div aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize: '24px 24px', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 'clamp(1.5rem,4vw,2.5rem)', fontWeight: 900, color: '#fff', letterSpacing: '-0.8px' }}>Still deciding?</h2>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15, maxWidth: 420, margin: '10px auto 28px', lineHeight: 1.6 }}>
                Order a single 20L can at the current one-time rate. Confirm address availability and the final amount before placing your order.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
                <button type="button" onClick={() => router.push('/book?service=water_can')} style={{ background: '#fff', color: '#065F46', fontWeight: 800, fontSize: 15, padding: '14px 28px', minHeight: 48, borderRadius: 14, border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                  Order a Can, ₹{normalPrice}
                </button>
                <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', fontWeight: 700, fontSize: 15, padding: '14px 28px', minHeight: 48, borderRadius: 14, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <IconWA /> Chat with us
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="m-spacer" />
      </main>

      {/* Mobile quick-order bar */}
      <div className="m-bar">
        <button type="button" onClick={() => router.push('/book?service=water_can')} className="cta cta-primary" style={{ flex: 1 }}>Order a Can, ₹{normalPrice}</button>
        <a href={`${WHATSAPP}?text=${waText}`} target="_blank" rel="noopener noreferrer" aria-label="Order on WhatsApp" className="cta cta-outline" style={{ width: 52, flexShrink: 0 }}><IconWA /></a>
      </div>
    </div>
  );
}








// 'use client';

// import React, { memo, useEffect, useRef, useState } from 'react';
// import Image from 'next/image';
// import Link from 'next/link';
// import { useRouter } from 'next/navigation';
// import { useSettings, type PlatformSettings } from '@/hooks/useSettings';
// import {
//   CITIES, FAQS, SERVICE_CARDS, WHATSAPP, type FaqItem,
// } from './pricing-shared';

// type PricingTab = 'individual' | 'business';
// type BillingCycle = 'weekly' | 'monthly';

// // ─── Icons ────────────────────────────────────────────────────────────────────
// function IconCheck() {
//   return (
//     <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }} aria-hidden>
//       <circle cx="7.5" cy="7.5" r="7" fill="#DCFCE7" />
//       <path d="M4.5 7.5L6.5 9.5L10.5 5.5" stroke="#16A34A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
//     </svg>
//   );
// }
// function IconX() {
//   return (
//     <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }} aria-hidden>
//       <circle cx="7.5" cy="7.5" r="7" fill="#F3F4F6" />
//       <path d="M5.5 9.5L9.5 5.5M9.5 9.5L5.5 5.5" stroke="#9CA3AF" strokeWidth="1.6" strokeLinecap="round" />
//     </svg>
//   );
// }
// function IconWA() {
//   return (
//     <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
//       <path d="M20 11.5C20 15.64 16.42 19 12.2 19C10.7 19 9.3 18.61 8.1 17.9L4 19L5.1 15.2C4.45 14 4.1 12.7 4.1 11.5C4.1 7.36 7.68 4 11.9 4C16.12 4 20 7.36 20 11.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
//       <path d="M9.2 9.4C9.4 9.1 9.7 9 10 9C10.3 9 10.6 9.1 10.7 9.4L11.3 10.7C11.4 10.9 11.4 11.1 11.3 11.3L11 11.7C10.9 11.8 10.9 12 11 12.2C11.3 12.8 11.8 13.4 12.4 13.7C12.6 13.8 12.8 13.8 12.9 13.7L13.3 13.4C13.5 13.3 13.7 13.3 13.9 13.4L15.2 14C15.5 14.1 15.6 14.4 15.6 14.7C15.6 15 15.5 15.3 15.3 15.5C15 15.7 14.7 15.9 14.4 16C14 16.1 13.6 16.1 13.2 16C10.8 15.2 9 13.4 8.2 11C8.1 10.6 8.1 10.2 8.2 9.8C8.3 9.5 8.5 9.2 9.2 9.4Z" fill="currentColor" opacity="0.95" />
//     </svg>
//   );
// }
// function IconDroplet() {
//   return (
//     <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
//       <path d="M11 3C11 3 5 9.5 5 13.5C5 16.538 7.686 19 11 19C14.314 19 17 16.538 17 13.5C17 9.5 11 3 11 3Z" fill="url(#drop)" stroke="#0369A1" strokeWidth="1.2" />
//       <path d="M8.5 14.5C8.5 16 9.5 17 11 17" stroke="#BAE6FD" strokeWidth="1.3" strokeLinecap="round" />
//       <defs>
//         <linearGradient id="drop" x1="11" y1="3" x2="11" y2="19" gradientUnits="userSpaceOnUse">
//           <stop stopColor="#38BDF8" />
//           <stop offset="1" stopColor="#0369A1" />
//         </linearGradient>
//       </defs>
//     </svg>
//   );
// }

// // ─── Pill tag ─────────────────────────────────────────────────────────────────
// function Pill({ children, color = 'green' }: { children: React.ReactNode; color?: 'green' | 'blue' | 'amber' | 'slate' }) {
//   const map = {
//     green: { bg: '#ECFDF5', color: '#065F46', border: '#6EE7B7' },
//     blue: { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
//     amber: { bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' },
//     slate: { bg: '#F8FAFC', color: '#475569', border: '#CBD5E1' },
//   };
//   const s = map[color];
//   return (
//     <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '3px 10px', letterSpacing: '0.04em', display: 'inline-block' }}>
//       {children}
//     </span>
//   );
// }

// // ─── Spatial water scene (fixed, GPU-only transforms, pointer + scroll parallax via CSS variables) ───
// const BUBBLES = [
//   { l: 6, s: 14, d: 19, t: 0 }, { l: 14, s: 8, d: 24, t: 6 }, { l: 23, s: 20, d: 28, t: 2 }, { l: 31, s: 10, d: 21, t: 11 },
//   { l: 42, s: 16, d: 26, t: 4 }, { l: 51, s: 9, d: 20, t: 9 }, { l: 60, s: 22, d: 30, t: 1 }, { l: 68, s: 11, d: 23, t: 13 },
//   { l: 76, s: 15, d: 27, t: 5 }, { l: 84, s: 8, d: 22, t: 8 }, { l: 91, s: 18, d: 29, t: 3 }, { l: 97, s: 12, d: 25, t: 10 },
// ];

// const SpatialScene = memo(function SpatialScene() {
//   return (
//     <div className="scene" aria-hidden>
//       <span className="orb" style={{ width: 420, height: 420, left: '-8%', top: '8%', ['--dx' as string]: -26, ['--dy' as string]: -18, ['--sp' as string]: 0.06 }} />
//       <span className="orb" style={{ width: 320, height: 320, right: '-6%', top: '34%', ['--dx' as string]: 34, ['--dy' as string]: 22, ['--sp' as string]: 0.1 }} />
//       <span className="orb" style={{ width: 240, height: 240, left: '38%', top: '62%', ['--dx' as string]: -14, ['--dy' as string]: 30, ['--sp' as string]: 0.14 }} />
//       {BUBBLES.map((b, i) => (
//         <span key={i} className="bubble" style={{ left: `${b.l}%`, width: b.s, height: b.s, animationDuration: `${b.d}s`, animationDelay: `-${b.t}s` }} />
//       ))}
//       <svg className="wave w1" viewBox="0 0 2880 160" preserveAspectRatio="none"><path d="M0 80 C 240 20 480 140 720 80 S 1200 20 1440 80 S 1920 140 2160 80 S 2640 20 2880 80 V160 H0 Z" fill="rgba(125,200,240,.22)" /></svg>
//       <svg className="wave w2" viewBox="0 0 2880 160" preserveAspectRatio="none"><path d="M0 90 C 300 150 600 30 900 90 S 1500 150 1800 90 S 2400 30 2880 90 V160 H0 Z" fill="rgba(56,189,248,.16)" /></svg>
//     </div>
//   );
// });

// // ─── Subscription card ────────────────────────────────────────────────────────
// type SubPlan = {
//   id: string;
//   name: string;
//   tagline: string;
//   badge?: string;
//   badgeColor?: 'green' | 'blue' | 'amber';
//   pricePerDelivery: number;
//   unitPrice: number | null;
//   cansPerDelivery: number | string;
//   perCan: string;
//   features: { text: string; included: boolean }[];
//   cta: string;
//   ctaVariant: 'primary' | 'outline' | 'dark';
//   highlight?: boolean;
// };

// const SubCard = memo(function SubCard({ plan, frequency, onCta }: { plan: SubPlan; frequency: BillingCycle; onCta: () => void }) {
//   const price = plan.pricePerDelivery;
//   return (
//     <article
//       className={plan.highlight ? 'plan-hl' : 'nu nu-hover'}
//       style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', background: plan.highlight ? 'linear-gradient(160deg,#022C22,#065F46)' : undefined }}
//     >
//       {/* top bar */}
//       <div style={{
//         height: 5,
//         background: plan.highlight
//           ? 'linear-gradient(90deg,#34D399,#0D9B6C)'
//           : plan.id === 'pay-per-can' ? 'linear-gradient(90deg,#38BDF8,#0369A1)'
//           : plan.id === 'business' ? 'linear-gradient(90deg,#F59E0B,#D97706)'
//           : 'linear-gradient(90deg,#CBD5E1,#94A3B8)',
//       }} />

//       {plan.badge && (
//         <div style={{ position: 'absolute', top: 18, right: 18 }}>
//           <Pill color={plan.badgeColor ?? 'green'}>{plan.badge}</Pill>
//         </div>
//       )}

//       <div style={{ padding: '24px 26px', flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
//         {/* header */}
//         <div style={{ marginBottom: 18 }}>
//           <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: plan.highlight ? '#fff' : '#0F172A', letterSpacing: '-0.3px' }}>{plan.name}</h3>
//           <div style={{ fontSize: 12, color: plan.highlight ? 'rgba(255,255,255,0.7)' : '#475569', marginTop: 3, fontWeight: 500 }}>{plan.tagline}</div>
//         </div>

//         {/* price */}
//         <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${plan.highlight ? 'rgba(255,255,255,0.12)' : 'rgba(148,163,184,.35)'}` }}>
//           {plan.pricePerDelivery > 0 ? (
//             <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
//               <span style={{ fontSize: 38, fontWeight: 900, letterSpacing: '-1.5px', color: plan.highlight ? '#34D399' : '#0F172A', lineHeight: 1 }}>₹{price}</span>
//               <span style={{ fontSize: 13, color: plan.highlight ? 'rgba(255,255,255,0.6)' : '#64748B', marginBottom: 4, fontWeight: 500 }}>/delivery</span>
//             </div>
//           ) : (
//             <div style={{ fontSize: 32, fontWeight: 900, color: plan.highlight ? '#34D399' : '#0F172A', letterSpacing: '-1px' }}>Custom</div>
//           )}
//           <div style={{ marginTop: 6, fontSize: 13, color: plan.highlight ? '#6EE7B7' : '#047857', fontWeight: 700 }}>{plan.perCan}</div>
//           <div style={{ marginTop: 7, fontSize: 11, fontWeight: 700, color: plan.highlight ? '#A7F3D0' : '#475569' }}>Delivery included · No separate water handling fee</div>
//           {typeof plan.cansPerDelivery === 'number' && (
//             <div style={{ marginTop: 3, fontSize: 12, color: plan.highlight ? 'rgba(255,255,255,0.55)' : '#64748B' }}>
//               {plan.id === 'pay-per-can' ? 'Example total for 1 can' : `Up to ${plan.cansPerDelivery} cans per delivery`}
//             </div>
//           )}
//           {plan.id !== 'pay-per-can' && plan.id !== 'business' ? (
//             <div style={{ marginTop: 4, fontSize: 12, color: plan.highlight ? '#A7F3D0' : '#475569' }}>
//               Schedule: {frequency === 'weekly' ? 'weekly' : 'monthly'} · pay per delivery
//             </div>
//           ) : null}
//         </div>

//         {/* features */}
//         <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
//           {plan.features.map((f) => (
//             <li key={f.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
//               {f.included ? <IconCheck /> : <IconX />}
//               <span style={{ fontSize: 13, fontWeight: 500, color: plan.highlight ? (f.included ? '#D1FAE5' : 'rgba(255,255,255,0.45)') : (f.included ? '#334155' : '#94A3B8'), lineHeight: 1.4 }}>
//                 {f.included ? '' : <span className="sr-only">Not included: </span>}{f.text}
//               </span>
//             </li>
//           ))}
//         </ul>

//         {/* CTA */}
//         <button type="button" onClick={onCta} className={`cta cta-${plan.ctaVariant}`} style={{ marginTop: 24 }}>
//           {plan.cta}
//           <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
//             <path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
//           </svg>
//         </button>
//       </div>
//     </article>
//   );
// });

// // ─── FAQ accordion (answers stay in the DOM, so they are crawlable and animate smoothly) ───
// function FaqAccordion({ faq }: { faq: FaqItem[] }) {
//   const [open, setOpen] = useState<number | null>(0);
//   return (
//     <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
//       {faq.map((item, idx) => {
//         const isOpen = open === idx;
//         return (
//           <div key={item.q} className={isOpen ? 'nu-in' : 'nu-sm'} style={{ borderRadius: 16, overflow: 'hidden', transition: 'box-shadow .25s' }}>
//             <h3 style={{ margin: 0 }}>
//               <button
//                 type="button"
//                 aria-expanded={isOpen}
//                 aria-controls={`faq-a-${idx}`}
//                 id={`faq-q-${idx}`}
//                 onClick={() => setOpen((cur) => (cur === idx ? null : idx))}
//                 style={{ width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', minHeight: 52 }}
//               >
//                 <span style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{item.q}</span>
//                 <span aria-hidden style={{ fontSize: 20, color: '#047857', fontWeight: 700, flexShrink: 0, transform: isOpen ? 'rotate(45deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>+</span>
//               </button>
//             </h3>
//             <div id={`faq-a-${idx}`} role="region" aria-labelledby={`faq-q-${idx}`} className="faq-a" data-open={isOpen}>
//               <div><p style={{ margin: 0, padding: '0 20px 16px', fontSize: 13, color: '#475569', lineHeight: 1.65 }}>{item.a}</p></div>
//             </div>
//           </div>
//         );
//       })}
//     </div>
//   );
// }

// // ─── Compare table ────────────────────────────────────────────────────────────
// function CompareTable({ settings }: { settings: PlatformSettings }) {
//   const rows = [
//     { feature: 'Per-can rate', payg: `₹${settings.default_can_price}`, starter: `₹${settings.subscription_can_price}`, pro: `₹${settings.subscription_can_price}`, office: `₹${settings.default_can_price}`, business: 'Quote' },
//     { feature: 'Separate water handling fee', payg: 'None for water cans', starter: 'None for water cans', pro: 'None for water cans', office: 'None for water cans', business: 'Confirmed in quote' },
//     { feature: 'Cans per delivery', payg: 'As needed', starter: 'Up to 10', pro: 'Up to 20', office: `${Math.max(50, settings.bulk_threshold)}+`, business: 'Custom' },
//     { feature: 'Recurring schedule', payg: 'Not required', starter: 'Weekly / monthly', pro: 'Weekly / monthly', office: 'Weekly / monthly', business: 'By agreement' },
//     { feature: 'Payment', payg: 'Cash / UPI', starter: 'Cash / UPI per delivery', pro: 'Cash / UPI per delivery', office: 'Cash / UPI per delivery', business: 'Confirmed before order' },
//     { feature: 'Automatic debit', payg: 'No', starter: 'No', pro: 'No', office: 'No', business: 'Only if separately agreed' },
//     { feature: 'Service availability', payg: 'Address checked', starter: 'Address checked', pro: 'Address checked', office: 'Capacity checked', business: 'Confirmed in quote' },
//   ];
//   const cols = ['Feature', 'Pay as you go', 'Home Starter', 'Family', 'Bulk Delivery', 'Business / Society'];

//   return (
//     <div className="nu" style={{ overflowX: 'auto', borderRadius: 20 }}>
//       <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 760 }}>
//         <caption className="sr-only">Comparison of all water delivery plans</caption>
//         <thead>
//           <tr style={{ background: 'rgba(255,255,255,.45)' }}>
//             {cols.map((c, i) => (
//               <th key={c} scope="col" style={{ padding: '14px 18px', textAlign: i === 0 ? 'left' : 'center', fontWeight: 700, color: i === 2 ? '#065F46' : '#334155', fontSize: 12, letterSpacing: '0.04em', borderBottom: '1.5px solid rgba(148,163,184,.4)', background: i === 2 ? '#D1FAE5' : undefined }}>
//                 {c}{i === 2 ? ' ⭐' : ''}
//               </th>
//             ))}
//           </tr>
//         </thead>
//         <tbody>
//           {rows.map((row, ri) => (
//             <tr key={row.feature} style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.35)' }}>
//               <th scope="row" style={{ padding: '13px 18px', textAlign: 'left', fontWeight: 600, color: '#334155', borderBottom: '1px solid rgba(148,163,184,.25)' }}>{row.feature}</th>
//               {[row.payg, row.starter, row.pro, row.office, row.business].map((val, ci) => (
//                 <td key={ci} style={{ padding: '13px 18px', textAlign: 'center', color: ci === 1 ? '#065F46' : val === '—' ? '#CBD5E1' : '#334155', fontWeight: ci === 1 ? 700 : 500, borderBottom: '1px solid rgba(148,163,184,.25)', background: ci === 1 ? 'rgba(209,250,229,.45)' : undefined }}>
//                   {val}
//                 </td>
//               ))}
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>
//   );
// }

// // ─── Monthly water cost estimator (new) ───────────────────────────────────────
// function WaterCalculator({ onOrder, normalPrice, chilledPrice }: { onOrder: (water: 'normal' | 'chilled') => void; normalPrice: number; chilledPrice: number }) {
//   const [cans, setCans] = useState(10);
//   const [water, setWater] = useState<'normal' | 'chilled'>('normal');
//   const [cycle, setCycle] = useState<BillingCycle>('weekly');
//   const rate = water === 'normal' ? normalPrice : chilledPrice;
//   const perDelivery = cans * rate;
//   const monthly = Math.round(perDelivery * (cycle === 'weekly' ? 52 / 12 : 1));
//   const pct = ((cans - 1) / 99) * 100;
//   const seg = (on: boolean): React.CSSProperties => ({ flex: 1, minHeight: 44, padding: '0 14px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: on ? '#047857' : '#475569', background: '#E3EDF6', boxShadow: on ? 'inset 4px 4px 8px #b7c8d9, inset -4px -4px 8px #fff' : '5px 5px 10px #b7c8d9, -5px -5px 10px #fff', transition: 'all .2s' });

//   return (
//     <div className="nu" style={{ borderRadius: 24, padding: 'clamp(20px,4vw,32px)', display: 'grid', gap: 28, gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
//       <div>
//         <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#047857' }}>Cost estimator</p>
//         <h2 id="calc-title" style={{ margin: '6px 0 0', fontSize: 'clamp(1.35rem,3vw,1.8rem)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.5px' }}>Plan your monthly water spend</h2>
//         <p style={{ margin: '8px 0 0', fontSize: 13, color: '#475569', lineHeight: 1.6 }}>Pick the water, the cans per delivery and how often you want it. This is an estimate; the final payable total is shown before you confirm.</p>

//         <div role="group" aria-label="Water type" style={{ display: 'flex', gap: 10, marginTop: 18 }}>
//           <button type="button" aria-pressed={water === 'normal'} onClick={() => setWater('normal')} style={seg(water === 'normal')}>Normal RO · ₹{normalPrice}</button>
//           <button type="button" aria-pressed={water === 'chilled'} onClick={() => setWater('chilled')} style={seg(water === 'chilled')}>Chilled RO · ₹{chilledPrice}</button>
//         </div>
//         <div role="group" aria-label="Delivery frequency" style={{ display: 'flex', gap: 10, marginTop: 12 }}>
//           <button type="button" aria-pressed={cycle === 'weekly'} onClick={() => setCycle('weekly')} style={seg(cycle === 'weekly')}>Weekly</button>
//           <button type="button" aria-pressed={cycle === 'monthly'} onClick={() => setCycle('monthly')} style={seg(cycle === 'monthly')}>Monthly</button>
//         </div>

//         <label htmlFor="calc-cans" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
//           Cans per delivery <span style={{ color: '#047857' }}>{cans}</span>
//         </label>
//         <input id="calc-cans" className="range" type="range" min={1} max={100} value={cans} onChange={(e) => setCans(Number(e.target.value))} style={{ width: '100%', marginTop: 10, background: `linear-gradient(90deg,#0EA5E9 ${pct}%,#cfdeeb ${pct}%)` }} />
//         {cans >= 50 && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#92400E', fontWeight: 600 }}>50+ cans: confirm a volume quote before booking.</p>}
//       </div>

//       <div className="nu-in" style={{ borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }} aria-live="polite">
//         <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#64748B' }}>Each delivery</p>
//         <p style={{ margin: '2px 0 0', fontSize: 30, fontWeight: 900, color: '#0F172A', letterSpacing: '-1px' }}>₹{perDelivery.toLocaleString('en-IN')}</p>
//         <p style={{ margin: '16px 0 0', fontSize: 12, fontWeight: 700, color: '#64748B' }}>About per month</p>
//         <p style={{ margin: '2px 0 0', fontSize: 38, fontWeight: 900, color: '#047857', letterSpacing: '-1.5px' }}>₹{monthly.toLocaleString('en-IN')}</p>
//         <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748B' }}>{cans} × ₹{rate} · delivery included · no separate water handling fee</p>
//         <button type="button" onClick={() => onOrder(water)} className="cta cta-primary" style={{ marginTop: 20 }}>
//           Order {water === 'normal' ? 'Normal' : 'Chilled'} RO
//           <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden><path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
//         </button>
//       </div>
//     </div>
//   );
// }

// // ─── Styles (original rules kept; neumorphic + spatial layers added) ──────────
// const CSS = `
//   .pricing-page * { box-sizing: border-box; font-family: var(--font-dm), 'DM Sans', system-ui, sans-serif; }
//   .pricing-page h1, .pricing-page h2, .pricing-page .display { font-family: var(--font-syne), 'Syne', system-ui, sans-serif; }
//   .pricing-page .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; }
//   .pricing-page { position: relative; min-height: 100vh; background: #E3EDF6; overflow-x: clip; scroll-behavior: smooth; }
//   .pricing-page > .layer { position: relative; z-index: 1; }

//   @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
//   @keyframes pulse { 0%,100%{box-shadow:0 0 0 3px rgba(16,185,129,0.2);} 50%{box-shadow:0 0 0 7px rgba(16,185,129,0.06);} }
//   @keyframes rise { from { transform: translate3d(0,105vh,0); } to { transform: translate3d(0,-15vh,0); } }
//   @keyframes drift { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50%,0,0); } }

//   /* ── Neumorphism (pale water surface, light from top-left) ── */
//   .pricing-page .nu { background:#E3EDF6; box-shadow: 9px 9px 18px #b7c8d9, -9px -9px 18px #ffffff; }
//   .pricing-page .nu-sm { background:#E3EDF6; box-shadow: 5px 5px 10px #b7c8d9, -5px -5px 10px #ffffff; }
//   .pricing-page .nu-in { background:#E3EDF6; box-shadow: inset 5px 5px 10px #b7c8d9, inset -5px -5px 10px #ffffff; }
//   .pricing-page .nu-hover { transition: transform .3s cubic-bezier(.22,1,.36,1); }
//   .pricing-page .nu-hover:hover { transform: translateY(-5px); }
//   .pricing-page .nu-press:active { box-shadow: inset 4px 4px 8px #b7c8d9, inset -4px -4px 8px #ffffff; }
//   .pricing-page .plan-hl { border: 2px solid #0D9B6C; box-shadow: 0 20px 60px rgba(13,155,108,0.28); }
//   .pricing-page :is(a,button):focus-visible { outline: 3px solid rgba(2,132,199,.55); outline-offset: 3px; }

//   /* ── Buttons ── */
//   .pricing-page .cta { width:100%; padding:13px 0; min-height:48px; border-radius:14px; font-weight:800; font-size:14px; cursor:pointer; letter-spacing:-0.2px; transition: transform .2s, box-shadow .2s, background .2s; display:flex; align-items:center; justify-content:center; gap:7px; border:none; text-decoration:none; }
//   .pricing-page .cta:active { transform: scale(.98); }
//   .pricing-page .cta-primary { background: linear-gradient(135deg,#0D9B6C,#059652); color:#fff; box-shadow: 0 4px 14px rgba(13,155,108,0.3); }
//   .pricing-page .cta-primary:hover { box-shadow: 0 8px 24px rgba(13,155,108,0.45); transform: translateY(-1px); }
//   .pricing-page .cta-outline { background:#E3EDF6; color:#047857; box-shadow: 5px 5px 10px #b7c8d9, -5px -5px 10px #fff; }
//   .pricing-page .cta-outline:hover { color:#065F46; }
//   .pricing-page .cta-outline:active { box-shadow: inset 4px 4px 8px #b7c8d9, inset -4px -4px 8px #fff; }
//   .pricing-page .cta-dark { background:#0F172A; color:#fff; border:1px solid rgba(255,255,255,0.12); }
//   .pricing-page .cta-dark:hover { background:#1E293B; }

//   /* ── FAQ smooth open ── */
//   .pricing-page .faq-a { display:grid; grid-template-rows: 0fr; transition: grid-template-rows .3s ease; }
//   .pricing-page .faq-a[data-open="true"] { grid-template-rows: 1fr; }
//   .pricing-page .faq-a > div { overflow:hidden; }

//   /* ── Spatial scene: fixed layers, transform-only animation ── */
//   .pricing-page .scene { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; background: linear-gradient(180deg,#EAF3FA 0%,#E3EDF6 55%,#D6E7F4 100%); }
//   .pricing-page .orb { position: absolute; border-radius: 50%; background: radial-gradient(circle at 30% 28%, rgba(255,255,255,.95), rgba(125,200,240,.30) 52%, rgba(125,200,240,0) 70%); transform: translate3d(calc(var(--px,0) * var(--dx) * 1px), calc(var(--py,0) * var(--dy) * 1px - var(--sy,0) * var(--sp) * 1px), 0); transition: transform .5s cubic-bezier(.22,1,.36,1); will-change: transform; }
//   .pricing-page .bubble { position: absolute; top: 0; border-radius: 50%; background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.95), rgba(186,230,253,.35) 60%, rgba(186,230,253,.05)); box-shadow: inset -2px -2px 4px rgba(56,189,248,.18), 1px 1px 3px rgba(255,255,255,.7); animation: rise linear infinite; will-change: transform; opacity: .7; }
//   .pricing-page .wave { position: absolute; left: 0; width: 200%; height: 160px; animation: drift linear infinite; will-change: transform; }
//   .pricing-page .w1 { bottom: 0; animation-duration: 36s; }
//   .pricing-page .w2 { bottom: -18px; animation-duration: 54s; animation-direction: reverse; }

//   /* Hero depth layers (share the same pointer variables) */
//   .pricing-page .h-orb { position:absolute; border-radius:50%; border:1px solid rgba(255,255,255,.18); background: radial-gradient(circle at 30% 28%, rgba(255,255,255,.28), rgba(52,211,153,.10) 55%, rgba(52,211,153,0) 72%); pointer-events:none; transform: translate3d(calc(var(--px,0) * var(--dx) * 1px), calc(var(--py,0) * var(--dy) * 1px), 0); transition: transform .5s cubic-bezier(.22,1,.36,1); will-change: transform; }

//   .pricing-hero-illustration { position: absolute; right: max(20px, calc((100vw - 1160px) / 2)); top: 50%; transform: translateY(-50%); width: min(30vw, 340px); height: auto; opacity: .94; pointer-events: none; }
//   @media (max-width: 900px) { .pricing-hero-illustration { display: none; } }
//   .pricing-page .plan-card { animation: fadeUp 0.5s ease both; }
//   .pricing-page .plan-card:nth-child(1){animation-delay:0ms}
//   .pricing-page .plan-card:nth-child(2){animation-delay:80ms}
//   .pricing-page .plan-card:nth-child(3){animation-delay:160ms}
//   .pricing-page .defer { content-visibility: auto; contain-intrinsic-size: auto 520px; }

//   .pricing-page input[type=range].range { -webkit-appearance:none; appearance:none; height:8px; border-radius:8px; box-shadow: inset 2px 2px 4px #b7c8d9, inset -2px -2px 4px #fff; cursor:pointer; }
//   .pricing-page input[type=range].range::-webkit-slider-thumb { -webkit-appearance:none; width:22px; height:22px; border-radius:50%; background:#0EA5E9; border:3px solid #E3EDF6; box-shadow: 3px 3px 6px #b7c8d9; cursor:pointer; }
//   .pricing-page input[type=range].range::-moz-range-thumb { width:18px; height:18px; border-radius:50%; background:#0EA5E9; border:3px solid #E3EDF6; cursor:pointer; }
//   .pricing-page .billing-toggle button { transition: all 0.2s; }

//   .pricing-page .m-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; display: flex; gap: 10px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); background: linear-gradient(180deg, rgba(227,237,246,0), #E3EDF6 35%); }
//   .pricing-page .m-spacer { height: 84px; }
//   @media (min-width: 900px) { .pricing-page .m-bar, .pricing-page .m-spacer { display: none; } }
//   @media (max-width: 640px) { .pricing-page .bubble:nth-child(n+7) { display: none; } }
//   @media (prefers-reduced-motion: reduce) {
//     .pricing-page *, .pricing-page *::before { animation: none !important; transition: none !important; }
//     .pricing-page { scroll-behavior: auto; }
//     .pricing-page .bubble { display: none; }
//   }

//   /* ── 20L can price card (original block, re-skinned) ── */
//   .pc-root { max-width: 1160px; margin: -40px auto 0; padding: 0 24px; position: relative; z-index: 10; }
//   .pc-card { background: #E3EDF6; border-radius: 24px; box-shadow: 9px 9px 22px #b7c8d9, -9px -9px 22px #ffffff, 0 24px 56px rgba(13,155,108,0.10); overflow: hidden; }
//   .pc-accent-bar { height: 3px; background: linear-gradient(90deg, #0D9B6C 0%, #34D399 50%, #0D9B6C 100%); }
//   .pc-grid { display: grid; grid-template-columns: auto 1px 1fr; align-items: stretch; }
//   .pc-left { display: flex; align-items: center; gap: 16px; padding: 24px 28px; }
//   .pc-icon { width: 52px; height: 52px; border-radius: 15px; background: #E3EDF6; box-shadow: inset 4px 4px 8px #b7c8d9, inset -4px -4px 8px #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
//   .pc-label { font-size: 10px; font-weight: 700; color: #475569; letter-spacing: 0.1em; text-transform: uppercase; }
//   .pc-badge { font-size: 9px; font-weight: 700; color: #065F46; background: #ECFDF5; border: 1px solid #A7F3D0; padding: 2px 7px; border-radius: 99px; letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap; }
//   .pc-price-main { font-family: var(--font-syne), 'Syne', sans-serif; font-weight: 900; font-size: 30px; color: #0F1C18; letter-spacing: -1.5px; line-height: 1; }
//   .pc-save-pill { display: inline-flex; align-items: center; gap: 4px; background: #FEF9C3; border: 1px solid #FDE047; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; color: #78350F; }
//   .pc-vdivider { width: 1px; align-self: stretch; background: linear-gradient(to bottom, transparent 10%, #b7c8d9 40%, #b7c8d9 60%, transparent 90%); }
//   .pc-right { display: flex; flex-direction: column; justify-content: center; gap: 16px; padding: 22px 24px 22px 28px; }
//   .pc-tiers { display: flex; gap: 12px; flex-wrap: nowrap; }
//   .pc-tier { border-radius: 14px; padding: 12px 16px; position: relative; flex: 0 0 auto; width: 150px; box-shadow: 4px 4px 9px #b7c8d9, -4px -4px 9px #fff; transition: transform 0.2s ease; }
//   .pc-tier:hover { transform: translateY(-2px); }
//   .pc-tier-label { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px; }
//   .pc-tier-price { font-family: var(--font-syne), 'Syne', sans-serif; font-weight: 900; font-size: 18px; letter-spacing: -0.5px; line-height: 1.1; }
//   .pc-tier-sub { font-size: 10px; font-weight: 600; margin-top: 2px; }
//   .pc-best-pin { position: absolute; top: -9px; left: 50%; transform: translateX(-50%); background: #0D9B6C; color: #fff; font-size: 8px; font-weight: 700; letter-spacing: 0.08em; padding: 2px 8px 3px; border-radius: 99px; text-transform: uppercase; white-space: nowrap; }
//   .pc-cta-row { display: flex; align-items: center; gap: 12px; flex-wrap: nowrap; }
//   .pc-cta-btn { background: #0D9B6C; color: #fff; font-weight: 700; font-size: 14px; letter-spacing: -0.2px; padding: 13px 24px; min-height: 48px; border-radius: 13px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; flex-shrink: 0; box-shadow: 0 4px 16px rgba(13,155,108,0.30); transition: transform 0.18s ease, box-shadow 0.18s ease; }
//   .pc-cta-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(13,155,108,0.40); }
//   .pc-cta-btn:active { transform: scale(0.97); }
//   .pc-cta-arrow { background: rgba(255,255,255,0.2); padding: 2px 7px; border-radius: 6px; font-size: 11px; font-weight: 600; }
//   .pc-trust { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #64748B; font-weight: 500; white-space: nowrap; }
//   .pc-trust-dot { width: 3px; height: 3px; border-radius: 50%; background: #94A3B8; flex-shrink: 0; display: inline-block; }

//   @media (max-width: 960px) {
//     .pc-grid { grid-template-columns: 1fr; }
//     .pc-vdivider { display: none; }
//     .pc-left { padding: 22px 22px 16px; border-bottom: 1px solid rgba(148,163,184,.3); }
//     .pc-right { padding: 18px 22px 22px; }
//     .pc-tiers { flex-wrap: wrap; }
//     .pc-tier { flex: 1 1 130px; width: auto; }
//     .pc-cta-row { flex-wrap: wrap; }
//   }
//   @media (max-width: 560px) {
//     .pc-root { padding: 0 16px; margin-top: -28px; }
//     .pc-card { border-radius: 18px; }
//     .pc-left { padding: 18px 18px 14px; gap: 12px; }
//     .pc-icon { width: 44px; height: 44px; border-radius: 12px; }
//     .pc-price-main { font-size: 26px; }
//     .pc-right { padding: 16px 18px 20px; gap: 14px; }
//     .pc-tiers { flex-direction: column; gap: 12px; }
//     .pc-tier { width: 100%; flex: none; display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; }
//     .pc-tier-price { font-size: 16px; }
//     .pc-cta-btn { width: 100%; justify-content: center; }
//     .pc-trust { flex-wrap: wrap; }
//   }
//   @media (max-width: 360px) { .pc-price-main { font-size: 22px; } .pc-left { gap: 10px; } }
// `;

// const H2: React.CSSProperties = { margin: 0, fontSize: 'clamp(1.3rem,3vw,2rem)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.5px' };

// // ─── MAIN PAGE ─────────────────────────────────────────────────────────────────
// export default function PricingClient() {
//   const router = useRouter();
//   const rootRef = useRef<HTMLDivElement>(null);
//   const [tab, setTab] = useState<PricingTab>('individual');
//   const [billing, setBilling] = useState<BillingCycle>('weekly');
//   const [showCompare, setShowCompare] = useState(false);
//   const [city, setCity] = useState('Kanpur');
//   const { settings } = useSettings(undefined, city);
//   const normalPrice = settings.default_can_price;
//   const chilledPrice = settings.chilled_can_price;
//   const recurringPrice = settings.subscription_can_price;

//   // Pointer + scroll parallax: writes CSS variables only (no React re-render), rAF-throttled, mouse only, off for reduced motion.
//   useEffect(() => {
//     const el = rootRef.current;
//     if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
//     let raf = 0, px = 0, py = 0, sy = 0;
//     const apply = () => {
//       raf = 0;
//       el.style.setProperty('--px', px.toFixed(3));
//       el.style.setProperty('--py', py.toFixed(3));
//       el.style.setProperty('--sy', String(sy));
//     };
//     const schedule = () => { if (!raf) raf = requestAnimationFrame(apply); };
//     const onMove = (e: PointerEvent) => {
//       if (e.pointerType !== 'mouse') return;
//       px = (e.clientX / window.innerWidth - 0.5) * 2;
//       py = (e.clientY / window.innerHeight - 0.5) * 2;
//       schedule();
//     };
//     const onScroll = () => { sy = Math.min(window.scrollY, 2400); schedule(); };
//     window.addEventListener('pointermove', onMove, { passive: true });
//     window.addEventListener('scroll', onScroll, { passive: true });
//     return () => {
//       window.removeEventListener('pointermove', onMove);
//       window.removeEventListener('scroll', onScroll);
//       if (raf) cancelAnimationFrame(raf);
//     };
//   }, []);

//   // Keep public plan totals aligned with the server-authoritative launch
//   // pricing in /api/customer/orders. Legacy/bulk settings must not make public
//   // cards advertise prices the order API will reject.
//   const deliveryTotal = (quantity: number, orderType: 'one_time' | 'subscription' = 'subscription') => {
//     const unit = orderType === 'subscription' ? recurringPrice : normalPrice;
//     return quantity * unit;
//   };
//   const officeQuantity = Math.max(50, settings.bulk_threshold);

//   const faq: FaqItem[] = FAQS;

//   const individualPlans: SubPlan[] = [
//     {
//       id: 'pay-per-can',
//       name: 'Pay as you go',
//       tagline: 'No commitment. Order only when needed.',
//       pricePerDelivery: deliveryTotal(1, 'one_time'),
//       unitPrice: normalPrice,
//       cansPerDelivery: 1,
//       perCan: `₹${normalPrice}/can (no separate water handling fee) before any legally applicable tax`,
//       features: [
//         { text: '20L water can delivery', included: true },
//         { text: 'Choose from available delivery slots', included: true },
//         { text: 'Pay on delivery (Cash/UPI)', included: true },
//         { text: 'View order status in your account', included: true },
//         { text: 'Subscription discount', included: false },
//         { text: 'Scheduled repeat deliveries', included: false },
//         { text: 'Priority support', included: false },
//       ],
//       cta: 'Order a Can',
//       ctaVariant: 'outline',
//     },
//     {
//       id: 'starter',
//       name: 'Home Starter',
//       tagline: 'A convenient recurring schedule for home.',
//       badge: 'Most Popular',
//       badgeColor: 'green',
//       pricePerDelivery: deliveryTotal(10),
//       unitPrice: recurringPrice,
//       cansPerDelivery: 10,
//       perCan: `₹${recurringPrice}/can · same rate as one-time Normal RO (no separate water handling fee) before any legally applicable tax`,
//       features: [
//         { text: '10 cans per delivery at the recurring rate', included: true },
//         { text: 'Flexible delivery schedule', included: true },
//         { text: 'Select weekly or monthly delivery', included: true },
//         { text: 'Pay on delivery (Cash/UPI)', included: true },
//         { text: 'Pay separately for each delivery', included: true },
//         { text: 'Pause or cancel future deliveries', included: true },
//         { text: 'Priority support', included: false },
//       ],
//       cta: 'Start Starter Plan',
//       ctaVariant: 'primary',
//       highlight: true,
//     },
//     {
//       id: 'pro',
//       name: 'Family',
//       tagline: 'For households that need more cans per delivery.',
//       badge: 'Best Value',
//       badgeColor: 'blue',
//       pricePerDelivery: deliveryTotal(20),
//       unitPrice: recurringPrice,
//       cansPerDelivery: 20,
//       perCan: `₹${recurringPrice}/can · same rate as one-time Normal RO (no separate water handling fee) before any legally applicable tax`,
//       features: [
//         { text: '20 cans per delivery at the recurring rate', included: true },
//         { text: 'Choose weekly or monthly delivery', included: true },
//         { text: 'Clear total before each booking', included: true },
//         { text: 'Cash or UPI payment per delivery', included: true },
//         { text: 'Order history and status updates', included: true },
//         { text: 'Pause or cancel future deliveries', included: true },
//         { text: 'No automatic debit', included: true },
//       ],
//       cta: 'Start Family Plan',
//       ctaVariant: 'outline',
//     },
//   ];

//   const businessPlans: SubPlan[] = [
//     {
//       id: 'office',
//       name: 'Bulk Delivery',
//       tagline: 'For offices, shops and high-volume households.',
//       badge: 'Popular',
//       badgeColor: 'amber',
//       pricePerDelivery: deliveryTotal(officeQuantity, 'one_time'),
//       unitPrice: settings.bulk_can_price,
//       cansPerDelivery: officeQuantity,
//       perCan: `₹${settings.bulk_can_price}/can (no separate water handling fee) before any legally applicable tax`,
//       features: [
//         { text: `${officeQuantity} cans per delivery at the bulk rate`, included: true },
//         { text: 'Scheduled bulk deliveries', included: true },
//         { text: 'Final total shown before confirmation', included: true },
//         { text: 'Scheduled recurring delivery', included: true },
//         { text: 'Cash or UPI payment per delivery', included: true },
//         { text: 'Dedicated account manager', included: false },
//         { text: 'Delivery availability depends on your area', included: true },
//       ],
//       cta: 'Get Office Plan',
//       ctaVariant: 'outline',
//     },
//     {
//       id: 'business',
//       name: 'Business / Society',
//       tagline: 'For bulk supply enquiries and multiple-site needs.',
//       badge: 'Enterprise',
//       badgeColor: 'green',
//       pricePerDelivery: 0,
//       unitPrice: null,
//       cansPerDelivery: 'Custom volume',
//       perCan: 'Request a volume and locality-based quote',
//       features: [
//         { text: 'Custom volume and delivery schedule', included: true },
//         { text: 'Confirm address coverage before contracting', included: true },
//         { text: 'Supplier capacity and service area confirmed', included: true },
//         { text: 'Written price and service terms before order', included: true },
//         { text: 'Ask about business documentation needs', included: true },
//         { text: 'No unconfirmed service add-ons', included: true },
//         { text: 'Optional related services quoted separately', included: true },
//       ],
//       cta: 'Get Custom Quote',
//       ctaVariant: 'dark',
//       highlight: true,
//     },
//   ];

//   const activePlans = tab === 'individual' ? individualPlans : businessPlans;

//   const handlePlanCta = (plan: SubPlan) => {
//     if (plan.id === 'business' || plan.id === 'pay-per-can') {
//       if (plan.id === 'business') window.open(WHATSAPP, '_blank', 'noopener,noreferrer');
//       else router.push('/book?service=water_can');
//     } else {
//       router.push(`/book?service=water_can&plan=${plan.id}&frequency=${billing}`);
//     }
//   };

//   const prices = settings.service_base_prices as Record<string, number>;
//   const inr = (n: number) => '₹' + Number(n).toLocaleString('en-IN');
//   const waText = encodeURIComponent('Hi, I want to order water cans. Please share availability for my address.');

//   const spotlight = [
//     {
//       key: 'plumbing', emoji: '🔧', title: 'Plumber', tag: 'Fix it right',
//       lead: 'Leaks, taps, pipes and bathroom or kitchen fittings, handled by a technician you can see before you book.',
//       points: ['Leak and pipe repair', 'Tap, mixer and fitting installation', 'Bathroom and kitchen plumbing', 'Scope and final price confirmed before work'],
//       book: '/book?service=plumbing', browse: '/technicians?skill=Plumbing',
//     },
//     {
//       key: 'tank_cleaning', emoji: '🪣', title: 'Tank cleaning', tag: 'Cleaner storage',
//       lead: 'Keep stored water cleaner with a booked tank cleaning visit for overhead and underground tanks.',
//       points: ['Overhead and underground water tanks', 'Price depends on capacity and access', 'Scope agreed before work begins', 'Ask us about repeat cleaning schedules'],
//       book: '/book?service=tank_cleaning', browse: '/technicians?skill=Tank%20Cleaning',
//     },
//   ];

//   return (
//     <div className="pricing-page" ref={rootRef}>
//       <div className="relative z-10 mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 pt-4 text-sm"><label htmlFor="pricing-city" className="font-bold text-slate-700">Prices for</label><select id="pricing-city" value={city} onChange={e=>setCity(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-900 shadow-sm">{['Kanpur','Lucknow','Gorakhpur','Noida','Delhi','Ghaziabad','Gurugram'].map(name=><option key={name}>{name}</option>)}</select></div>
//       <style>{CSS}</style>
//       <SpatialScene />

//       <div className="layer">
//         {/* ── HERO ── */}
//         <header style={{ background: 'linear-gradient(135deg,#022C22 0%,#064E3B 55%,#0D9B6C 100%)', padding: '68px 24px 100px', position: 'relative', overflow: 'hidden' }}>
//           <div aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0.06, backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />
//           <div aria-hidden style={{ position: 'absolute', top: -100, right: -80, width: 360, height: 360, borderRadius: '50%', background: '#34D399', opacity: 0.07, pointerEvents: 'none' }} />
//           <div aria-hidden style={{ position: 'absolute', bottom: -60, left: -60, width: 240, height: 240, borderRadius: '50%', background: '#0D9B6C', opacity: 0.06, pointerEvents: 'none' }} />
//           {/* spatial depth: glass orbs at different parallax depths */}
//           <span aria-hidden className="h-orb" style={{ width: 220, height: 220, left: '8%', top: '18%', ['--dx' as string]: -22, ['--dy' as string]: -14 }} />
//           <span aria-hidden className="h-orb" style={{ width: 140, height: 140, left: '46%', bottom: '8%', ['--dx' as string]: 30, ['--dy' as string]: 20 }} />
//           <span aria-hidden className="h-orb" style={{ width: 90, height: 90, right: '30%', top: '10%', ['--dx' as string]: -40, ['--dy' as string]: 26 }} />
//           <Image
//             src="/illustrations/water-can-delivery.svg"
//             alt=""
//             aria-hidden="true"
//             width={640}
//             height={420}
//             priority
//             sizes="(max-width: 900px) 0px, 32vw"
//             className="pricing-hero-illustration"
//           />

//           <div style={{ maxWidth: 1160, margin: '0 auto', position: 'relative', zIndex: 1 }}>
//             {/* trust pill */}
//             <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 999, padding: '6px 14px', marginBottom: 20 }}>
//               <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: '#34D399', display: 'inline-block', animation: 'pulse 2s infinite' }} />
//               <span style={{ fontSize: 12, fontWeight: 700, color: '#6EE7B7', letterSpacing: '0.07em' }}>SERVING KANPUR, LUCKNOW &amp; GORAKHPUR</span>
//             </div>

//             {/* Main headline — ALL IN ONE H1 */}
//             <h1 className="syne" style={{ margin: '0 0 20px', fontWeight: 900, lineHeight: 1.0, letterSpacing: '-1.5px', maxWidth: 640 }}>
//               <span style={{ display: 'block', fontSize: 'clamp(2rem, 3.8vw, 3.6rem)', color: '#fff' }}>Clear water-can pricing.</span>
//               <span style={{ display: 'block', fontSize: 'clamp(2rem, 3.8vw, 3.6rem)', color: '#34D399' }}>20L cans from ₹{normalPrice}.</span>

//               {/* visual divider inside h1 */}
//               <span style={{ display: 'block', height: 1, background: 'rgba(255,255,255,0.1)', maxWidth: 360, margin: '18px 0' }} />

//               <span style={{ display: 'block', fontSize: 'clamp(1.5rem, 2.8vw, 2.6rem)', color: '#fff', letterSpacing: '-1px' }}>
//                 Recurring delivery at{' '}
//                 <span style={{ color: '#34D399' }}>₹{recurringPrice} / Can.</span>{' '}
//                 <span style={{ color: 'rgba(255,255,255,0.7)' }}>Final rate shown before booking.</span>
//               </span>
//             </h1>
//             <p style={{ margin: '18px 0 0', fontSize: 17, color: 'rgba(255,255,255,0.75)', maxWidth: 480, lineHeight: 1.65 }}>
//               Normal RO ₹{normalPrice} and Chilled RO ₹{chilledPrice} per 20L can, with delivery included and no separate water handling fee. Need a water-system repair? Book a plumber from AuroWater too. Review your payable total before confirming.
//             </p>
//             <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
//               <button type="button" onClick={() => router.push('/book?service=water_can&water=normal')} style={{ border: 0, borderRadius: 999, padding: '12px 18px', minHeight: 46, background: '#06B6D4', color: '#082F49', fontWeight: 800, cursor: 'pointer' }}>Order Normal RO</button>
//               <button type="button" onClick={() => router.push('/book?service=plumbing')} style={{ border: '1px solid rgba(255,255,255,.35)', borderRadius: 999, padding: '12px 18px', minHeight: 46, background: 'rgba(255,255,255,.1)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Find a Plumber</button>
//               <button type="button" onClick={() => router.push('/book?service=tank_cleaning')} style={{ border: '1px solid rgba(255,255,255,.35)', borderRadius: 999, padding: '12px 18px', minHeight: 46, background: 'rgba(255,255,255,.1)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Book Tank Cleaning</button>
//             </div>

//             {/* hero value props */}
//             <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 28, padding: 0, listStyle: 'none' }}>
//               {[`₹${recurringPrice}/can on recurring deliveries · same per-can rate`, '50+ cans: confirm volume quote before booking', 'Pause future deliveries', 'Cash or UPI per delivery'].map((t) => (
//                 <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.09)', borderRadius: 999, padding: '7px 14px', border: '1px solid rgba(255,255,255,0.12)' }}>
//                   <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M2 6l3 3 5-5" stroke="#34D399" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
//                   <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.88)', fontWeight: 600 }}>{t}</span>
//                 </li>
//               ))}
//             </ul>
//           </div>
//         </header>

//         {/* ── 20L CAN PRICE CARD ── */}
//         <div className="pc-root">
//           <div className="pc-card">
//             <div className="pc-accent-bar" />
//             <div className="pc-grid">
//               {/* LEFT: Product identity */}
//               <div className="pc-left">
//                 <div className="pc-icon">
//                   <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true">
//                     <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" fill="#0D9B6C" fillOpacity={0.2} />
//                     <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" stroke="#0D9B6C" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
//                   </svg>
//                 </div>
//                 <div>
//                   <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2, flexWrap: 'wrap' }}>
//                     <span className="pc-label">20L Water Can</span>
//                     <span className="pc-badge">Price shown before booking</span>
//                   </div>
//                   <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, margin: '4px 0 6px', flexWrap: 'wrap' }}>
//                     <span className="pc-price-main">₹{normalPrice}</span>
//                     <span style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>/ can · one-time</span>
//                   </div>
//                   <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
//                     <span className="pc-save-pill">Delivery included · No separate water delivery fee</span>
//                   </div>
//                 </div>
//               </div>

//               <div className="pc-vdivider" />

//               {/* RIGHT: Tiers + CTA */}
//               <div className="pc-right">
//                 <div className="pc-tiers">
//                   {(
//                     [
//                       { label: 'Pay-as-you-go', sublabel: 'No commitment', price: `₹${normalPrice}/can`, bg: '#EEF4FF', tc: '#1E3A8A', lc: '#2563EB', sc: '#3B6FD8', best: false },
//                       { label: 'Subscription', sublabel: 'Recurring delivery', price: `₹${recurringPrice}/can · Same per-can rate`, bg: '#E8F7F1', tc: '#065F46', lc: '#047857', sc: '#0D8A5F', best: false },
//                       { label: `Bulk ${settings.bulk_threshold}+`, sublabel: 'Confirm volume quote before booking', price: 'Quote required', bg: '#FFF7E0', tc: '#78350F', lc: '#B45309', sc: '#B45309', best: false },
//                     ] as const
//                   ).map((t) => (
//                     <div key={t.label} className="pc-tier" style={{ background: t.bg }}>
//                       {t.best && <div className="pc-best-pin">Best value</div>}
//                       <div>
//                         <div className="pc-tier-label" style={{ color: t.lc }}>{t.label}</div>
//                         <div className="pc-tier-price" style={{ color: t.tc }}>{t.price}</div>
//                       </div>
//                       <div className="pc-tier-sub" style={{ color: t.sc }}>{t.sublabel}</div>
//                     </div>
//                   ))}
//                 </div>

//                 <div className="pc-cta-row">
//                   <button type="button" onClick={() => router.push('/book?service=water_can')} className="pc-cta-btn">
//                     <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true">
//                       <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" fill="rgba(255,255,255,0.35)" />
//                       <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
//                     </svg>
//                     Order a Can Now
//                     <span className="pc-cta-arrow">→</span>
//                   </button>
//                   <div className="pc-trust">
//                     <span>Availability checked for your address</span>
//                     <span className="pc-trust-dot" />
//                     <span>Clear order total</span>
//                     <span className="pc-trust-dot" />
//                     <span>Pause future deliveries</span>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Water product prices — kept separate from subscription plan pricing. */}
//         <section aria-labelledby="water-products-title" className="defer" style={{ maxWidth: 1160, margin: '0 auto', padding: '40px 24px 0' }}>
//           <div style={{ marginBottom: 20 }}>
//             <h2 id="water-products-title" style={H2}>Choose your water</h2>
//             <p style={{ margin: '6px 0 0', color: '#475569', fontSize: 14 }}>Straightforward pricing for everyday use or events.</p>
//           </div>
//           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 22 }}>
//             <article className="nu nu-hover" style={{ borderRadius: 22, padding: 24 }}>
//               <p style={{ margin: 0, color: '#047857', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Everyday essential</p>
//               <h3 style={{ margin: '8px 0 0', color: '#0F172A', fontSize: 20, fontWeight: 900 }}>Normal RO Water</h3>
//               <p style={{ margin: '8px 0 0', color: '#047857', fontSize: 30, fontWeight: 900 }}>₹{normalPrice}<span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}> / 20L can</span></p>
//               <p style={{ margin: '8px 0 16px', color: '#475569', fontSize: 13 }}>For daily home and office drinking-water needs. Delivery included in the displayed water-can price.</p>
//               <button type="button" onClick={() => router.push('/book?service=water_can&water=normal')} className="cta" style={{ background: '#047857', color: '#fff' }}>Order Normal RO</button>
//             </article>
//             <article className="nu nu-hover" style={{ borderRadius: 22, padding: 24 }}>
//               <p style={{ margin: 0, color: '#0369A1', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>For events &amp; gatherings</p>
//               <h3 style={{ margin: '8px 0 0', color: '#0F172A', fontSize: 20, fontWeight: 900 }}>Chilled RO Water</h3>
//               <p style={{ margin: '8px 0 0', color: '#0369A1', fontSize: 30, fontWeight: 900 }}>₹{chilledPrice}<span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}> / 20L can</span></p>
//               <p style={{ margin: '8px 0 16px', color: '#475569', fontSize: 13 }}>Chilled and delivered for weddings, parties, functions and office gatherings.</p>
//               <button type="button" onClick={() => router.push('/book?service=water_can&water=chilled')} className="cta" style={{ background: '#0369A1', color: '#fff' }}>Order Chilled Water</button>
//             </article>
//           </div>
//         </section>

//         {/* ── Monthly cost estimator (new) ── */}
//         <section aria-labelledby="calc-title" className="defer" style={{ maxWidth: 1160, margin: '0 auto', padding: '56px 24px 0' }}>
//           <WaterCalculator normalPrice={normalPrice} chilledPrice={chilledPrice} onOrder={(w) => router.push(`/book?service=water_can&water=${w}`)} />
//         </section>

//         {/* ── MAIN CONTENT ── */}
//         <div style={{ maxWidth: 1160, margin: '0 auto', padding: '56px 24px 40px' }}>

//           {/* section header + tab toggle */}
//           <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
//             <div>
//               <h2 style={{ ...H2, fontSize: 'clamp(1.5rem,3.5vw,2.2rem)', letterSpacing: '-0.8px' }}>Choose your plan</h2>
//               <p style={{ margin: '6px 0 0', fontSize: 14, color: '#475569' }}>Transparent per-delivery pricing. Pause or cancel future deliveries.</p>
//             </div>

//             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
//               {/* Individual / Business tab */}
//               <div className="nu-in" role="tablist" aria-label="Customer type" style={{ display: 'flex', borderRadius: 14, padding: 5, gap: 4 }}>
//                 {(['individual', 'business'] as PricingTab[]).map((t) => (
//                   <button
//                     key={t}
//                     type="button"
//                     role="tab"
//                     aria-selected={tab === t}
//                     onClick={() => setTab(t)}
//                     className={tab === t ? 'nu-sm' : ''}
//                     style={{ padding: '9px 18px', minHeight: 40, borderRadius: 10, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', background: tab === t ? '#E3EDF6' : 'transparent', color: tab === t ? '#0F172A' : '#64748B', transition: 'all 0.2s' }}
//                   >
//                     {t === 'individual' ? '👤 Individual' : '🏢 Business'}
//                   </button>
//                 ))}
//               </div>

//               {/* Delivery frequency toggle */}
//               <div className="billing-toggle nu-in" role="group" aria-label="Delivery frequency" style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 999, padding: '5px 8px' }}>
//                 <button type="button" aria-pressed={billing === 'weekly'} onClick={() => setBilling('weekly')} className={billing === 'weekly' ? 'nu-sm' : ''} style={{ padding: '6px 14px', minHeight: 34, borderRadius: 999, fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', background: billing === 'weekly' ? '#E3EDF6' : 'transparent', color: billing === 'weekly' ? '#0F172A' : '#64748B' }}>Weekly</button>
//                 <button type="button" aria-pressed={billing === 'monthly'} onClick={() => setBilling('monthly')} className={billing === 'monthly' ? 'nu-sm' : ''} style={{ padding: '6px 14px', minHeight: 34, borderRadius: 999, fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer', background: billing === 'monthly' ? '#E3EDF6' : 'transparent', color: billing === 'monthly' ? '#0F172A' : '#64748B', display: 'flex', alignItems: 'center', gap: 5 }}>Monthly</button>
//               </div>
//             </div>
//           </div>

//           {/* Plan cards */}
//           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>
//             {activePlans.map((plan) => (
//               <div key={plan.id} className="plan-card">
//                 <SubCard plan={plan} frequency={billing} onCta={() => handlePlanCta(plan)} />
//               </div>
//             ))}
//           </div>

//           {/* Compare table toggle */}
//           <div style={{ textAlign: 'center', marginTop: 32 }}>
//             <button
//               type="button"
//               aria-expanded={showCompare}
//               onClick={() => setShowCompare((v) => !v)}
//               className="nu-sm nu-press"
//               style={{ border: 'none', borderRadius: 14, padding: '11px 24px', minHeight: 46, fontSize: 13, fontWeight: 700, color: '#334155', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}
//             >
//               {showCompare ? 'Hide' : 'Compare all plans'}
//               <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden style={{ transform: showCompare ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M2.5 4.5L6.5 8.5L10.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
//             </button>
//           </div>

//           {showCompare && (
//             <div style={{ marginTop: 24, animation: 'fadeUp 0.3s ease both' }}>
//               <CompareTable settings={settings} />
//             </div>
//           )}

//           {/* Honest value proposition: no unverified competitor-price claims. */}
//           <div className="nu defer" style={{ marginTop: 64, borderRadius: 24, padding: 28 }}>
//             <h2 style={{ ...H2, color: '#064E3B' }}>A simpler way to manage water delivery</h2>
//             <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.7, color: '#475569' }}>Choose one-time delivery when you need it, or schedule recurring deliveries for convenience. There is no automatic debit. The price shown for each delivery is reviewed before you confirm, and you can pause or cancel future schedules.</p>
//           </div>

//           {/* ── Plumber & tank cleaning spotlight (new) ── */}
//           <section aria-labelledby="spot-h" className="defer" style={{ marginTop: 64 }}>
//             <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#047857' }}>Beyond water cans</p>
//             <h2 id="spot-h" style={{ ...H2, marginTop: 6 }}>Plumber and tank cleaning, booked the same way</h2>
//             <p style={{ margin: '8px 0 24px', fontSize: 14, color: '#475569', maxWidth: 640, lineHeight: 1.65 }}>Use one account for water cans and for the people who keep your water system working. See the starting estimate, check availability for your address, and confirm the scope before work begins.</p>
//             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 24 }}>
//               {spotlight.map((s) => (
//                 <article key={s.key} className="nu nu-hover" style={{ borderRadius: 24, padding: 26, display: 'flex', flexDirection: 'column' }}>
//                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
//                     <span aria-hidden className="nu-in" style={{ width: 56, height: 56, borderRadius: 18, display: 'grid', placeItems: 'center', fontSize: 28 }}>{s.emoji}</span>
//                     <Pill color="green">{s.tag}</Pill>
//                   </div>
//                   <h3 style={{ margin: '16px 0 0', fontSize: 22, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.4px' }}>{s.title}</h3>
//                   <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.65, color: '#475569' }}>{s.lead}</p>
//                   <p style={{ margin: '14px 0 0', fontSize: 13, color: '#475569' }}>
//                     <span style={{ fontSize: 26, fontWeight: 900, color: '#047857', letterSpacing: '-0.5px' }}>{inr(prices[s.key] ?? 0)}</span> starting estimate
//                   </p>
//                   <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
//                     {s.points.map((p) => (
//                       <li key={p} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13, color: '#334155', fontWeight: 500, lineHeight: 1.4 }}><IconCheck />{p}</li>
//                     ))}
//                   </ul>
//                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 22 }}>
//                     <Link href={s.book} className="cta cta-primary" style={{ flex: '1 1 150px', width: 'auto' }}>Book {s.title.toLowerCase()}</Link>
//                     <Link href={s.browse} className="cta cta-outline" style={{ flex: '1 1 150px', width: 'auto' }}>See technicians</Link>
//                   </div>
//                 </article>
//               ))}
//             </div>

//             <ol style={{ listStyle: 'none', margin: '28px 0 0', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
//               {[
//                 ['Choose your service', 'Pick plumbing, tank cleaning, RO, borewell, motor or tanker.'],
//                 ['Check price and area', 'See the starting estimate and whether we cover your address.'],
//                 ['Confirm and track', 'Confirm the scope, then follow your booking from your account.'],
//               ].map(([t, d], i) => (
//                 <li key={t} className="nu-sm" style={{ borderRadius: 18, padding: 18, display: 'flex', gap: 14 }}>
//                   <span className="nu-in" style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', fontWeight: 900, color: '#047857', flexShrink: 0 }}>{i + 1}</span>
//                   <span><strong style={{ display: 'block', color: '#0F172A', fontSize: 14 }}>{t}</strong><span style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5 }}>{d}</span></span>
//                 </li>
//               ))}
//             </ol>
//           </section>

//           {/* ── Other home services pricing ── */}
//           <section aria-labelledby="svc-h" className="defer" style={{ marginTop: 64 }}>
//             <h2 id="svc-h" style={{ ...H2, margin: '0 0 6px' }}>Water &amp; home services</h2>
//             <p style={{ margin: '0 0 24px', fontSize: 14, color: '#475569' }}>Starting estimates are taken from current public settings. Confirm scope, availability and the final price before booking.</p>
//             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 20 }}>
//               {SERVICE_CARDS.map((s) => (
//                 <Link key={s.key} href={`/services/${s.key}`} aria-label={`View details for ${s.name}`} className="nu nu-hover" style={{ borderRadius: 20, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10, textDecoration: 'none' }}>
//                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
//                     <span aria-hidden style={{ fontSize: 28 }}>{s.emoji}</span>
//                   </div>
//                   <div>
//                     <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>{s.name}</div>
//                     <div style={{ fontSize: 11.5, color: '#475569', marginTop: 2 }}>{s.note}</div>
//                   </div>
//                   <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
//                     <span style={{ fontSize: 22, fontWeight: 900, color: '#047857', letterSpacing: '-0.5px' }}>{inr(prices[s.key] ?? 0)}</span>
//                     <span style={{ fontSize: 12, color: '#64748B' }}>starting estimate</span>
//                   </div>
//                 </Link>
//               ))}
//             </div>
//           </section>

//           {/* ── AMC ── */}
//           <div className="defer" style={{ marginTop: 56 }}>
//             <div style={{ borderRadius: 24, background: 'linear-gradient(135deg,#0C4A6E,#0369A1 55%,#0284C7)', padding: '40px 36px', position: 'relative', overflow: 'hidden', boxShadow: '0 20px 50px rgba(3,105,161,.25)' }}>
//               <div aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize: '24px 24px', pointerEvents: 'none' }} />
//               <div aria-hidden style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: '#38BDF8', opacity: 0.1, pointerEvents: 'none' }} />
//               <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
//                 <div>
//                   <Pill color="blue">Maintenance &amp; repeat service</Pill>
//                   <h2 style={{ margin: '12px 0 6px', fontSize: 'clamp(1.3rem,3.5vw,1.8rem)', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>Need help maintaining your water system?</h2>
//                   <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 1.6, maxWidth: 440 }}>
//                     Ask for a tailored maintenance quote based on your purifier, equipment and service needs. We will confirm the included work and price before you commit.
//                   </p>
//                   <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14, padding: 0, listStyle: 'none' }}>
//                     {['Scope agreed before work', 'Parts quoted separately where needed', 'Availability checked by area', 'Written quote before commitment'].map((t) => (
//                       <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.09)', borderRadius: 999, padding: '5px 12px', border: '1px solid rgba(255,255,255,0.12)' }}>
//                         <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
//                         <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{t}</span>
//                       </li>
//                     ))}
//                   </ul>
//                 </div>
//                 <button type="button" onClick={() => router.push('/contact')} style={{ background: '#fff', color: '#0C4A6E', fontWeight: 800, fontSize: 14, padding: '14px 28px', minHeight: 48, borderRadius: 14, border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8 }}>
//                   Request a Quote
//                   <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden><path d="M3 7h8M7.5 3.5L11 7l-3.5 3.5" stroke="#0C4A6E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
//                 </button>
//               </div>
//             </div>
//           </div>

//           {/* ── Trust strip ── */}
//           <section aria-labelledby="trust-h" className="defer" style={{ marginTop: 56 }}>
//             <h2 id="trust-h" style={{ ...H2, margin: '0 0 20px' }}>Built to be trusted</h2>
//             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 18 }}>
//               {[
//                 { icon: '🔒', title: 'No hidden charges', sub: 'Full breakdown shown at checkout.' },
//                 { icon: '↩️', title: 'Manage future deliveries', sub: 'Pause or cancel future deliveries where supported.' },
//                 { icon: '📋', title: 'Tax documents', sub: 'Ask support to confirm the documentation available for your order.' },
//                 { icon: '💬', title: 'WhatsApp support', sub: 'Contact support for order and service questions.' },
//                 { icon: '💳', title: 'No automatic debit', sub: 'You pay by cash or UPI for each delivery.' },
//                 { icon: '📍', title: 'Address checked first', sub: 'Availability is confirmed from your delivery address.' },
//               ].map((t) => (
//                 <div key={t.title} className="nu-sm" style={{ borderRadius: 18, padding: '18px 20px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
//                   <span aria-hidden className="nu-in" style={{ width: 40, height: 40, borderRadius: 13, display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0 }}>{t.icon}</span>
//                   <div>
//                     <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{t.title}</div>
//                     <div style={{ fontSize: 12, color: '#475569', marginTop: 2, lineHeight: 1.45 }}>{t.sub}</div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//             <ul aria-label="Service areas" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '22px 0 0', padding: 0, listStyle: 'none', alignItems: 'center' }}>
//               <li style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>We serve:</li>
//               {CITIES.map((c) => (
//                 <li key={c} className="nu-sm" style={{ borderRadius: 999, padding: '7px 16px', fontSize: 13, fontWeight: 700, color: '#065F46' }}>{c}</li>
//               ))}
//             </ul>
//           </section>

//           {/* ── FAQ ── */}
//           <section aria-labelledby="faq-h" className="defer" style={{ marginTop: 64 }}>
//             <div style={{ maxWidth: 700 }}>
//               <h2 id="faq-h" style={{ ...H2, margin: '0 0 6px' }}>Frequently asked questions</h2>
//               <p style={{ margin: '0 0 24px', fontSize: 14, color: '#475569' }}>Everything you need to know about pricing and delivery.</p>
//               <FaqAccordion faq={faq} />
//             </div>
//           </section>

//           {/* ── Bottom CTA ── */}
//           <div style={{ marginTop: 64, borderRadius: 24, background: 'linear-gradient(135deg,#022C22,#065F46 60%,#0D9B6C)', padding: '48px 40px', position: 'relative', overflow: 'hidden', textAlign: 'center', boxShadow: '0 24px 60px rgba(6,95,70,.28)' }}>
//             <div aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize: '24px 24px', pointerEvents: 'none' }} />
//             <div style={{ position: 'relative', zIndex: 1 }}>
//               <h2 style={{ margin: 0, fontSize: 'clamp(1.5rem,4vw,2.5rem)', fontWeight: 900, color: '#fff', letterSpacing: '-0.8px' }}>Still deciding?</h2>
//               <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, maxWidth: 400, margin: '10px auto 28px' }}>
//                 Order a single 20L can at the current one-time rate. Confirm address availability and the final amount before placing your order.
//               </p>
//               <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
//                 <button type="button" onClick={() => router.push('/book?service=water_can')} style={{ background: '#fff', color: '#065F46', fontWeight: 800, fontSize: 15, padding: '14px 28px', minHeight: 48, borderRadius: 14, border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
//                   Order a Can — ₹{normalPrice}
//                 </button>
//                 <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', fontWeight: 700, fontSize: 15, padding: '14px 28px', minHeight: 48, borderRadius: 14, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
//                   <IconWA /> Chat with us
//                 </a>
//               </div>
//             </div>
//           </div>
//         </div>

//         <div className="m-spacer" />
//       </div>

//       {/* Mobile quick-order bar */}
//       <div className="m-bar">
//         <button type="button" onClick={() => router.push('/book?service=water_can')} className="cta cta-primary" style={{ flex: 1 }}>Order a Can · ₹{normalPrice}</button>
//         <a href={`${WHATSAPP}?text=${waText}`} target="_blank" rel="noopener noreferrer" aria-label="Order on WhatsApp" className="cta cta-outline" style={{ width: 52, flexShrink: 0 }}><IconWA /></a>
//       </div>
//     </div>
//   );
// }
