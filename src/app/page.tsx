'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface FoundingStats {
  count: number;
}

export default function HomePage() {
  const [founding, setFounding] = useState<FoundingStats | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [foundingMsg, setFoundingMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/founding-members', { cache: 'no-store' });
        const json = await res.json();
        if (json?.success) {
          setFounding(json.data);
        }
      } catch {
        // Best-effort; landing page should still work.
      }
    })();
  }, []);

  const claimed = Math.min(founding?.count ?? 73, 100);
  const total = 100;
  const progress = (claimed / total) * 100;

  const handleFoundingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFoundingMsg(null);
    if (!name.trim() || !phone.trim()) {
      setFoundingMsg('Please enter your name and phone.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/founding-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setFoundingMsg(json?.error || 'Could not save your details. Please try again.');
      } else {
        setFoundingMsg(json?.message || 'Welcome to the founding members!');
        setName('');
        setPhone('');
        // optimistic bump
        setFounding((prev) => ({ count: (prev?.count ?? 0) + 1 }));
      }
    } catch {
      setFoundingMsg('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#0A2342] text-white">
        <div className="hero-water-bg" />
        <div className="hero-ripple -right-40 -top-32 hidden sm:block" />
        <div className="hero-ripple -left-40 -bottom-40 opacity-60" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              <p className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-cyan-300 mb-4">
                AuroWater · ऑन-डिमांड पानी + प्लम्बर
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight">
                <span className="block text-cyan-300">
                  शुद्ध पानी। सीधे आपके दरवाज़े तक।
                </span>
                <span className="mt-2 block text-white">
                  Pure Water. Delivered to Your Door.
                </span>
              </h1>
              <p className="mt-5 text-base sm:text-lg text-cyan-50/80 max-w-xl">
                Water delivery + plumber service for everyone. Students, families, offices,
                and events — all managed in one simple app experience.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/book"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#00BCD4] to-cyan-500 px-6 sm:px-8 py-3 sm:py-3.5 text-sm sm:text-base font-semibold text-slate-950 shadow-card hover:opacity-95 transition"
                >
                  <span>💧 Order Water Now</span>
                </Link>
                <Link
                  href="/services"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-300/60 bg-white/5 px-6 sm:px-8 py-3 sm:py-3.5 text-sm sm:text-base font-semibold text-cyan-100 hover:bg-white/10 transition"
                >
                  <span>🔧 Book a Plumber</span>
                </Link>
              </div>

              <motion.div
                className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs sm:text-sm"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                {[
                  { label: 'Daily Deliveries', value: '500+' },
                  { label: 'Plumbers', value: '50+' },
                  { label: 'Suppliers', value: '20+' },
                  { label: 'Rating', value: '⭐ 4.8' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-cyan-300/25 bg-white/5 px-3 py-3 backdrop-blur-md"
                  >
                    <p className="text-xs text-cyan-100/70">{item.label}</p>
                    <p className="mt-1 text-lg font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            <motion.div
              className="space-y-4 lg:space-y-6"
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
            >
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6 backdrop-blur-xl shadow-card">
                <h2 className="text-sm font-semibold text-cyan-200 uppercase tracking-wide">
                  Why AuroWater
                </h2>
                <ul className="mt-4 space-y-3 text-sm text-cyan-50/90">
                  <li>• Water cans at ₹10–15 with real-time availability.</li>
                  <li>• Verified suppliers & plumbers from your local area.</li>
                  <li>• Cash + UPI · Hindi + English support.</li>
                  <li>• Emergency delivery in under 2 hours (select areas).</li>
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-cyan-200 font-semibold mb-1">Students & PG</p>
                  <p className="text-cyan-50/80">Daily cans, no landlord drama.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-cyan-200 font-semibold mb-1">Families & Flats</p>
                  <p className="text-cyan-50/80">Regular supply + trusted plumbers.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-cyan-200 font-semibold mb-1">Offices & Cafes</p>
                  <p className="text-cyan-50/80">Subscriptions with priority support.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-cyan-200 font-semibold mb-1">Events & Weddings</p>
                  <p className="text-cyan-50/80">Bulk bookings with on-site support.</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* SERVICES STRIP */}
      <section className="border-b border-slate-800 bg-slate-950/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-3 text-xs sm:text-sm text-slate-200">
            <span>✅ Verified Suppliers</span>
            <span>✅ Always Free Delivery</span>
            <span>✅ Cash + UPI</span>
            <span>✅ Hindi + English Support</span>
            <span>✅ 2hr Emergency Response</span>
          </div>
        </div>
      </section>

      {/* 3 PRIMARY SERVICES */}
      <section className="bg-slate-50 py-14 sm:py-18 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h2
            className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 text-center mb-10 sm:mb-12"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5 }}
          >
            Services for every water need
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
              icon: '💧',
              title: 'Water Delivery',
              body: 'Daily cans ₹10–15 · Always free doorstep delivery · Perfect for hostels, families, and offices.',
              cta: 'Order Now',
              href: '/book',
              },
              {
              icon: '🔧',
              title: 'Plumber Service',
              body: 'Fitting, boring, repair, and pump installation by verified local plumbers.',
              cta: 'Book Now',
              href: '/services',
              },
              {
                icon: '🚚',
                title: 'Bulk & Events',
                body: 'Weddings, offices, construction, schools — cans, tankers, and plumber teams on demand.',
                cta: 'Get Quote',
                href: '/contact',
              },
            ].map((card) => (
              <motion.div
                key={card.title}
                className="glass-card p-6 sm:p-7 rounded-2xl hover-lift"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5 }}
              >
                <div className="text-3xl mb-4">{card.icon}</div>
                <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-2">
                  {card.title}
                </h3>
                <p className="text-sm sm:text-base text-slate-600 mb-4">
                  {card.body}
                </p>
                <Link
                  href={card.href}
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 text-white px-4 py-2 text-xs sm:text-sm font-semibold hover:bg-slate-800 transition"
                >
                  {card.cta} →
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* WHO WE SERVE */}
      <section className="bg-white py-14 sm:py-18 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h2
            className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-8 sm:mb-10"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
          >
            Who we serve
          </motion.h2>
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 text-xs sm:text-sm"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
          >
            {[
              '👨‍🎓 Students',
              '👨‍💼 Professionals',
              '🏠 Homeowners',
              '🏢 Offices',
              '🎪 Weddings',
              '🍽️ Restaurants',
              '🏗️ Construction',
              '🏫 Schools',
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-center text-slate-700"
              >
                {item}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-slate-900 py-14 sm:py-18 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h2
            className="text-2xl sm:text-3xl font-bold text-white text-center mb-8 sm:mb-10"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
          >
            How it works
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                step: '1',
                title: '📱 Order in 30 seconds',
                body: 'Pick water or plumber, add your address, and select a time slot.',
              },
              {
                step: '2',
                title: '🚚 Supplier accepts & delivers',
                body: 'Nearest verified supplier or plumber is assigned automatically.',
              },
              {
                step: '3',
                title: '✅ Done — pay cash or UPI',
                body: 'Track status live, pay on completion, and rate your experience.',
              },
            ].map((item, idx) => (
              <motion.div
                key={item.step}
                className="rounded-2xl border border-cyan-500/30 bg-slate-950/60 p-6 sm:p-7 backdrop-blur-xl"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: idx * 0.08, duration: 0.5 }}
              >
                <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 text-sm font-semibold">
                  {item.step}
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-200/80">
                  {item.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FOUNDING MEMBERS */}
      <section className="bg-slate-50 py-14 sm:py-18 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-10 lg:grid-cols-[1.2fr,1fr] items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
              Join Our First 100 Founding Members
            </h2>
            <p className="text-base text-slate-600 mb-4">
              पहले 100 customers में शामिल हों और हमेशा के लिए बेहतर पानी और प्रायोरिटी
              सर्विस पाएं।
            </p>
            <ul className="text-sm text-slate-700 space-y-1 mb-6">
              <li>🔒 Lifetime 10% discount on water and services</li>
              <li>⚡ Always priority delivery window</li>
              <li>🎁 First order free (up to ₹200)</li>
              <li>📞 Direct WhatsApp support with the core team</li>
            </ul>

            <div className="mb-3 flex items-center justify-between text-xs sm:text-sm">
              <span className="font-medium text-slate-800">
                {claimed} of 100 spots claimed
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden mb-4">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00BCD4] to-emerald-500 transition-[width] duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              Limited founding cohort. We&apos;ll confirm your spot by SMS/WhatsApp.
            </p>
          </motion.div>

          <motion.form
            onSubmit={handleFoundingSubmit}
            className="glass-card rounded-2xl p-6 sm:p-7 shadow-card"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
          >
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Reserve your spot
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  placeholder="e.g. Arjun Singh"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Phone (WhatsApp)
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  placeholder="10-digit Indian mobile"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="mt-2 w-full rounded-full bg-slate-900 text-white text-sm font-semibold py-2.5 hover:bg-slate-800 transition disabled:opacity-60"
              >
                {submitting ? 'Saving…' : 'Join the first 100 →'}
              </button>
              {foundingMsg && (
                <p className="text-xs text-slate-600 mt-2">{foundingMsg}</p>
              )}
            </div>
          </motion.form>
        </div>
      </section>

      {/* SUPPLIER & PLUMBER CTA */}
      <section className="bg-slate-900 py-14 sm:py-18 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-6 lg:grid-cols-2">
          <motion.div
            className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-6 sm:p-7"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <h3 className="text-lg sm:text-xl font-semibold text-emerald-100 mb-2">
              🚚 Supply Water — Earn ₹3,000–8,000/month
            </h3>
            <p className="text-sm text-emerald-50/80 mb-4">
              Use your vehicle and local routes to deliver water cans. We handle customers,
              you focus on timely delivery.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 text-slate-900 px-5 py-2.5 text-sm font-semibold hover:bg-emerald-400 transition"
            >
              Apply as Supplier →
            </Link>
          </motion.div>
          <motion.div
            className="rounded-2xl border border-cyan-400/40 bg-cyan-500/10 p-6 sm:p-7"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <h3 className="text-lg sm:text-xl font-semibold text-cyan-100 mb-2">
              🔧 Work as Plumber — Earn ₹4,000–15,000/month
            </h3>
            <p className="text-sm text-cyan-50/80 mb-4">
              Get regular jobs for fittings, repair, and boring. Transparent pricing and
              instant payments via UPI.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-full bg-cyan-400 text-slate-900 px-5 py-2.5 text-sm font-semibold hover:bg-cyan-300 transition"
            >
              Apply as Plumber →
            </Link>
          </motion.div>
        </div>
      </section>

      {/* FINAL TRUST & CTA */}
      <section className="bg-slate-950 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-cyan-300">
            Trusted by residents across North India
          </p>
          <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white">
            Water shouldn&apos;t be a daily headache.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-300">
            AuroWater keeps your cans filled, pumps running, and events flowing — so you
            can focus on life, not logistics.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/book"
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#00BCD4] to-emerald-500 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:opacity-95 transition"
            >
              Start in 30 seconds →
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-full border border-slate-500/60 px-6 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-900 transition"
            >
              View transparent pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
