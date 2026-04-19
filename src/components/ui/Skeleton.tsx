'use client';

/**
 * AuroWater — Skeleton UI Components
 * Place at: src/components/ui/Skeleton.tsx
 *
 * Full set of skeleton loaders matching the platform design system:
 * • Colors: #EFF6FF → #DBEAFE shimmer (matches blue/water theme)
 * • Syne 900 + DM Sans font awareness (block heights match real typography)
 * • Every major layout pattern covered: cards, stats, orders, profile, nav
 * • All components are zero-dependency, SSR-safe, accessible (aria-hidden)
 * • Tree-shakeable named exports — import only what you need
 */

import React from 'react';

/* ─────────────────────────────────────────────
   SHARED KEYFRAME INJECTION (once, globally)
───────────────────────────────────────────── */
const STYLE_ID = 'aw-skeleton-styles';

function injectStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
    @keyframes awShimmer {
      0%   { background-position: -600px 0; }
      100% { background-position:  600px 0; }
    }
    @keyframes awPulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.45; }
    }
    @keyframes awWave {
      0%        { transform: translateX(-100%); }
      100%      { transform: translateX(100%); }
    }
    .aw-sk-base {
      background: linear-gradient(
        90deg,
        #EFF6FF 0%,
        #DBEAFE 25%,
        #BFDBFE 50%,
        #DBEAFE 75%,
        #EFF6FF 100%
      );
      background-size: 1200px 100%;
      animation: awShimmer 1.8s ease-in-out infinite;
      border-radius: 8px;
      flex-shrink: 0;
    }
    .aw-sk-pulse {
      background: #EFF6FF;
      animation: awPulse 1.8s ease-in-out infinite;
      border-radius: 8px;
      flex-shrink: 0;
    }
    .aw-sk-wave {
      background: #EFF6FF;
      overflow: hidden;
      position: relative;
      border-radius: 8px;
      flex-shrink: 0;
    }
    .aw-sk-wave::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent 0%, rgba(219,234,254,0.9) 50%, transparent 100%);
      animation: awWave 1.8s ease-in-out infinite;
    }
  `;
  document.head.appendChild(el);
}

if (typeof window !== 'undefined') injectStyles();

/* ─────────────────────────────────────────────
   BASE PRIMITIVE
───────────────────────────────────────────── */
export type SkeletonVariant = 'shimmer' | 'pulse' | 'wave';

interface BaseProps {
  width?:   number | string;
  height?:  number | string;
  radius?:  number | string;
  variant?: SkeletonVariant;
  style?:   React.CSSProperties;
  className?: string;
}

function cls(variant: SkeletonVariant = 'shimmer'): string {
  return variant === 'pulse' ? 'aw-sk-pulse' : variant === 'wave' ? 'aw-sk-wave' : 'aw-sk-base';
}

/**
 * Primitive skeleton block — the building block for all other skeletons.
 */
export function SkeletonBox({
  width = '100%', height = 16, radius = 8,
  variant = 'shimmer', style, className = '',
}: BaseProps) {
  return (
    <div
      aria-hidden="true"
      className={`${cls(variant)} ${className}`}
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

/* ─────────────────────────────────────────────
   TYPOGRAPHY SKELETONS
   Heights match Syne 900 headings and DM Sans body exactly
───────────────────────────────────────────── */

/** Matches a Syne 900 display heading (clamp ~2rem) */
export function SkeletonHeading({
  width = '60%', variant = 'shimmer', className = '',
}: { width?: number | string; variant?: SkeletonVariant; className?: string }) {
  return <SkeletonBox width={width} height={28} radius={7} variant={variant} className={className} />;
}

/** Matches a Syne 900 sub-heading (~0.9–1.1rem) */
export function SkeletonSubheading({
  width = '45%', variant = 'shimmer', className = '',
}: { width?: number | string; variant?: SkeletonVariant; className?: string }) {
  return <SkeletonBox width={width} height={18} radius={6} variant={variant} className={className} />;
}

/** Single line of DM Sans body copy (~13–14px) */
export function SkeletonText({
  width = '80%', variant = 'shimmer', className = '',
}: { width?: number | string; variant?: SkeletonVariant; className?: string }) {
  return <SkeletonBox width={width} height={13} radius={5} variant={variant} className={className} />;
}

/** Multi-line paragraph block */
export function SkeletonParagraph({
  lines = 3, variant = 'shimmer', className = '',
}: { lines?: number; variant?: SkeletonVariant; className?: string }) {
  const widths = ['100%', '85%', '70%', '90%', '60%', '80%'];
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox
          key={i}
          width={widths[i % widths.length]}
          height={13}
          radius={5}
          variant={variant}
        />
      ))}
    </div>
  );
}

/** Eyebrow label pill (10px uppercase) */
export function SkeletonEyebrow({
  width = 120, variant = 'shimmer', className = '',
}: { width?: number | string; variant?: SkeletonVariant; className?: string }) {
  return <SkeletonBox width={width} height={22} radius={99} variant={variant} className={className} />;
}

/** Badge / chip */
export function SkeletonBadge({
  width = 72, variant = 'shimmer', className = '',
}: { width?: number | string; variant?: SkeletonVariant; className?: string }) {
  return <SkeletonBox width={width} height={20} radius={99} variant={variant} className={className} />;
}

/* ─────────────────────────────────────────────
   AVATAR / ICON SKELETONS
───────────────────────────────────────────── */

/** Circular avatar */
export function SkeletonAvatar({
  size = 40, variant = 'shimmer', className = '', style,
}: { size?: number; variant?: SkeletonVariant; className?: string; style?: React.CSSProperties }) {
  return <SkeletonBox width={size} height={size} radius="50%" variant={variant} className={className} style={style} />;
}

/** Rounded-square avatar (used in sidebar user card) */
export function SkeletonAvatarSquare({
  size = 40, radius = 12, variant = 'shimmer', className = '', style,
}: { size?: number; radius?: number; variant?: SkeletonVariant; className?: string; style?: React.CSSProperties }) {
  return <SkeletonBox width={size} height={size} radius={radius} variant={variant} className={className} style={style} />;
}

/** Emoji / service icon block */
export function SkeletonIcon({
  size = 40, radius = 11, variant = 'shimmer', className = '',
}: { size?: number; radius?: number; variant?: SkeletonVariant; className?: string }) {
  return <SkeletonBox width={size} height={size} radius={radius} variant={variant} className={className} />;
}

/* ─────────────────────────────────────────────
   BUTTON SKELETONS
───────────────────────────────────────────── */
export function SkeletonButton({
  width = 110, height = 38, variant = 'shimmer', className = '',
}: { width?: number | string; height?: number; variant?: SkeletonVariant; className?: string }) {
  return <SkeletonBox width={width} height={height} radius={11} variant={variant} className={className} />;
}

export function SkeletonButtonSm({
  width = 80, variant = 'shimmer', className = '',
}: { width?: number | string; variant?: SkeletonVariant; className?: string }) {
  return <SkeletonBox width={width} height={30} radius={9} variant={variant} className={className} />;
}

/* ─────────────────────────────────────────────
   INPUT / FORM SKELETONS
───────────────────────────────────────────── */
export function SkeletonInput({
  width = '100%', variant = 'shimmer', className = '',
}: { width?: number | string; variant?: SkeletonVariant; className?: string }) {
  return <SkeletonBox width={width} height={42} radius={11} variant={variant} className={className} />;
}

export function SkeletonFormField({
  labelWidth = 100, variant = 'shimmer', className = '',
}: { labelWidth?: number | string; variant?: SkeletonVariant; className?: string }) {
  return (
    <div aria-hidden="true" className={className} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SkeletonBox width={labelWidth} height={10} radius={4} variant={variant} />
      <SkeletonInput variant={variant} />
    </div>
  );
}

/* ─────────────────────────────────────────────
   STAT / KPI SKELETONS
   Matches the ch-stat-strip and d-stat grid patterns
───────────────────────────────────────────── */

/** Single KPI card skeleton (matches d-stat / ch-stat-item) */
export function SkeletonStatCard({
  variant = 'shimmer', className = '',
}: { variant?: SkeletonVariant; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        background: '#fff', borderRadius: 18, border: '1px solid #DBEAFE',
        padding: '18px 20px', overflow: 'hidden', position: 'relative',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <SkeletonBox width={40}  height={10} radius={4} variant={variant} style={{ marginBottom: 10 }} />
      <SkeletonBox width="65%" height={28} radius={7} variant={variant} style={{ marginBottom: 8 }} />
      <SkeletonBox width="45%" height={10} radius={4} variant={variant} />
      {/* Bottom bar accent */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2.5, background: '#EFF6FF' }} />
    </div>
  );
}

/** 4-column KPI grid */
export function SkeletonStatGrid({
  cols = 4, variant = 'shimmer', className = '',
}: { cols?: 2 | 3 | 4; variant?: SkeletonVariant; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 14,
      }}
    >
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonStatCard key={i} variant={variant} />
      ))}
    </div>
  );
}

/** Horizontal stat strip (matches ch-stat-strip) */
export function SkeletonStatStrip({
  cols = 4, variant = 'shimmer', className = '',
}: { cols?: number; variant?: SkeletonVariant; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        background: '#fff', borderRadius: 16, border: '1px solid #DBEAFE',
        overflow: 'hidden',
      }}
    >
      {Array.from({ length: cols }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: '14px 16px', textAlign: 'center',
            borderRight: i < cols - 1 ? '1px solid #EEF5FF' : 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          }}
        >
          <SkeletonBox width={22} height={22} radius={6} variant={variant} />
          <SkeletonBox width="55%" height={22} radius={5} variant={variant} />
          <SkeletonBox width="65%" height={9}  radius={4} variant={variant} />
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   CARD SKELETONS
───────────────────────────────────────────── */

/** Generic card shell */
export function SkeletonCard({
  height = 160, radius = 18, variant = 'shimmer', className = '',
}: { height?: number | string; radius?: number; variant?: SkeletonVariant; className?: string }) {
  return (
    <SkeletonBox
      width="100%"
      height={height}
      radius={radius}
      variant={variant}
      className={className}
    />
  );
}

/** Order row skeleton (matches ch-order-row / d-order) */
export function SkeletonOrderRow({
  variant = 'shimmer', className = '',
}: { variant?: SkeletonVariant; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', borderBottom: '1px solid #F0F6FF',
      }}
    >
      <SkeletonIcon size={40} radius={11} variant={variant} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <SkeletonBox width="55%" height={13} radius={5} variant={variant} />
        <SkeletonBox width="38%" height={10} radius={4} variant={variant} />
      </div>
      <SkeletonBadge width={68} variant={variant} />
      <SkeletonBox width={52} height={13} radius={5} variant={variant} />
    </div>
  );
}

/** Active order card skeleton */
export function SkeletonActiveOrder({
  variant = 'shimmer', className = '',
}: { variant?: SkeletonVariant; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        background: '#fff', borderRadius: 16, border: '1px solid #DBEAFE',
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
        <SkeletonIcon size={44} radius={13} variant={variant} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <SkeletonBadge width={44} variant={variant} />
            <SkeletonBox width={120} height={16} radius={5} variant={variant} />
            <SkeletonBadge width={68} variant={variant} />
          </div>
          <SkeletonBox width="40%" height={10} radius={4} variant={variant} />
          <SkeletonBox width={60} height={18} radius={6} variant={variant} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <SkeletonButton width={72} height={32} variant={variant} />
          <SkeletonButton width={62} height={32} variant={variant} />
        </div>
      </div>
    </div>
  );
}

/** Dark navy hero/welcome card skeleton */
export function SkeletonWelcomeCard({
  variant = 'shimmer', className = '',
}: { variant?: SkeletonVariant; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        background: 'linear-gradient(145deg,#0D1F45,#1A3A8F)',
        borderRadius: 20, padding: 26, marginBottom: 18,
        border: '1px solid rgba(96,165,250,0.18)',
      }}
    >
      <SkeletonBox
        width={140} height={22} radius={99} variant={variant}
        style={{ background: 'rgba(255,255,255,0.1)', backgroundSize:'1200px 100%', marginBottom: 14 }}
      />
      <SkeletonBox
        width="70%" height={24} radius={7} variant={variant}
        style={{ background: 'rgba(255,255,255,0.1)', backgroundSize:'1200px 100%', marginBottom: 8 }}
      />
      <SkeletonBox
        width="50%" height={24} radius={7} variant={variant}
        style={{ background: 'rgba(255,255,255,0.1)', backgroundSize:'1200px 100%', marginBottom: 20 }}
      />
      <SkeletonBox
        width="65%" height={12} radius={5} variant={variant}
        style={{ background: 'rgba(255,255,255,0.07)', backgroundSize:'1200px 100%', marginBottom: 20 }}
      />
      <div style={{ display: 'flex', gap: 10 }}>
        <SkeletonBox width={130} height={40} radius={12} variant={variant} style={{ background: 'rgba(255,255,255,0.12)', backgroundSize:'1200px 100%' }} />
        <SkeletonBox width={110} height={40} radius={12} variant={variant} style={{ background: 'rgba(255,255,255,0.07)', backgroundSize:'1200px 100%' }} />
      </div>
    </div>
  );
}

/** Service grid skeleton (6 cards) */
export function SkeletonServiceGrid({
  cols = 6, items = 6, variant = 'shimmer', className = '',
}: { cols?: number; items?: number; variant?: SkeletonVariant; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10 }}
    >
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          style={{
            background: '#fff', borderRadius: 14, border: '1px solid #DBEAFE',
            padding: '14px 8px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 7,
          }}
        >
          <SkeletonBox width={36} height={36} radius={10} variant={variant} />
          <SkeletonBox width="70%" height={10} radius={4} variant={variant} />
          <SkeletonBox width="50%" height={9}  radius={4} variant={variant} />
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   TABLE SKELETONS
───────────────────────────────────────────── */

/** Admin / finance table skeleton */
export function SkeletonTable({
  rows = 6, cols = 5, variant = 'shimmer', className = '',
}: { rows?: number; cols?: number; variant?: SkeletonVariant; className?: string }) {
  const colWidths = ['80px','130px','90px','70px','70px','60px','70px','80px'];
  return (
    <div aria-hidden="true" className={className} style={{ overflowX: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 16, padding: '10px 16px', background: '#F8FAFF', borderBottom: '1px solid #EEF5FF' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBox key={i} width={colWidths[i % colWidths.length]} height={10} radius={4} variant={variant} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: 16, padding: '13px 16px', borderBottom: '1px solid #F0F6FF', alignItems: 'center' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonBox
              key={c}
              width={colWidths[c % colWidths.length]}
              height={c === 0 ? 16 : 12}
              radius={c === cols - 1 ? 99 : 5}
              variant={variant}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   CHART SKELETONS
───────────────────────────────────────────── */

/** Area / line chart placeholder */
export function SkeletonChart({
  height = 210, variant = 'shimmer', className = '',
}: { height?: number; variant?: SkeletonVariant; className?: string }) {
  return (
    <div aria-hidden="true" className={className} style={{ width: '100%', height, position: 'relative' }}>
      {/* Fake Y-axis labels */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 24, width: 36, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px 0' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBox key={i} width={28} height={9} radius={3} variant={variant} />
        ))}
      </div>
      {/* Fake chart area */}
      <div style={{ position: 'absolute', left: 44, right: 0, top: 0, bottom: 24 }}>
        <SkeletonBox width="100%" height="100%" radius={10} variant={variant} style={{ opacity: 0.6 }} />
        {/* Fake bars/waves suggestion */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 4, padding: '0 8px 8px' }}>
          {[65,82,48,95,70,88,55,78,90,62,85,73].map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h}%`, background: 'rgba(37,99,235,0.08)', borderRadius: '4px 4px 0 0' }} />
          ))}
        </div>
      </div>
      {/* Fake X-axis labels */}
      <div style={{ position: 'absolute', left: 44, right: 0, bottom: 0, height: 20, display: 'flex', justifyContent: 'space-between' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBox key={i} width={28} height={9} radius={3} variant={variant} />
        ))}
      </div>
    </div>
  );
}

