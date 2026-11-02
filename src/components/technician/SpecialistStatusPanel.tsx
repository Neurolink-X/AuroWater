'use client';
import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useAuth } from '@/hooks/useAuth';

type Specialty = { service_key: string; reviewed_at?: string | null };
type Blocked = { service_key: string; status: string };
type ApprovalState = {
  profile: { city: string | null; email: string | null; verification: string | null; active: boolean };
  approved: Specialty[];
  other_capabilities: Blocked[];
  application: { id: string; status: string; created_at: string; requested_role: string | null; rejection_note: string | null } | null;
};
type OwnedState = { userId: string; data: ApprovalState };
const SERVICE_DETAILS: Record<string, { en: string; hi: string; image: string }> = {
  plumbing: { en: 'Plumbing', hi: 'प्लंबिंग', image: '/images/plumbing.webp' },
  borewell: { en: 'Borewell / drilling', hi: 'बोरवेल', image: '/images/borewell.webp' },
  tank_cleaning: { en: 'Water tank cleaning', hi: 'टंकी की सफाई', image: '/images/tank_cleaning.webp' },
  ro_service: { en: 'RO servicing', hi: 'RO सर्विस', image: '/images/ro_service.webp' },
  motor_pump: { en: 'Motor pump repair', hi: 'मोटर पंप', image: '/images/motor_pump.webp' },
  installation: { en: 'Installation', hi: 'इंस्टॉलेशन', image: '/images/ro_service.webp' },
  maintenance: { en: 'Maintenance', hi: 'मेंटेनेंस', image: '/images/motor_pump.webp' },
};
const showName = (key: string, hi: boolean) => SERVICE_DETAILS[key]?.[hi ? 'hi' : 'en'] ?? key.replace(/_/g, ' ');
const CACHE_MS = 25_000;
const REQUEST_MS = 12_000;
// Never persist private email/approvals in localStorage or sessionStorage.
// Key by authenticated user to prevent cross-account cache leakage after switching users.
const cached = new Map<string, { at: number; data: ApprovalState }>();
const pending = new Map<string, Promise<ApprovalState>>();
async function readApprovals(userId: string, force = false): Promise<ApprovalState> {
  const existing = cached.get(userId);
  if (!force && existing && Date.now() - existing.at < CACHE_MS) return existing.data;
  const running = pending.get(userId);
  if (running) return running;
  const fetcher = (async () => {
    const res = await fetch('/api/technician/specializations', {
      cache: 'no-store', credentials: 'include', signal: AbortSignal.timeout(REQUEST_MS),
    });
    const json: { success?: boolean; data?: ApprovalState; error?: string } = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false || !json.data) throw new Error(json.error || 'Service approvals unavailable.');
    // Bounded in-memory cache; not an authorization source for new job assignments.
    if (cached.size >= 8 && !cached.has(userId)) cached.delete(cached.keys().next().value ?? '');
    cached.set(userId, { at: Date.now(), data: json.data });
    return json.data;
  })();
  pending.set(userId, fetcher);
  try { return await fetcher; } finally { if (pending.get(userId) === fetcher) pending.delete(userId); }
}
const statusClass = (status: string) => status === 'approved'
  ? 'bg-emerald-50 text-emerald-800'
  : status === 'rejected' || status === 'suspended'
    ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-900';

