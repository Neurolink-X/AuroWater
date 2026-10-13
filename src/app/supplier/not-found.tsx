import Link from 'next/link';

export default function SupplierNotFound() {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md items-center px-4 py-10">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-4xl" aria-hidden="true">🔎</p>
        <h1 className="mt-3 text-xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          That page doesn’t exist or has moved. Head back to your dashboard to see your orders.
        </p>
        <Link
          href="/supplier"
          className="mt-6 inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
