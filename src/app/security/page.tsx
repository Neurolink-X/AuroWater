import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta(
  'Security | AuroWater',
  'How AuroWater protects your data — encryption, row-level security, and how to report a bug.',
  '/security'
);

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-slate-800">
      <h1 className="font-[Syne] text-3xl font-black text-[#0A1628]">Security</h1>
      <p className="mt-4 text-slate-600">
        Your orders, addresses, and payment screenshots are stored in Supabase (PostgreSQL) with encryption at rest
        and TLS in transit.
      </p>
      <h2 className="mt-8 text-lg font-bold">Row-level security (plain language)</h2>
      <p className="mt-2 text-slate-600">
        The database is instructed: a customer can only see their own orders; a seller only sees orders assigned to
        them; a delivery agent only sees their jobs. Admin access is a separate role check — not a public switch.
      </p>
      <h2 className="mt-8 text-lg font-bold">Report a vulnerability</h2>
      <p className="mt-2 text-slate-600">
        Email <a className="font-semibold text-cyan-700" href="mailto:security@aurotap.in">security@aurotap.in</a> with
        steps to reproduce. Please do not include customer PII.
      </p>
      <form
        className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
        action="mailto:security@aurotap.in"
        method="GET"
      >
        <label className="block text-sm font-semibold">
          Your email
          <input name="cc" type="email" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
        </label>
        <label className="block text-sm font-semibold">
          Summary
          <input name="subject" required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
        </label>
        <label className="block text-sm font-semibold">
          Details
          <textarea name="body" rows={5} required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
        </label>
        <button type="submit" className="rounded-xl bg-[#0A1628] px-5 py-2.5 text-sm font-bold text-white">
          Open email to security@aurotap.in
        </button>
      </form>
    </div>
  );
}
