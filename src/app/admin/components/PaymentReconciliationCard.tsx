import Link from 'next/link';

export interface PaymentReconciliationData {
  order_count: number;
  gross_revenue: number;
  collected_revenue: number;
  pending_payments: number;
}

function inr(value: number): string {
  return '₹' + Math.round(value).toLocaleString('en-IN');
}

export default function PaymentReconciliationCard({
  finance,
}: {
  finance: PaymentReconciliationData;
}) {
  const metrics = [
    ['Completed orders', finance.order_count, 'text-white'],
    ['Gross', inr(finance.gross_revenue), 'text-emerald-300'],
    ['Collected', inr(finance.collected_revenue), 'text-cyan-300'],
    ['Pending', inr(finance.pending_payments), 'text-amber-300'],
  ] as const;

  return (
    <section className="glass rounded-2xl p-6" aria-labelledby="payment-reconciliation-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">30-day collection control</p>
          <h2 id="payment-reconciliation-title" className="adm-disp mt-1 text-base font-bold text-white">
            Payment Reconciliation
          </h2>
        </div>
        <Link
          href="/admin/orders?payment_status=unpaid"
          className="text-xs font-semibold text-sky-400 hover:text-sky-300"
        >
          Review unpaid orders →
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map(([label, value, tone]) => (
          <div key={label} className="rounded-xl border border-white/8 bg-white/[0.035] p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
            <p className={`mt-1 text-lg font-black tabular-nums ${tone}`}>{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