export default function SpecialistStatusPanel({ enabled }: { enabled: boolean }) {
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { userId } = useAuth();
  const [record, setRecord] = useState<OwnedState | null>(null);
  const [error, setError] = useState('');
  const [busyFor, setBusyFor] = useState('');
  const data = enabled && userId === record?.userId ? record.data : null;
  const loading = Boolean(userId && busyFor === userId);

  const refresh = useCallback(async (force = false) => {
    if (!enabled || !userId) return;
    setBusyFor(userId);
    try {
      const next = await readApprovals(userId, force);
      setRecord({ userId, data: next });
      setError('');
    } catch (cause) {
      // A stale qualification must never be shown as currently verified after a failed refresh.
      setRecord(null);
      cached.delete(userId);
      const timeout = cause instanceof DOMException && (cause.name === 'TimeoutError' || cause.name === 'AbortError');
      setError(timeout ? (hi ? 'जाँच में समय लग रहा है। इंटरनेट जाँचें और दोबारा कोशिश करें।' : 'Verification timed out. Check your connection and retry.')
        : cause instanceof Error ? cause.message : 'Could not verify qualifications.');
    } finally {
      setBusyFor('');
    }
  }, [enabled, userId, hi]);

  useEffect(() => {
    if (!enabled || !userId) return;
    void refresh();
    let lastFocusRefresh = Date.now();
    const onVisible = () => { if (document.visibilityState === 'visible' && navigator.onLine && Date.now() - lastFocusRefresh >= 8_000) { lastFocusRefresh = Date.now(); void refresh(); } };
    const onOnline = () => { if (document.visibilityState === 'visible') { lastFocusRefresh = Date.now(); void refresh(); } };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [enabled, userId, refresh]);
  if (!enabled) return null;
  const approved = data?.approved ?? [];
  const role = data?.application?.requested_role;
  const selected = role === 'tank' ? 'tank_cleaning' : role === 'plumber' ? 'plumbing' : role ?? '';
  return <section aria-label="Your approved service qualifications" className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{hi ? 'सत्यापित सेवाएँ और खाता' : 'Verified services & account'}</p>
        <h2 className="mt-1 text-lg font-bold">
          {loading && !data ? (hi ? 'जानकारी अपडेट हो रही है…' : 'Loading account details…') :
           approved.length > 1 ? (hi ? 'बहु-सेवा विशेषज्ञ' : 'Multi-service specialist') :
           approved.length === 1 ? showName(approved[0].service_key, hi) :
           (hi ? 'सेवा स्वीकृति लंबित है' : 'Awaiting service approval')}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {data ? (hi ? 'कार्य शहर: ' : 'Working city: ') + (data.profile.city || (hi ? 'दर्ज नहीं' : 'Not registered'))
            : (hi ? 'नई बुकिंग केवल स्वीकृत कौशल के अनुसार मिलती है।' : 'New jobs require an Admin-approved service skill.')}
        </p>
      </div>
      <button type="button" onClick={() => void refresh(true)} disabled={loading}
        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold disabled:opacity-50">
        {loading ? (hi ? 'जाँच जारी…' : 'Checking…') : (hi ? 'रिफ्रेश' : 'Refresh')}
      </button>
    </div>
    {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
      {error} {hi ? 'सत्यापन के बिना नया काम नहीं मिलेगा।' : 'New work remains protected until verified.'}
    </p>}
    {data && <>
      <dl className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-2">
        <div className="min-w-0"><dt className="text-xs text-slate-500">{hi ? 'पंजीकृत ईमेल' : 'Registered email'}</dt>
          <dd className="mt-1 break-all font-semibold">{data.profile.email || (hi ? 'ईमेल उपलब्ध नहीं' : 'No email on account')}</dd></div>
        <div><dt className="text-xs text-slate-500">{hi ? 'खाता और सत्यापन' : 'Account & verification'}</dt>
          <dd className="mt-1 font-semibold">{data.profile.active ? (hi ? 'सक्रिय' : 'Active') : (hi ? 'निष्क्रिय' : 'Inactive')} · {data.profile.verification || 'pending'}</dd></div>
      </dl>
      {approved.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {approved.map(s => <div key={s.service_key} className="overflow-hidden rounded-xl border border-emerald-200">
          {SERVICE_DETAILS[s.service_key]?.image && <Image src={SERVICE_DETAILS[s.service_key].image} width={400} height={210}
            sizes="(max-width: 640px) 85vw, 210px" alt={showName(s.service_key, hi)}
            className="h-28 w-full object-cover" />}
          <div className="p-3"><p className="font-semibold">{showName(s.service_key, hi)}</p>
            <p className="mt-1 text-xs text-emerald-700">{hi ? 'एडमिन से स्वीकृत' : 'Admin approved'}</p></div>
        </div>)}
      </div> : <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        {hi ? 'अभी कोई सेवा स्वीकृत नहीं है। पहचान और कौशल प्रमाणपत्र सत्यापित कराएँ।' :
          'No service is approved yet. Complete identity and qualification document review before accepting jobs.'}
      </div>}
      {data.other_capabilities.length > 0 && <div className="mt-3 flex flex-wrap gap-2">
        {data.other_capabilities.map(s=><span key={s.service_key} className={'rounded-full px-3 py-1.5 text-xs font-semibold ' + statusClass(s.status)}>
          {showName(s.service_key,hi)} · {s.status}</span>)}
      </div>}
      {data.application && <p className="mt-3 text-sm text-slate-700">
        {hi ? 'आवेदन की स्थिति' : 'Application'}: <strong>{data.application.status.replace(/_/g,' ')}</strong>
        {selected && ' · ' + showName(selected,hi)}
        {data.application.rejection_note && <span className="block text-rose-700">{data.application.rejection_note}</span>}
      </p>}
    </>}
    <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-emerald-700">
      <Link href="/technician/settings" className="underline">{hi ? 'खाता सेटिंग्स' : 'Account settings'}</Link>
      <Link href="/technician/dashboard#documents" className="underline">{hi ? 'दस्तावेज़' : 'Documents'}</Link>
      <Link href="/technician/jobs" className="underline">{hi ? 'मेरे काम' : 'My jobs'}</Link>
      <Link href="/register/pro" className="underline">{hi ? 'नई सेवा के लिए आवेदन' : 'Apply for another service'}</Link>
      <Link href="/contact?subject=technician" className="underline">{hi ? 'सहायता' : 'Support'}</Link>
    </div>
    <p className="mt-3 text-xs text-slate-500">{hi ? 'ईमेल केवल आपके सुरक्षित खाते में दिखाई देता है। इसे सार्वजनिक ग्राहकों को नहीं दिखाया जाता।' :
      'Your registered email is private. Service approval is controlled on the server, not by editable device settings.'}</p>
  </section>;
}
