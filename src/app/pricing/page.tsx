'use client';

import Link from 'next/link';
import React from 'react';

export default function PricingPage() {
  return (
    <div className="min-h-screen gradient-section">
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <h1 className="text-4xl font-bold text-slate-800 mb-4">Pricing</h1>
        <p className="text-lg text-slate-600 mb-12">
          Transparent pricing. What you see in the booking flow is what you pay. No hidden charges.
        </p>

        <div className="glass-card p-8 rounded-2xl mb-8">
          <h2 className="text-2xl font-semibold text-slate-800 mb-4">What affects the price?</h2>
          <ul className="space-y-3 text-slate-600">
            <li><strong className="text-slate-800">Service type</strong> — Water supply, installation, or repair each have a base price.</li>
            <li><strong className="text-slate-800">Quantity</strong> — For water supply, price scales with liters (e.g. 500L, 1000L).</li>
            <li><strong className="text-slate-800">Distance</strong> — Distance from our zone base may add a small factor to the base price.</li>
            <li><strong className="text-slate-800">Tax</strong> — Applicable tax is shown in the breakdown.</li>
            <li><strong className="text-slate-800">Emergency</strong> — Same-day or urgent slots may include an emergency charge.</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Water supply</h3>
            <p className="text-2xl font-bold text-emerald-600 mb-2">From ₹500</p>
            <p className="text-sm text-slate-600">Per order, quantity-based. Example: 500L from ₹500.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Installation</h3>
            <p className="text-2xl font-bold text-emerald-600 mb-2">From ₹5,000</p>
            <p className="text-sm text-slate-600">Submersible installation. Site and pump options may vary.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Repair & maintenance</h3>
            <p className="text-2xl font-bold text-emerald-600 mb-2">From ₹2,000</p>
            <p className="text-sm text-slate-600">Repair and maintenance. Diagnostics and parts as needed.</p>
          </div>
        </div>

        <p className="text-slate-600 mb-6">
          You always see the full breakdown (base, distance factor, subtotal, tax, emergency) before confirming. Book a service to get an exact quote for your address and time slot.
        </p>
        <Link
          href="/book"
          className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors"
        >
          Get a quote
        </Link>
      </section>
    </div>
  );
}
