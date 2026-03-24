'use client';

import React, { useState } from 'react';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [settings, setSettings] = useState<any>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings', { cache: 'no-store' });
        const json = await res.json();
        setSettings(json?.data || null);
      } catch {
        setSettings(null);
      } finally {
        setSettingsLoading(false);
      }
    })();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setSubmitted(true);
      setLoading(false);
      setForm({ name: '', email: '', subject: '', message: '' });
    }, 800);
  };

  return (
    <div className="min-h-screen gradient-section">
      <section className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <h1 className="text-4xl font-bold text-slate-800 mb-4">Contact us</h1>
        <p className="text-lg text-slate-600 mb-12">
          Have a question or need support? Send us a message and we’ll get back to you.
        </p>

        <div className="glass-card p-8 rounded-2xl mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Support</h2>
          <ul className="text-slate-600 space-y-2">
            <li>
              <strong className="text-slate-800">Support email:</strong>{' '}
              {settingsLoading ? 'Loading…' : (settings?.support_email?.trim() || '—')}
            </li>
            <li>
              <strong className="text-slate-800">Secondary email:</strong>{' '}
              {settingsLoading ? 'Loading…' : (settings?.secondary_email?.trim() || '—')}
            </li>
            <li>
              <strong className="text-slate-800">Phone:</strong>{' '}
              {settingsLoading ? 'Loading…' : (settings?.phone_primary?.trim() || '—')}
              {settings?.phone_secondary?.trim() ? ` / ${settings.phone_secondary.trim()}` : ''}
            </li>
            <li>
              <strong className="text-slate-800">Office:</strong>{' '}
              {settingsLoading ? 'Loading…' : (settings?.office_address?.trim() || '—')}
            </li>
            <li>
              <strong className="text-slate-800">Working hours:</strong>{' '}
              {settingsLoading ? 'Loading…' : (settings?.working_hours?.trim() || '—')}
            </li>
            <li><strong className="text-slate-800">Bookings:</strong> Use the Book page for orders and time slots.</li>
            <li><strong className="text-slate-800">Technicians:</strong> Join via Register → Technician.</li>
          </ul>
        </div>

        <div className="glass-card p-8 rounded-2xl">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Send a message</h2>
          {submitted ? (
            <p className="text-emerald-600 font-medium">
              Thanks! We’ve received your message and will respond soon.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  id="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                <input
                  id="subject"
                  type="text"
                  required
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                <textarea
                  id="message"
                  rows={4}
                  required
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-emerald-600 text-white font-semibold py-3 hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send message'}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
