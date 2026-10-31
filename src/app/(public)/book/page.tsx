import dynamic from 'next/dynamic';

const BookingWizard = dynamic(() => import('@/components/booking/BookingWizard'), {
  loading: () => (
    <main className="mx-auto max-w-3xl px-4 py-8" aria-busy="true" aria-label="Preparing secure booking">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
      <div className="mt-6 h-32 animate-pulse rounded-2xl bg-slate-100" />
      <div className="mt-4 h-40 animate-pulse rounded-2xl bg-slate-100" />
      <p className="mt-4 text-sm text-slate-600">Preparing your booking…</p>
    </main>
  ),
});

/** Stream the lightweight booking shell while the client wizard loads. */
export default function BookPage() {
  return <BookingWizard />;
}
