'use client';

import Link from 'next/link';
import React from 'react';

export default function AboutPage() {
  return (
    <div className="min-h-screen gradient-section">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <h1 className="text-4xl font-bold text-slate-800 mb-4">About AuroWater</h1>
        <p className="text-lg text-slate-600 mb-8">
          We bring reliable water supply and water-system services to homes and businesses with transparent pricing and verified technicians.
        </p>

        <div className="glass-card p-8 rounded-2xl mb-8">
          <h2 className="text-2xl font-semibold text-slate-800 mb-4">Our mission</h2>
          <p className="text-slate-600">
            To make water supply and water-system services easy to book, fair to pay, and dependable to receive. We believe in clear pricing, verified professionals, and a simple booking experience—so you get what you need without guesswork or hidden charges.
          </p>
        </div>

        <div className="glass-card p-8 rounded-2xl mb-8">
          <h2 className="text-2xl font-semibold text-slate-800 mb-4">Reliability</h2>
          <p className="text-slate-600 mb-4">
            We verify every technician, show you the full price before you confirm, and let you choose a time slot that works for you. Same-day and emergency options are available where we operate.
          </p>
          <p className="text-slate-600">
            Your order is tracked from booking to completion. If something is not right, our support team is there to help.
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          <Link
            href="/book"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors"
          >
            Book now
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
          >
            Contact us
          </Link>
        </div>
      </section>
    </div>
  );
}
