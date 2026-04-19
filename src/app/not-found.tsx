import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-16 bg-slate-50">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white shadow-sm p-8 text-center">
        <div className="mx-auto mb-5 w-20 h-20 rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center">
          <svg viewBox="0 0 64 64" width="36" height="36" fill="none" aria-hidden="true">
            <path d="M32 8C20 22 12 30 12 40a20 20 0 0 0 40 0c0-10-8-18-20-32z" fill="#93C5FD" />
            <path d="M32 16C24 26 19 32 19 40a13 13 0 0 0 26 0c0-8-5-14-13-24z" fill="#38BDF8" fillOpacity="0.55" />
          </svg>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">This page dried up.</h1>
        <p className="mt-3 text-sm sm:text-base text-slate-600">Let&apos;s get you back on track.</p>

        <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="w-full sm:w-auto rounded-xl bg-sky-600 text-white px-5 py-2.5 font-semibold hover:bg-sky-700 transition-colors"
          >
            Go Home
          </Link>
          <Link
            href="/book"
            className="w-full sm:w-auto rounded-xl border border-slate-300 text-slate-800 px-5 py-2.5 font-semibold hover:bg-slate-100 transition-colors"
          >
            Book a Service
          </Link>
        </div>
      </div>
    </div>
  );
}

