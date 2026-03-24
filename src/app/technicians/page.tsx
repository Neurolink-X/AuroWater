'use client';

import Link from 'next/link';
import React from 'react';

export default function TechniciansPage() {
  return (
    <div className="min-h-screen gradient-section">
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <h1 className="text-4xl font-bold text-slate-800 mb-4">Verified technicians</h1>
        <p className="text-lg text-slate-600 mb-12">
          Every AuroWater technician is verified, trained, and rated. We assign the right professional for your service and location.
        </p>

        <div className="glass-card p-8 rounded-2xl mb-8">
          <h2 className="text-2xl font-semibold text-slate-800 mb-4">What we verify</h2>
          <ul className="space-y-3 text-slate-600">
            <li>Identity and contact details</li>
            <li>Relevant experience and specialisation</li>
            <li>License or certification where applicable</li>
            <li>Availability and zone coverage</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Water supply & delivery</h3>
            <p className="text-slate-600 text-sm">Trained drivers and operators for safe, on-time delivery to your address and time slot.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Installation & repair</h3>
            <p className="text-slate-600 text-sm">Certified technicians for submersible installation, repair, and maintenance with clear diagnostics.</p>
          </div>
        </div>

        <p className="text-slate-600 mb-6">
          After your service, you can rate your experience. Ratings help us maintain quality and assign the best technician for your next booking.
        </p>
        <Link
          href="/book"
          className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors"
        >
          Book a service
        </Link>
      </section>
    </div>
  );
}
