'use client';

import Link from 'next/link';
import React from 'react';

const SERVICES = [
  {
    id: 'water-supply',
    icon: '💧',
    title: 'Water supply',
    description: 'Order water in liters or tanker quantities. Choose your preferred date and time slot. We deliver to homes, offices, and farms. Scheduled or emergency delivery available.',
    features: ['Flexible quantities (500L to 5000L+)', 'Time-slot booking', 'Transparent per-liter pricing', 'Same-day delivery in many areas'],
    fromPrice: 500,
  },
  {
    id: 'installation',
    icon: '🔧',
    title: 'Submersible installation',
    description: 'Professional submersible pump installation by certified technicians. We handle site assessment, bore depth, pump selection, and warranty support.',
    features: ['Site assessment included', 'Quality pumps and fittings', 'Warranty and support', 'Post-installation check'],
    fromPrice: 5000,
  },
  {
    id: 'repair',
    icon: '🔨',
    title: 'Repair & maintenance',
    description: 'Regular maintenance and emergency repair for pumps and water systems. Fast response, clear diagnostics, and fair pricing.',
    features: ['Emergency same-day slots', 'Diagnostics and estimates', 'Genuine parts', 'Maintenance plans'],
    fromPrice: 2000,
  },
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen gradient-section">
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <h1 className="text-4xl font-bold text-slate-800 mb-4">Our services</h1>
        <p className="text-lg text-slate-600 mb-12">
          AuroWater offers water supply, submersible installation, and repair & maintenance. Each service is delivered by verified technicians with transparent pricing.
        </p>

        <div className="space-y-12">
          {SERVICES.map((s) => (
            <article
              key={s.id}
              id={s.id}
              className="glass-card p-8 rounded-2xl shadow-card hover-lift"
            >
              <div className="flex items-start gap-6">
                <span className="text-5xl">{s.icon}</span>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">{s.title}</h2>
                  <p className="text-slate-600 mb-4">{s.description}</p>
                  <ul className="list-disc list-inside text-slate-600 space-y-1 mb-4">
                    {s.features.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                  <p className="text-sm font-semibold text-emerald-600">From ₹{s.fromPrice.toLocaleString()}</p>
                  <Link
                    href="/book"
                    className="mt-4 inline-block px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
                  >
                    Book this service
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link href="/pricing" className="text-emerald-600 font-medium hover:underline">
            View pricing details →
          </Link>
        </div>
      </section>
    </div>
  );
}
