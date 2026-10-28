// src/components/admin/AdminAttentionQueue.tsx
'use client';

import Link from 'next/link';
import { useMemo } from 'react';

export interface AdminAttentionData {
  unaccepted_assignments: number;
  unpaid_completed_orders: number;
  unpaid_completed_amount: number;
  active_emergencies: number;
  stale_active_orders: number;
  open_quality_cases: number;
  unaccepted_technician_offers: number;
}

type Severity = 'ok' | 'warn' | 'critical';

type AdminAttentionQueueProps = {
  attention: AdminAttentionData;
  /** Optional: shows a water-shimmer while data is loading. */
  loading?: boolean;
  className?: string;
};

/* Created once, reused on every render. */
const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const COUNT = new Intl.NumberFormat('en-IN');

/** Bad or missing numbers become 0, so the card never shows NaN. */
function safe(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function inr(value: number): string {
  return '₹' + INR.format(Math.round(value));
}

/*
 * COLORS WITH MEANING
 * calm green  = nothing to do
 * colored     = needs a look (each card keeps its own color)
 * red + pulse = act now
 */
const CARD: Record<Severity, string> = {
  ok: 'border-white/8 bg-white/[0.025]',
  warn: 'border-amber-400/25 bg-amber-400/[0.06]',
  critical: 'border-rose-400/35 bg-rose-400/[0.08]',
};

const DOT: Record<Severity, string> = {
  ok: 'bg-emerald-400/70',
  warn: 'bg-amber-400',
  critical: 'bg-rose-400 attn-pulse',
};

type Item = {
  key: string;
  label: string;
  /** Number used to decide the color. */
  count: number;
  /** Text shown big on the card. */
  display: string;
  hint: string;
  /** Text color used when there is something to look at. */
  tone: string;
  /** From this number up, the card turns red. */
  criticalAt: number;
  /** Where the admin goes to fix it. Only pages that exist. */
  href?: string;
};

function getSeverity(item: Item): Severity {
  if (item.count <= 0) return 'ok';
  return item.count >= item.criticalAt ? 'critical' : 'warn';
}

const CSS = `
  @keyframes attn-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .45; transform: scale(1.5); } }
  @keyframes attn-flow  { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  .attn-pulse { animation: attn-pulse 1.4s ease-in-out infinite; }
  .attn-skel {
    background-color: rgba(255,255,255,.06);
    background-image: linear-gradient(110deg, rgba(255,255,255,0) 30%, rgba(34,211,238,.16) 48%, rgba(96,165,250,.16) 52%, rgba(255,255,255,0) 70%);
    background-size: 200% 100%;
    animation: attn-flow 1.8s linear infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .attn-pulse, .attn-skel { animation: none !important; }
  }
`;

export default function AdminAttentionQueue({
  attention,
  loading = false,
  className = '',
}: AdminAttentionQueueProps) {
  const items = useMemo<Item[]>(() => {
    const unaccepted = safe(attention?.unaccepted_assignments);
    const unpaidOrders = safe(attention?.unpaid_completed_orders);
    const unpaidAmount = safe(attention?.unpaid_completed_amount);
    const emergencies = safe(attention?.active_emergencies);
    const stale = safe(attention?.stale_active_orders);
    const offers = safe(attention?.unaccepted_technician_offers);
    const quality = safe(attention?.open_quality_cases);

    return [
      {
        key: 'unaccepted',
        label: 'Unaccepted',
        count: unaccepted,
        display: COUNT.format(unaccepted),
        hint: 'Supplier assignment waiting',
        tone: 'text-amber-300',
        criticalAt: 5,
        href: '/admin/dispatch',
      },
      {
        key: 'unpaid-orders',
        label: 'Unpaid completed',
        count: unpaidOrders,
        display: COUNT.format(unpaidOrders),
        hint: 'Completed but payment open',
        tone: 'text-red-300',
        criticalAt: 10,
        href: '/admin/finance',
      },
      {
        key: 'unpaid-amount',
        label: 'Unpaid amount',
        count: unpaidAmount,
        display: inr(unpaidAmount),
        hint: 'Completed revenue not collected',
        tone: 'text-red-300',
        criticalAt: 10_000,
        href: '/admin/finance',
      },
      {
        key: 'emergency',
        label: 'Active emergency',
        count: emergencies,
        display: COUNT.format(emergencies),
        hint: 'Priority jobs currently active',
        tone: 'text-orange-300',
        // Any emergency is urgent.
        criticalAt: 1,
        href: '/admin/orders',
      },
      {
        key: 'stale',
        label: 'Stale jobs',
        count: stale,
        display: COUNT.format(stale),
        hint: 'Active for more than 30 min',
        tone: 'text-sky-300',
        criticalAt: 5,
        href: '/admin/orders',
      },
      {
        key: 'tech-offers',
        label: 'Tech offers',
        count: offers,
        display: COUNT.format(offers),
        hint: 'Technician offers awaiting response',
        tone: 'text-violet-300',
        criticalAt: 5,
      },
      {
        key: 'quality',
        label: 'Quality cases',
        count: quality,
        display: COUNT.format(quality),
        hint: 'Open service-quality investigations',
        tone: 'text-rose-300',
        criticalAt: 3,
      },
    ];
  }, [attention]);

  const summary = useMemo(() => {
    let critical = 0;
    let warn = 0;

    for (const item of items) {
      const level = getSeverity(item);
      if (level === 'critical') critical += 1;
      else if (level === 'warn') warn += 1;
    }

    const overall: Severity = critical > 0 ? 'critical' : warn > 0 ? 'warn' : 'ok';

    const text =
      overall === 'ok'
        ? 'All clear. Nothing needs attention right now.'
        : critical > 0
          ? `${critical} urgent ${critical === 1 ? 'item' : 'items'}${
              warn > 0 ? ` and ${warn} to review` : ''
            }.`
          : `${warn} ${warn === 1 ? 'item' : 'items'} to review.`;

    return { overall, text };
  }, [items]);

  const badge: Record<Severity, string> = {
    ok: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    warn: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
    critical: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
  };

  return (
    <section
      className={`glass rounded-2xl p-4 sm:p-5 ${className}`}
      aria-labelledby="admin-attention-title"
      aria-busy={loading}
    >
      <style>{CSS}</style>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-400">
            Operations radar
          </p>
          <h2
            id="admin-attention-title"
            className="adm-disp mt-1 text-lg font-bold text-white"
          >
            Attention Required
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Live exceptions that may affect delivery, payment or customer experience.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!loading && (
            <span
              role="status"
              aria-live="polite"
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${badge[summary.overall]}`}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${DOT[summary.overall]}`}
              />
              {summary.text}
            </span>
          )}

          <Link href="/admin/orders" className="adm-btn adm-btn-g adm-btn-sm">
            Open Order Control →
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-7">
        {items.map((item, index) => {
          if (loading) {
            return (
              <div
                key={item.key}
                aria-hidden="true"
                className={`attn-skel h-[88px] rounded-xl border border-white/8 ${
                  index === items.length - 1 ? 'col-span-2 lg:col-span-1' : ''
                }`}
              />
            );
          }

          const level = getSeverity(item);

          const body = (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {item.label}
                </p>
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[level]}`}
                />
              </div>

              <p
                className={`mt-1 text-xl font-black tabular-nums ${
                  level === 'ok' ? 'text-slate-300' : item.tone
                }`}
              >
                {item.display}
              </p>

              <p className="mt-1 text-[10px] leading-4 text-slate-500">
                {item.hint}
              </p>

              {/* Hidden text so screen readers hear the urgency too. */}
              <span className="sr-only">
                {level === 'critical'
                  ? ' Urgent.'
                  : level === 'warn'
                    ? ' Needs review.'
                    : ' No action needed.'}
              </span>
            </>
          );

          const base = `block rounded-xl border p-3.5 transition ${CARD[level]} ${
            index === items.length - 1 ? 'col-span-2 lg:col-span-1' : ''
          }`;

          return item.href ? (
            <Link
              key={item.key}
              href={item.href}
              title={`Open ${item.label}`}
              className={`${base} hover:-translate-y-0.5 hover:border-cyan-400/30 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50`}
            >
              {body}
            </Link>
          ) : (
            <div key={item.key} className={base}>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}








// 'use client';

// import Link from 'next/link';

// export interface AdminAttentionData {
//   unaccepted_assignments: number;
//   unpaid_completed_orders: number;
//   unpaid_completed_amount: number;
//   active_emergencies: number;
//   stale_active_orders: number;
//   open_quality_cases: number;
//   unaccepted_technician_offers: number;
// }

// function inr(value: number): string {
//   return '₹' + Math.round(value).toLocaleString('en-IN');
// }

// export default function AdminAttentionQueue({
//   attention,
// }: {
//   attention: AdminAttentionData;
// }) {
//   const items = [
//     ['Unaccepted', attention.unaccepted_assignments, 'Supplier assignment waiting', 'text-amber-300'],
//     ['Unpaid completed', attention.unpaid_completed_orders, 'Completed but payment open', 'text-red-300'],
//     ['Unpaid amount', inr(attention.unpaid_completed_amount), 'Completed revenue not collected', 'text-red-300'],
//     ['Active emergency', attention.active_emergencies, 'Priority jobs currently active', 'text-orange-300'],
//     ['Stale jobs', attention.stale_active_orders, 'Active for more than 30 min', 'text-sky-300'],
//     ['Tech offers', attention.unaccepted_technician_offers, 'Technician offers awaiting response', 'text-violet-300'],
//     ['Quality cases', attention.open_quality_cases, 'Open service-quality investigations', 'text-rose-300'],
//   ] as const;

//   return (
//     <section className="glass rounded-2xl p-4 sm:p-5" aria-labelledby="admin-attention-title">
//       <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
//         <div>
//           <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-400">Operations radar</p>
//           <h2 id="admin-attention-title" className="adm-disp mt-1 text-lg font-bold text-white">
//             Attention Required
//           </h2>
//           <p className="mt-1 text-xs text-slate-500">
//             Live exceptions that may affect delivery, payment or customer experience.
//           </p>
//         </div>
//         <Link href="/admin/orders" className="adm-btn adm-btn-g adm-btn-sm">
//           Open Order Control →
//         </Link>
//       </div>

//       <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-7">
//         {items.map(([label, value, hint, tone]) => (
//           <div key={label} className="rounded-xl border border-white/8 bg-white/[0.035] p-3.5">
//             <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
//             <p className={`mt-1 text-xl font-black tabular-nums ${tone}`}>{value}</p>
//             <p className="mt-1 text-[10px] leading-4 text-slate-600">{hint}</p>
//           </div>
//         ))}
//       </div>
//     </section>
//   );
// }