/** Bar chart placeholder */
export function SkeletonBarChart({
  bars = 6, height = 200, variant = 'shimmer', className = '',
}: { bars?: number; height?: number; variant?: SkeletonVariant; className?: string }) {
  const bh = [55,80,42,90,65,78,50,88];
  return (
    <div aria-hidden="true" className={className} style={{ width: '100%', height, display: 'flex', alignItems: 'flex-end', gap: 8, padding: '0 4px 24px' }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
          <SkeletonBox width="100%" height={`${bh[i % bh.length]}%`} radius={6} variant={variant} />
          <SkeletonBox width="70%" height={9} radius={3} variant={variant} />
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   PROFILE / SETTINGS SKELETONS
───────────────────────────────────────────── */

/** Profile hero (cover + avatar) */
export function SkeletonProfileHero({
  variant = 'shimmer', className = '',
}: { variant?: SkeletonVariant; className?: string }) {
  return (
    <div aria-hidden="true" className={className} style={{ background: '#fff', borderRadius: 18, border: '1px solid #DBEAFE', overflow: 'hidden' }}>
      {/* Cover */}
      <div style={{ height: 100, background: 'linear-gradient(135deg,#0D1F45,#1A3A8F)' }} />
      {/* Avatar + name */}
      <div style={{ padding: '0 22px 22px', marginTop: -40 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <SkeletonAvatarSquare size={76} radius={18} variant={variant}
            style={{ border: '4px solid #fff', boxShadow: '0 4px 14px rgba(37,99,235,0.12)' }} />
          <SkeletonButton width={110} height={34} variant={variant} />
        </div>
        <SkeletonBox width="45%" height={22} radius={6} variant={variant} style={{ marginBottom: 8 }} />
        <SkeletonBox width="35%" height={12} radius={4} variant={variant} style={{ marginBottom: 10 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <SkeletonBadge width={72} variant={variant} />
          <SkeletonBadge width={88} variant={variant} />
        </div>
      </div>
    </div>
  );
}

/** Settings field rows */
export function SkeletonSettingsSection({
  fields = 4, variant = 'shimmer', className = '',
}: { fields?: number; variant?: SkeletonVariant; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
    >
      {Array.from({ length: fields }).map((_, i) => (
        <SkeletonFormField key={i} labelWidth={100 + (i % 3) * 20} variant={variant} />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   NOTIFICATION SKELETON
───────────────────────────────────────────── */
export function SkeletonNotification({
  variant = 'shimmer', className = '',
}: { variant?: SkeletonVariant; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{ display: 'flex', alignItems: 'flex-start', gap: 13, padding: '14px 16px', borderBottom: '1px solid #EEF5FF' }}
    >
      <SkeletonIcon size={40} radius={12} variant={variant} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <SkeletonBox width="55%" height={13} radius={5} variant={variant} />
          <SkeletonBadge width={56} variant={variant} />
        </div>
        <SkeletonBox width="80%" height={11} radius={4} variant={variant} />
        <SkeletonBox width="30%" height={9}  radius={3} variant={variant} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ACTIVITY LOG SKELETON
───────────────────────────────────────────── */
export function SkeletonActivityRow({
  variant = 'shimmer', className = '',
}: { variant?: SkeletonVariant; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{ display: 'flex', gap: 14, paddingBottom: 18, position: 'relative' }}
    >
      {/* Timeline dot */}
      <SkeletonBox width={28} height={28} radius="50%" variant={variant} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <SkeletonBox width="55%" height={13} radius={5} variant={variant} />
          <SkeletonBox width={60}  height={10} radius={4} variant={variant} />
        </div>
        <SkeletonBox width="40%" height={10} radius={4} variant={variant} />
        <SkeletonBox width="25%" height={9}  radius={3} variant={variant} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SIDEBAR SKELETON
───────────────────────────────────────────── */
export function SkeletonSidebar({
  variant = 'shimmer', className = '',
}: { variant?: SkeletonVariant; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        width: 256, minHeight: '100vh',
        background: 'linear-gradient(180deg,#0A1628,#1A3A8F)',
        padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 0,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }}>
        <SkeletonBox width={38} height={38} radius={11} variant={variant} style={{ background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <SkeletonBox width={80}  height={13} radius={5} variant={variant} style={{ background: 'rgba(255,255,255,0.15)' }} />
          <SkeletonBox width={60}  height={9}  radius={3} variant={variant} style={{ background: 'rgba(255,255,255,0.08)' }} />
        </div>
      </div>
      {/* User card */}
      <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 16, padding: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <SkeletonAvatarSquare size={38} radius={11} variant={variant} style={{ background: 'rgba(255,255,255,0.15)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
            <SkeletonBox width="70%" height={12} radius={4} variant={variant} style={{ background: 'rgba(255,255,255,0.15)' }} />
            <SkeletonBox width="55%" height={10} radius={3} variant={variant} style={{ background: 'rgba(255,255,255,0.08)' }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <SkeletonBox width={60} height={18} radius={99} variant={variant} style={{ background: 'rgba(255,255,255,0.1)' }} />
          <SkeletonBox width={55} height={10} radius={3}  variant={variant} style={{ background: 'rgba(255,255,255,0.07)' }} />
        </div>
      </div>
      {/* Nav links */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 11 }}>
            <SkeletonBox width={16} height={16} radius={4} variant={variant} style={{ background: 'rgba(255,255,255,0.1)' }} />
            <SkeletonBox width={`${50 + (i * 11) % 40}%`} height={12} radius={4} variant={variant} style={{ background: 'rgba(255,255,255,0.1)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TOPBAR SKELETON
───────────────────────────────────────────── */
export function SkeletonTopbar({
  variant = 'shimmer', className = '',
}: { variant?: SkeletonVariant; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        height: 58, background: 'rgba(240,246,255,0.95)',
        borderBottom: '1px solid #DBEAFE',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <SkeletonBox width={28} height={28} radius={9} variant={variant} />
        <SkeletonBox width={90} height={12} radius={5} variant={variant} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SkeletonBadge width={80}  variant={variant} />
        <SkeletonBox  width={34}   height={34} radius={10} variant={variant} />
        <SkeletonBox  width={34}   height={34} radius={10} variant={variant} />
        <SkeletonAvatarSquare size={34} radius={10} variant={variant} />
        <SkeletonButton width={72} height={32} variant={variant} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE-LEVEL COMPOSITES
   Drop-in skeletons for entire page layouts
───────────────────────────────────────────── */

/** Full dashboard overview skeleton */
export function SkeletonDashboard({
  variant = 'shimmer',
}: { variant?: SkeletonVariant }) {
  return (
    <div aria-hidden="true" style={{ fontFamily: "'DM Sans',sans-serif", minHeight: '100vh', background: '#F0F6FF' }}>
      <SkeletonTopbar variant={variant} />
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '22px 20px 80px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <SkeletonWelcomeCard variant={variant} />
        <SkeletonStatStrip cols={4} variant={variant} />
        <div>
          <SkeletonBox width={100} height={10} radius={4} variant={variant} style={{ marginBottom: 10 }} />
          <SkeletonServiceGrid cols={6} items={6} variant={variant} />
        </div>
        <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #DBEAFE', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #EEF5FF', display: 'flex', justifyContent: 'space-between' }}>
            <SkeletonBox width={110} height={14} radius={5} variant={variant} />
            <SkeletonBox width={60}  height={12} radius={5} variant={variant} />
          </div>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonOrderRow key={i} variant={variant} />)}
        </div>
      </div>
    </div>
  );
}

/** Admin finance page skeleton */
export function SkeletonFinancePage({
  variant = 'shimmer',
}: { variant?: SkeletonVariant }) {
  return (
    <div aria-hidden="true" style={{ minHeight: '100vh', background: '#F0F6FF' }}>
      <div style={{ background: 'linear-gradient(150deg,#0A1628,#1E3A8A)', padding: '20px 28px' }}>
        <SkeletonBox width={180} height={20} radius={6} variant={variant} style={{ background: 'rgba(255,255,255,0.15)', backgroundSize:'1200px 100%' }} />
      </div>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 24px 56px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SkeletonStatGrid cols={4} variant={variant} />
        <SkeletonStatGrid cols={4} variant={variant} />
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
          <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #DBEAFE', padding: 20 }}>
            <SkeletonBox width={120} height={14} radius={5} variant={variant} style={{ marginBottom: 16 }} />
            <SkeletonChart height={210} variant={variant} />
          </div>
          <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #DBEAFE', padding: 20 }}>
            <SkeletonBox width={120} height={14} radius={5} variant={variant} style={{ marginBottom: 16 }} />
            <SkeletonBarChart bars={5} height={200} variant={variant} />
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #DBEAFE', overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid #EEF5FF' }}>
            <SkeletonBox width={180} height={14} radius={5} variant={variant} />
          </div>
          <SkeletonTable rows={7} cols={6} variant={variant} />
        </div>
      </div>
    </div>
  );
}

/** Pricing page skeleton */
export function SkeletonPricingPage({
  variant = 'shimmer',
}: { variant?: SkeletonVariant }) {
  return (
    <div aria-hidden="true" style={{ minHeight: '100vh', background: '#F0F6FF' }}>
      <div style={{ background: 'linear-gradient(150deg,#0A1628,#1E3A8A,#1D4ED8)', padding: '64px 24px 80px', textAlign: 'center' }}>
        <SkeletonBox width={160} height={24} radius={99} variant={variant} style={{ background:'rgba(255,255,255,0.12)', backgroundSize:'1200px 100%', margin:'0 auto 16px' }} />
        <SkeletonBox width="50%" height={32} radius={8}  variant={variant} style={{ background:'rgba(255,255,255,0.12)', backgroundSize:'1200px 100%', margin:'0 auto 10px' }} />
        <SkeletonBox width="35%" height={22} radius={7}  variant={variant} style={{ background:'rgba(255,255,255,0.08)', backgroundSize:'1200px 100%', margin:'0 auto 20px' }} />
        <SkeletonBox width="40%" height={13} radius={5}  variant={variant} style={{ background:'rgba(255,255,255,0.07)', backgroundSize:'1200px 100%', margin:'0 auto' }} />
      </div>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '40px 24px 80px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <SkeletonBox width={160} height={36} radius={11} variant={variant} />
          <SkeletonBox width={160} height={36} radius={11} variant={variant} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} height={340} radius={22} variant={variant} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} height={72} radius={16} variant={variant} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   CONVENIENCE RE-EXPORT: legacy API aliases
   Keeps existing imports (SkeletonCard, SkeletonText, SkeletonAvatar) working
───────────────────────────────────────────── */

// These match the original component signatures exactly:
export const SkeletonCardLegacy = ({
  className = '',
}: { className?: string }) => (
  <SkeletonCard
    className={className}
    height={120}
    radius={16}
    variant="shimmer"
  />
);

export const SkeletonTextLegacy = ({
  className = '',
}: { className?: string }) => (
  <SkeletonText
    className={className}
    variant="shimmer"
  />
);

export const SkeletonAvatarLegacy = ({
  className = '',
}: { className?: string }) => (
  <SkeletonAvatar
    size={40}
    className={className}
    variant="shimmer"
  />
);