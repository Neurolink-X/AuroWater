'use client';

import Link from 'next/link';

export interface AdminAttentionData {
  unaccepted_assignments: number;
  unpaid_completed_orders: number;
  unpaid_completed_amount: number;
  active_emergencies: number;
  stale_active_orders: number;
}

function inr(value: number): string {
  return '₹' + Math.round(value).toLocaleString('en-IN');
}

export default function AdminAttentionQueue({
  attention,
}: {
  attention: AdminAttentionData;
}) {
  const items = [
    ['Unaccepted', attention.unaccepted_assignments, 'Supplier assignment waiting', 'text-amber-300'],
    ['Unpaid completed', attention.unpaid_completed_orders, 'Completed but payment open', 'text-red-300'],
    ['Unpaid amount', inr(attention.unpaid_completed_amount), 'Completed revenue not collected', 'text-red-300'],
    ['Active emergency', attention.active_emergencies, 'Priority jobs currently active', 'text-orange-300'],
    ['Stale jobs', attention.stale_active_orders, 'Active for more than 30 min', 'text-sky-300'],
  ] as const;

  return (
    <section className="glass rounded-2xl p-4 sm:p-5" aria-labelledby="admin-attention-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-400">Operations radar</p>
          <h2 id="admin-attention-title" className="adm-disp mt-1 text-lg font-bold text-white">
            Attention Required
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Live exceptions that may affect delivery, payment or customer experience.
          </p>
        </div>
        <Link href="/admin/orders" className="adm-btn adm-btn-g adm-btn-sm">
          Open Order Control →
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {items.map(([label, value, hint, tone]) => (
          <div key={label} className="rounded-xl border border-white/8 bg-white/[0.035] p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
            <p className={`mt-1 text-xl font-black tabular-nums ${tone}`}>{value}</p>
            <p className="mt-1 text-[10px] leading-4 text-slate-600">{hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
