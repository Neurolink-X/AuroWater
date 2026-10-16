'use client';

import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSettings } from '@/hooks/useSettings';
import {
  CATEGORIES,
  CATEGORY_ICONS,
  CITY_LINE,
  ILLUSTRATIONS,
  ILLUSTRATION_ALT,
  SERVICES,
  type Service,
  type ServiceCategory,
} from './services-data';

/* Create the number formatter once, not on every render */
const INR = new Intl.NumberFormat('en-IN');

/* ─────────────────────────────────────────────
   SVG ICONS (module-level, never re-created)
───────────────────────────────────────────── */
const IconCheck = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <circle cx="6" cy="6" r="6" fill="currentColor" fillOpacity={0.15} />
    <path d="M3.5 6l1.8 1.8 3.2-3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconArrow = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconDroplet = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" fill="currentColor" fillOpacity={0.25} />
    <path d="M12 2C6 9 4 13 4 16a8 8 0 0016 0c0-3-2-7-8-14z" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

/* ─────────────────────────────────────────────
   SERVICE CARD
   Hover is pure CSS (see services.css), so a card never re-renders on mouse move.
   memo() means cards only re-render when their own data changes.
───────────────────────────────────────────── */
type CardProps = { s: Service; index: number; normalCanPrice: number; chilledCanPrice: number };

const ServiceCard = memo(function ServiceCard({ s, index, normalCanPrice, chilledCanPrice }: CardProps) {
  const isCan = s.key === 'water_can';
  const displayPrice = isCan ? normalCanPrice : s.fromPrice;
  const displayUnit = isCan ? '/ 20L can' : s.unit;
  const displayDescription = isCan
    ? `Normal RO ₹${normalCanPrice} / 20L or Chilled RO ₹${chilledCanPrice} / 20L. Choose everyday drinking water or chilled water for gatherings; confirm availability before booking.`
    : s.desc;

  // Accent colours become CSS variables; the stylesheet does the hover work.
  const vars = {
    '--a': s.accent,
    '--al': s.accentLight,
    '--a-border': `${s.accent}33`,
    '--a-line': `${s.accent}55`,
    '--a-shadow': `${s.accent}40`,
  } as React.CSSProperties;

  // First row loads straight away; everything else waits until it is near the screen.
  const aboveFold = index < 3;

  return (
    <article className="sv-card" style={vars} aria-labelledby={`sv-${s.key}-title`}>
      {/* Lightweight original local SVG sitting in a pressed-in well; no third-party image request. */}
      <div className="sv-card-illustration">
        <Image
          src={ILLUSTRATIONS[s.key]}
          alt={ILLUSTRATION_ALT[s.key]}
          width={640}
          height={420}
          loading={aboveFold ? 'eager' : 'lazy'}
          fetchPriority={index === 0 ? 'high' : 'auto'}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      </div>

      <div className="sv-card-tag">{s.tag}</div>

      {isCan && (
        <div className="sv-chips" aria-label="20 litre water prices">
          <span className="sv-chip">Normal RO ₹{normalCanPrice}/20L</span>
          <span className="sv-chip">Chilled RO ₹{chilledCanPrice}/20L</span>
          <span className="sv-chip-note">Delivery included · No separate water delivery fee</span>
        </div>
      )}

      <div className="sv-card-body">
        <div className="sv-card-top">
          <div className="sv-card-icon">
            <IconDroplet />
          </div>

          <div className="sv-card-title-wrap">
            <h3 id={`sv-${s.key}-title`} className="sv-card-title">{s.title}</h3>
            <span className="sv-card-category">{s.category}</span>
          </div>

          <div className="sv-card-price-wrap">
            <div className="sv-card-from">From</div>
            <div className="sv-card-price">₹{INR.format(displayPrice)}</div>
            <div className="sv-card-unit">{displayUnit}</div>
          </div>
        </div>

        <p className="sv-card-desc">{displayDescription}</p>
        <div className="sv-card-divider" aria-hidden="true" />

        <div className="sv-card-includes">
          <div className="sv-includes-label">What&apos;s included</div>
          <ul className="sv-includes-list">
            {s.includes.map((it) => (
              <li key={it} className="sv-includes-item">
                <IconCheck />
                {it}
              </li>
            ))}
          </ul>
        </div>

        {/* Real links: crawlable, middle-click and long-press work, and Next can prefetch them. */}
        <Link href={`/services/${s.key}`} prefetch={false} className="sv-cta sv-cta-details">
          <span>View details</span>
          <IconArrow />
        </Link>

        <Link href={`/book?service=${encodeURIComponent(s.key)}`} className="sv-cta sv-cta-book">
          <span>Book Now</span>
          <IconArrow />
        </Link>
      </div>
    </article>
  );
});

