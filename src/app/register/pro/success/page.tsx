'use client';

import Link from 'next/link';

export default function ProApplicationSuccessPage() {
  return (
    <div className="min-h-screen px-4 py-16" style={{ background: '#050B18', color: '#E5E7EB' }}>
      <div className="max-w-xl mx-auto text-center">
        <div className="text-5xl">✅</div>
        <h1 className="mt-6 text-3xl font-extrabold aw-heading text-white">
          Application submitted!
        </h1>
        <p className="mt-3 text-slate-200/80">
          We&apos;ll review within 24 hours and contact you on WhatsApp.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-2xl px-6 py-3 font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#14B8A6,#2563EB)' }}
          >
            Back to home
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-2xl px-6 py-3 font-bold border border-white/10 bg-white/5 text-white"
          >
            Contact support
          </Link>
        </div>
      </div>
    </div>
  );
}

