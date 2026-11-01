// PATH: src/app/(public)/contact/ContactForm.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2, MessageCircle, Send } from 'lucide-react';
import {
  LIMITS, SUBJECTS, SUBJECT_ALIASES, contactSchema, whatsappHref, type ContactInput,
} from '@/lib/contact-shared';
import { trackEvent } from './track';

type Field = 'name' | 'email' | 'phone' | 'subject' | 'message';
const EMPTY: Required<ContactInput> = { name: '', email: '', phone: '', subject: 'General', message: '', website: '' };
const ORDER: Field[] = ['name', 'email', 'phone', 'subject', 'message'];
const SUBJECT_LABEL: Record<string, string> = { General: 'General enquiry' };

const input = (bad: boolean) =>
  `w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 disabled:opacity-60 ${
    bad ? 'border-rose-300 bg-rose-50 focus:border-rose-400 focus:ring-rose-500/15' : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/15'}`;

function Row({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-bold uppercase tracking-wide text-slate-600">{label}</label>
      {children}
      {error ? <p id={`${id}-msg`} role="alert" className="text-xs font-semibold text-rose-600">{error}</p>
        : hint ? <p id={`${id}-msg`} className="text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

/** Small self-contained fetch: hard timeout, friendly errors, Retry-After aware. No dependencies. */
async function postContact(body: unknown) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    const json = (await res.json().catch(() => ({}))) as { error?: string; data?: { reference?: string } };
    if (!res.ok) throw Object.assign(new Error(json.error || 'Could not send your message.'), { status: res.status, retryAfter: Number(res.headers.get('Retry-After')) || undefined });
    return json.data ?? {};
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    throw new Error(ctrl.signal.aborted ? 'This is taking too long. Check your connection and try again.' : 'Network problem. Check your connection and try again.');
  } finally { clearTimeout(timer); }
}

export default function ContactForm({ whatsappNumber }: { whatsappNumber: string }) {
  const [form, setForm] = useState<Required<ContactInput>>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ reference?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const inflight = useRef(false);

  // ?subject=technician deep links from other pages.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('subject')?.toLowerCase();
    const subject = raw ? SUBJECT_ALIASES[raw] : undefined;
    if (subject) {
      setForm((f) => ({ ...f, subject }));
      setTimeout(() => document.getElementById('contact-form')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }), 80);
    }
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const errors = useMemo(() => {
    const out: Partial<Record<Field, string>> = {};
    const r = contactSchema.safeParse(form);
    if (!r.success) for (const i of r.error.issues) { const k = i.path[0] as Field | undefined; if (k && !out[k]) out[k] = i.message; }
    return out;
  }, [form]);
  const shown = (k: Field) => (touched[k] || attempted ? errors[k] : undefined);
  const bind = (k: Field) => ({
    id: `c-${k}`, name: k, value: form[k], disabled: busy,
    'aria-invalid': Boolean(shown(k)), 'aria-describedby': `c-${k}-msg`,
    onBlur: () => setTouched((t) => ({ ...t, [k]: true })),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value })),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inflight.current || cooldown > 0) return;
    setError(null); setAttempted(true);
    const bad = ORDER.find((k) => errors[k]);
    if (bad) { document.getElementById(`c-${bad}`)?.focus(); return; }
    inflight.current = true; setBusy(true);
    try {
      const data = await postContact(form);
      trackEvent('contact_form_submit', { subject: form.subject });
      setDone({ reference: data.reference });
      setForm(EMPTY); setTouched({}); setAttempted(false);
    } catch (err) {
      const e2 = err as Error & { status?: number; retryAfter?: number };
      if (e2.status === 429) setCooldown(e2.retryAfter ?? 60);
      setError(e2.message);
    } finally { inflight.current = false; setBusy(false); }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-10 text-center" role="status" aria-live="polite">
        <span className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-emerald-600 to-emerald-300 text-white shadow-lg shadow-emerald-600/30"><CheckCircle2 size={30} aria-hidden="true" /></span>
        <h3 className="text-2xl font-black tracking-tight text-emerald-950">Message sent!</h3>
        <p className="max-w-sm text-sm leading-6 text-slate-600">
          Your message has been received. Our team will review it during support hours. {done.reference && <>Your reference is <strong className="font-mono">{done.reference}</strong>.</>}
        </p>
        <a href={whatsappHref(whatsappNumber)} onClick={() => trackEvent('contact_whatsapp_click', { placement: 'success' })}
          target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-700">
          <MessageCircle size={16} aria-hidden="true" /> Continue on WhatsApp
        </a>
        <button type="button" onClick={() => setDone(null)} className="text-sm font-bold text-emerald-700 underline">Send another message</button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Row id="c-name" label="Full name" error={shown('name')}>
          <input {...bind('name')} required autoComplete="name" maxLength={LIMITS.nameMax} placeholder="e.g. Rahul Sharma" className={input(!!shown('name'))} />
        </Row>
        <Row id="c-email" label="Email address" error={shown('email')}>
          <input {...bind('email')} required type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={LIMITS.emailMax} placeholder="you@example.com" className={input(!!shown('email'))} />
        </Row>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Row id="c-phone" label="Phone number" error={shown('phone')} hint="For updates about your enquiry.">
          <input {...bind('phone')} required type="tel" inputMode="tel" autoComplete="tel" maxLength={20} placeholder="98XXXXXXXX" className={input(!!shown('phone'))} />
        </Row>
        <Row id="c-subject" label="Subject" error={shown('subject')}>
          <select {...bind('subject')} className={`${input(!!shown('subject'))} cursor-pointer`}>
            {SUBJECTS.map((s) => <option key={s} value={s}>{SUBJECT_LABEL[s] ?? s}</option>)}
          </select>
        </Row>
      </div>
      <Row id="c-message" label="Your message" error={shown('message')} hint={`${form.message.trim().length}/${LIMITS.messageMax}`}>
        <textarea {...bind('message')} required rows={5} maxLength={LIMITS.messageMax} placeholder="Tell us what you need help with…" className={`${input(!!shown('message'))} resize-none`} />
      </Row>

      {/* Honeypot */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} /></label>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error} <a href={whatsappHref(whatsappNumber)} target="_blank" rel="noopener noreferrer" className="underline">Message us on WhatsApp</a>
        </p>
      )}

      <button type="submit" disabled={busy || cooldown > 0}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 px-6 text-[15px] font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-emerald-500/30 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60">
        {busy ? <><Loader2 size={17} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Sending…</>
          : cooldown > 0 ? `Try again in ${cooldown}s`
          : <><Send size={17} aria-hidden="true" /> Send enquiry</>}
      </button>
      <p className="text-center text-xs text-slate-400">Your enquiry is stored securely. Never share OTPs or passwords with anyone.</p>
    </form>
  );
}