/* ─────────────────────────────────────────────
   MAIN PAGE CONTENT
───────────────────────────────────────────── */
export default function ServicesClient() {
  const { settings } = useSettings();
  const [filter, setFilter] = useState<ServiceCategory>('All');
  const [scrolled, setScrolled] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const normalCanPrice = settings.default_can_price;
  const chilledCanPrice = settings.chilled_can_price;

  const currentServices = useMemo(
    () =>
      SERVICES.map((s) => ({
        ...s,
        fromPrice: s.key === 'water_can' ? settings.default_can_price : settings.service_base_prices[s.key] ?? s.fromPrice,
      })),
    [settings],
  );

  const filtered = useMemo(
    () => (filter === 'All' ? currentServices : currentServices.filter((s) => s.category === filter)),
    [filter, currentServices],
  );

  // Shadow under the sticky bar: one IntersectionObserver instead of a scroll listener firing on every pixel.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="sv-page">
      {/* ══ HERO ══════════════════════════════════════════ */}
      <div className="sv-hero">
        <div className="sv-hero-grid" aria-hidden="true" />
        <div className="sv-orb sv-orb-a" aria-hidden="true" />
        <div className="sv-orb sv-orb-b" aria-hidden="true" />
        <div className="sv-ripple sv-ripple-1" aria-hidden="true" />
        <div className="sv-ripple sv-ripple-2" aria-hidden="true" />

        <div className="sv-hero-inner">
          <div className="sv-hero-eyebrow">
            <span className="sv-eyebrow-dot" />
            Serving {CITY_LINE}
          </div>

          <h1 className="sv-hero-title">
            Water delivery, repairs &amp;<br />
            <span>home-service professionals.</span>
          </h1>

          <p className="sv-hero-sub">
            Order Normal RO Water for ₹{normalCanPrice} or Chilled RO Water for ₹{chilledCanPrice} per 20L can, or book a plumber, RO technician, pump repair or tank-cleaning professional. Check availability and review the total before confirming.
          </p>

          <ul className="sv-hero-stats">
            {[`${SERVICES.length} services`, '3 live service zones', 'Upfront pricing', 'Availability checked before booking'].map((t) => (
              <li key={t} className="sv-stat">
                <span className="sv-stat-dot" />
                {t}
              </li>
            ))}
          </ul>

          <div className="sv-hero-actions">
            <Link href="/book?service=water_can" className="sv-hero-btn-primary">
              Order 20L Water
            </Link>
            <Link href="/book?service=plumbing" className="sv-hero-btn-ghost">
              Find a Plumber
            </Link>
          </div>
        </div>

        {/* Wave colour comes from CSS (--nm-bg), so hero and page surface always match */}
        <svg className="sv-wave" viewBox="0 0 1440 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path opacity="0.4" d="M0,50 C240,85 480,15 720,50 C960,85 1200,20 1440,50 L1440,100 L0,100 Z" />
          <path opacity="0.6" d="M0,65 C200,40 500,88 720,65 C940,42 1200,82 1440,65 L1440,100 L0,100 Z" />
          <path d="M0,80 C180,65 360,92 540,80 C720,68 900,88 1080,78 C1260,68 1360,84 1440,80 L1440,100 L0,100 Z" />
        </svg>
      </div>

      {/* ══ FILTER BAR ══════════════════════════════════════ */}
      <div ref={sentinelRef} className="sv-sentinel" aria-hidden="true" />
      <div className={`sv-filter-bar${scrolled ? ' scrolled' : ''}`}>
        <div className="sv-filter-inner">
          <div className="sv-filter-pills" role="group" aria-label="Filter services by category">
            {CATEGORIES.map((cat) => (
              <button key={cat} type="button" onClick={() => setFilter(cat)} aria-pressed={filter === cat} className="sv-pill">
                <span className="sv-pill-icon" aria-hidden="true">{CATEGORY_ICONS[cat]}</span>
                {cat}
              </button>
            ))}
          </div>
          <div className="sv-count" role="status" aria-live="polite">
            {filtered.length} service{filtered.length !== 1 ? 's' : ''} found
          </div>
        </div>
      </div>

      {/* ══ BODY ════════════════════════════════════════════ */}
      <div className="sv-body">
        <div className="sv-section-head">
          <div>
            <h2 className="sv-section-title">{filter === 'All' ? 'All Services' : `${filter} Services`}</h2>
            <p className="sv-section-sub">Clear starting prices · Check serviceability · Confirm scope and final price before booking</p>
          </div>
        </div>

        <div className="sv-grid">
          {filtered.map((s, i) => (
            <ServiceCard key={s.key} s={s} index={i} normalCanPrice={normalCanPrice} chilledCanPrice={chilledCanPrice} />
          ))}
        </div>

        {/* Labour and professional discovery CTA */}
        <section aria-labelledby="sv-find-help" className="sv-help">
          <div className="sv-help-main">
            <div className="sv-help-well">
              <Image
                src="/illustrations/home-technician.svg"
                alt="Home-service professional illustration"
                width={160}
                height={105}
                loading="lazy"
                sizes="160px"
                className="sv-help-img"
              />
            </div>
            <div>
              <p className="sv-help-eyebrow">Need a helping hand?</p>
              <h2 id="sv-find-help" className="sv-help-title">Find a plumber or home-service professional</h2>
              <p className="sv-help-text">
                Tell us what needs fixing, from leaking taps and RO issues to motor pumps. We&apos;ll show the booking steps and confirm local availability before the job is accepted.
              </p>
            </div>
          </div>
          <div className="sv-help-actions">
            <Link href="/book?service=plumbing" className="sv-banner-btn">
              Find a Plumber <IconArrow />
            </Link>
            <Link href="/book?service=ro_service" className="sv-pill">
              RO / Pump Service
            </Link>
          </div>
        </section>

        {/* Pricing CTA Banner */}
        <div className="sv-banner">
          <div className="sv-banner-orb" aria-hidden="true" />
          <div className="sv-banner-content">
            <div>
              <div className="sv-banner-eyebrow">Full transparency</div>
              <h2 className="sv-banner-title">
                Know the price<br />
                <span>before you book.</span>
              </h2>
              <p className="sv-banner-sub">Choose the job you need, check your address, and review the service scope and final price before confirming.</p>
            </div>
            <Link href="/pricing" className="sv-banner-btn">
              <IconDroplet />
              Explore Service Pricing
              <IconArrow />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
