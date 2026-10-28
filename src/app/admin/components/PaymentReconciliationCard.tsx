// src/components/admin/PaymentReconciliationCard.tsx
import Link from 'next/link';

export interface PaymentReconciliationData {
  order_count: number;
  gross_revenue: number;
  collected_revenue: number;
  pending_payments: number;
}

type Level = 'none' | 'good' | 'watch' | 'risk';

type PaymentReconciliationCardProps = {
  finance: PaymentReconciliationData;
  /** Optional: shows a water shimmer while data is loading. */
  loading?: boolean;
  className?: string;
};

/* Created once, reused on every render (faster than toLocaleString each time). */
const MONEY = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const COUNT = new Intl.NumberFormat('en-IN');

/** Bad or missing numbers become 0, so the card never shows NaN. */
function safe(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function inr(value: number): string {
  return '₹' + MONEY.format(Math.round(value));
}

/*
 * COLORS WITH MEANING
 * green = healthy collection, amber = keep an eye, rose = act now
 * Example: collected ₹90,000 of ₹100,000 gross = 90% = green.
 */
const LEVEL = {
  none: {
    badge: 'border-white/10 bg-white/5 text-slate-300',
    dot: 'bg-slate-400',
    bar: 'from-slate-400/40 to-slate-400/40',
    pending: 'text-slate-300',
    card: 'border-white/8 bg-white/[0.035]',
  },
  good: {
    badge: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    dot: 'bg-emerald-400',
    bar: 'from-emerald-400 to-cyan-400',
    pending: 'text-amber-300',
    card: 'border-white/8 bg-white/[0.035]',
  },
  watch: {
    badge: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
    dot: 'bg-amber-400',
    bar: 'from-amber-400 to-cyan-400',
    pending: 'text-amber-300',
    card: 'border-amber-400/25 bg-amber-400/[0.06]',
  },
  risk: {
    badge: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
    dot: 'bg-rose-400',
    bar: 'from-rose-400 to-amber-400',
    pending: 'text-rose-300',
    card: 'border-rose-400/35 bg-rose-400/[0.08]',
  },
} as const;

function getLevel(gross: number, ratePct: number): Level {
  if (gross <= 0) return 'none';
  if (ratePct >= 90) return 'good';
  if (ratePct >= 70) return 'watch';
  return 'risk';
}

const CSS = `
  @keyframes prc-flow  { 0% { transform: translate3d(-100%,0,0); } 100% { transform: translate3d(250%,0,0); } }
  @keyframes prc-shim  { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  .prc-flow { animation: prc-flow 2.2s linear infinite; will-change: transform; }
  .prc-skel {
    background-color: rgba(255,255,255,.06);
    background-image: linear-gradient(110deg, rgba(255,255,255,0) 30%, rgba(34,211,238,.16) 48%, rgba(96,165,250,.16) 52%, rgba(255,255,255,0) 70%);
    background-size: 200% 100%;
    animation: prc-shim 1.8s linear infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .prc-flow, .prc-skel { animation: none !important; }
  }
`;

export default function PaymentReconciliationCard({
  finance,
  loading = false,
  className = '',
}: PaymentReconciliationCardProps) {
  const orders = safe(finance?.order_count);
  const gross = safe(finance?.gross_revenue);
  const collected = safe(finance?.collected_revenue);
  const pending = safe(finance?.pending_payments);

  // Share of gross money already collected. Never below 0 or above 100.
  const ratePct = gross > 0 ? Math.min(100, Math.max(0, (collected / gross) * 100)) : 0;
  const rateLabel = gross > 0 ? `${Math.round(ratePct)}%` : '—';

  const level = getLevel(gross, ratePct);
  const tone = LEVEL[level];

  const summary =
    level === 'none'
      ? 'No revenue in this window yet.'
      : pending <= 0
        ? 'Everything is collected.'
        : `${rateLabel} collected · ${inr(pending)} still open`;

  const metrics = [
    {
      label: 'Completed orders',
      value: COUNT.format(orders),
      tone: 'text-white',
      card: 'border-white/8 bg-white/[0.035]',
    },
    {
      label: 'Gross',
      value: inr(gross),
      tone: 'text-emerald-300',
      card: 'border-white/8 bg-white/[0.035]',
    },
    {
      label: 'Collected',
      value: inr(collected),
      tone: 'text-cyan-300',
      card: 'border-white/8 bg-white/[0.035]',
    },
    {
      label: 'Pending',
      value: inr(pending),
      // Calm grey when nothing is pending, colored when money is waiting.
      tone: pending > 0 ? tone.pending : 'text-slate-300',
      card: pending > 0 ? tone.card : 'border-white/8 bg-white/[0.035]',
    },
  ];

  return (
    <section
      className={`glass rounded-2xl p-6 ${className}`}
      aria-labelledby="payment-reconciliation-title"
      aria-busy={loading}
    >
      <style>{CSS}</style>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">
            30-day collection control
          </p>
          <h2
            id="payment-reconciliation-title"
            className="adm-disp mt-1 text-base font-bold text-white"
          >
            Payment Reconciliation
          </h2>
        </div>

        <Link
          href="/admin/orders?payment_status=unpaid"
          className="text-xs font-semibold text-sky-400 transition hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
        >
          Review unpaid orders →
        </Link>
      </div>

      {/* Collection progress: water filling a tank */}
      <div className="mt-5">
        {loading ? (
          <div aria-hidden="true" className="prc-skel h-12 rounded-xl border border-white/8" />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                role="status"
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${tone.badge}`}
              >
                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                {summary}
              </span>

              <span className="text-xs font-semibold tabular-nums text-slate-300">
                Collection rate {rateLabel}
              </span>
            </div>

            <div
              role="progressbar"
              aria-label="Collection rate"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(ratePct)}
              className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10"
            >
              <div
                className={`relative h-full overflow-hidden rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out ${tone.bar}`}
                style={{ width: `${ratePct}%` }}
              >
                {/* Light flowing through the water */}
                {ratePct > 0 && ratePct < 100 && (
                  <span
                    aria-hidden="true"
                    className="prc-flow absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((metric) =>
          loading ? (
            <div
              key={metric.label}
              aria-hidden="true"
              className="prc-skel h-[72px] rounded-xl border border-white/8"
            />
          ) : (
            <div
              key={metric.label}
              className={`rounded-xl border p-3.5 transition ${metric.card}`}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {metric.label}
              </p>
              <p
                className={`mt-1 truncate text-lg font-black tabular-nums ${metric.tone}`}
                title={metric.value}
              >
                {metric.value}
              </p>
            </div>
          ),
        )}
      </div>
    </section>
  );
}









// import Link from 'next/link';

// export interface PaymentReconciliationData {
//   order_count: number;
//   gross_revenue: number;
//   collected_revenue: number;
//   pending_payments: number;
// }

// function inr(value: number): string {
//   return '₹' + Math.round(value).toLocaleString('en-IN');
// }

// export default function PaymentReconciliationCard({
//   finance,
// }: {
//   finance: PaymentReconciliationData;
// }) {
//   const metrics = [
//     ['Completed orders', finance.order_count, 'text-white'],
//     ['Gross', inr(finance.gross_revenue), 'text-emerald-300'],
//     ['Collected', inr(finance.collected_revenue), 'text-cyan-300'],
//     ['Pending', inr(finance.pending_payments), 'text-amber-300'],
//   ] as const;

//   return (
//     <section className="glass rounded-2xl p-6" aria-labelledby="payment-reconciliation-title">
//       <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
//         <div>
//           <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">30-day collection control</p>
//           <h2 id="payment-reconciliation-title" className="adm-disp mt-1 text-base font-bold text-white">
//             Payment Reconciliation
//           </h2>
//         </div>
//         <Link
//           href="/admin/orders?payment_status=unpaid"
//           className="text-xs font-semibold text-sky-400 hover:text-sky-300"
//         >
//           Review unpaid orders →
//         </Link>
//       </div>

//       <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
//         {metrics.map(([label, value, tone]) => (
//           <div key={label} className="rounded-xl border border-white/8 bg-white/[0.035] p-3.5">
//             <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
//             <p className={`mt-1 text-lg font-black tabular-nums ${tone}`}>{value}</p>
//           </div>
//         ))}
//       </div>
//     </section>
//   );
// }
