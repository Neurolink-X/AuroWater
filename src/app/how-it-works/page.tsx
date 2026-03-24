'use client';

import Link from 'next/link';
import React from 'react';

const STEPS = [
  {
    step: 1,
    title: 'Choose address',
    description: 'Select a saved address or add a new one. We use it for delivery and pricing.',
  },
  {
    step: 2,
    title: 'Choose service',
    description: 'Pick water supply, installation, or repair. Add quantity or options as needed.',
  },
  {
    step: 3,
    title: 'Pick time slot',
    description: 'Select date, start time, and end time. Minimum 30 minutes, future only. No guesswork.',
  },
  {
    step: 4,
    title: 'See price breakdown',
    description: 'Get base price, distance factor, tax, and emergency charges before confirming.',
  },
  {
    step: 5,
    title: 'Confirm',
    description: 'Place your order. We assign a verified technician and keep you updated.',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen gradient-section">
      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <h1 className="text-4xl font-bold text-slate-800 mb-4">How it works</h1>
        <p className="text-lg text-slate-600 mb-12">
          Book in five simple steps. Transparent pricing, verified technicians, and a clear timeline.
        </p>

        <div className="relative space-y-8">
          {STEPS.map((s, i) => (
            <div key={s.step} className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center">
                {s.step}
              </div>
              <div className="flex-1 pb-8 border-l-2 border-emerald-200 pl-6 -ml-3">
                <h2 className="text-xl font-semibold text-slate-800 mb-2">{s.title}</h2>
                <p className="text-slate-600">{s.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/book"
            className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors"
          >
            Start booking
          </Link>
        </div>
      </section>
    </div>
  );
}
