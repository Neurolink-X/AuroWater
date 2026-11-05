'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getToken } from '@/lib/api-client';
import { useLanguage } from '@/lib/i18n/LanguageContext';

type ApprovalState = {
  profile: { city: string | null; email: string | null; verification: string | null; active: boolean };
  documents: { status: 'approved' | 'under_review' | 'rejected' | 'not_submitted'; approved_count: number; required_count: number };
  approved: { service_key: string; reviewed_at?: string | null }[];
  other_capabilities: { service_key: string; status: string }[];
  application: { id: string; status: string; requested_role: string | null; rejection_note: string | null } | null;
};
type OwnedRecord = { userId: string; data: ApprovalState };
const CACHE_MS = 15_000;
const REFRESH_MS = 40_000;
const cache = new Map<string, { at: number; data: ApprovalState }>();
const pending = new Map<string, Promise<ApprovalState>>();
const LABELS: Record<string, [string, string]> = {
  plumbing: ['Plumbing', 'प्लंबिंग'],
  borewell: ['Borewell', 'बोरवेल'],
  tank_cleaning: ['Tank cleaning', 'टंकी की सफाई'],
  ro_service: ['RO service', 'RO सर्विस'],
  motor_pump: ['Motor repair', 'मोटर रिपेयर'],
  installation: ['Installation', 'इंस्टॉलेशन'],
  maintenance: ['Maintenance', 'मेंटेनेंस'],
};
const label = (key: string, hi: boolean) => LABELS[key]?.[hi ? 1 : 0] ?? key.replaceAll('_', ' ');
async function readApproval(userId: string, force = false): Promise<ApprovalState> {
  const saved = cache.get(userId);
  if (!force && saved && Date.now() - saved.at < CACHE_MS) return saved.data;
  const active = pending.get(userId);
  if (active) return active;
  const task = (async () => {
    const token = await getToken();
    if (!token) throw new Error('SESSION_REQUIRED');
    const response = await fetch('/api/technician/specializations', {
      cache: 'no-store', credentials: 'same-origin',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(12_000),
    });
    const payload: { success?: boolean; data?: ApprovalState; error?: string } =
      await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('SESSION_REQUIRED');
    if (response.status === 403) throw new Error('ROLE_NOT_ALLOWED');
    if (!response.ok || payload.success === false || !payload.data) throw new Error('STATUS_UNAVAILABLE');
    if (cache.size >= 8 && !cache.has(userId)) cache.delete(cache.keys().next().value ?? '');
    cache.set(userId, { at: Date.now(), data: payload.data });
    return payload.data;
  })();
  pending.set(userId, task);
  try { return await task; } finally { if (pending.get(userId) === task) pending.delete(userId); }
}

/**
 * KYC approval is NOT approval to accept a particular service.
 * Show each state separately, even for fully uploaded/approved documents.
 * Request updates only while the tab is visible; never store identities in localStorage.
 */
export default function SpecialistStatusPanel({ enabled }: { enabled: boolean }) {
  const { language } = useLanguage();
  const hi = language === 'hi';
  const { userId } = useAuth();
  const [record, setRecord] = useState<OwnedRecord | null>(null);
  const [error, setError] = useState('');
  const [loadingUser, setLoadingUser] = useState<string | null>(null);
  const lastChecked = useRef(0);
  const data = enabled && record?.userId === userId ? record.data : null;
  const loading = loadingUser === userId && Boolean(userId);

  const refresh = useCallback(async (force = false) => {
    if (!enabled || !userId) return;
    setLoadingUser(userId);
    try {
      const next = await readApproval(userId, force);
      setRecord({ userId, data: next });
      setError('');
      lastChecked.current = Date.now();
    } catch (cause) {
      cache.delete(userId);
      setRecord(null);
      const reason = cause instanceof Error ? cause.message : '';
      const timeout = cause instanceof DOMException && cause.name === 'TimeoutError';
      setError(reason === 'SESSION_REQUIRED'
        ? (hi ? 'लॉगिन की जाँच नहीं हो पाई। दोबारा लॉगिन करें।' : 'Sign-in expired. Please log in again.')
        : reason === 'ROLE_NOT_ALLOWED'
          ? (hi ? 'इस अकाउंट में टेक्नीशियन की अनुमति नहीं है। सपोर्ट से संपर्क करें।' : 'Technician account access is not enabled. Contact support.')
          : timeout
            ? (hi ? 'जाँच में समय लग रहा है। इंटरनेट चेक करें और फिर कोशिश करें।' : 'Check your connection and retry.')
            : (hi ? 'अभी स्टेटस नहीं मिल पाया। रिफ्रेश करके देखें।' : 'Service status unavailable. Refresh to retry.'));
      lastChecked.current = Date.now();
    } finally {
      setLoadingUser((previous) => previous === userId ? null : previous);
    }
  }, [enabled, userId, hi]);

  useEffect(() => {
    if (!enabled || !userId) return;
    void refresh(true);
    const visible = () => document.visibilityState === 'visible' && navigator.onLine;
    const onReturn = () => {
      if (visible() && Date.now() - lastChecked.current >= 12_000) void refresh(true);
    };
    const onOnline = () => { if (visible()) void refresh(true); };
    const onDocumentChange = () => { if (visible()) void refresh(true); };
    const poll = window.setInterval(() => { if (visible()) void refresh(true); }, REFRESH_MS);
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    window.addEventListener('online', onOnline);
    window.addEventListener('aurotap:verification-changed', onDocumentChange);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('aurotap:verification-changed', onDocumentChange);
    };
  }, [enabled, userId, refresh]);

  if (!enabled) return null;
  const approved = data?.approved ?? [];
  const verified = approved.length > 0 && data?.profile.active === true && data?.profile.verification === 'approved';
  const docs = data?.documents;
  const hasPendingApplication = data?.application && ['pending','pending_approval'].includes(data.application.status);
  const docsReady = docs?.status === 'approved';
  const title = verified
    ? (hi ? 'काम के लिए मंज़ूरी मिल गई' : 'Approved for service jobs')
    : docsReady
      ? (hi ? 'दस्तावेज़ मंज़ूर · सर्विस की मंज़ूरी बाकी' : 'Documents approved · service approval pending')
      : docs?.status === 'under_review'
        ? (hi ? 'दस्तावेज़ जाँच में हैं' : 'Documents under review')
        : docs?.status === 'rejected'
          ? (hi ? 'दस्तावेज़ दोबारा भेजें' : 'Update rejected documents')
          : (hi ? 'पहचान और सर्विस की जाँच बाकी है' : 'Identity and service approval pending');

  return <section aria-label="Professional verification and service approval" className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{hi ? 'मेरे अकाउंट का स्टेटस' : 'Professional account status'}</p>
        <h2 className="mt-1 text-base font-bold sm:text-lg">{loading && !data ? (hi ? 'स्टेटस चेक हो रहा है…' : 'Checking live status…') : title}</h2>
        {docs && <p className="mt-1 text-xs text-slate-600">{hi ? 'पहचान की जाँच' : 'Identity documents'}: {docs.approved_count}/{docs.required_count} {hi ? 'मंज़ूर' : 'approved'} · {hi ? 'सर्विस मंज़ूरी' : 'Approved services'}: {approved.length}</p>}
      </div>
      <button type="button" onClick={() => void refresh(true)} disabled={loading}
        className="min-h-10 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold disabled:opacity-50">
        {loading ? (hi ? 'चेक हो रहा है…' : 'Checking…') : (hi ? 'फिर चेक करें' : 'Refresh')}
      </button>
    </div>
    {error && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">{error}
      <Link href="/auth/login?returnTo=%2Ftechnician%2Fdashboard" className="ml-2 font-bold underline">{hi ? 'लॉगिन' : 'Sign in'}</Link>
    </div>}
    {data && <div className="mt-3 space-y-3">
      {verified ? <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
        {hi ? 'आप इन सेवाओं में काम ले सकते हैं: ' : 'You can receive jobs for: '}
        <strong>{approved.map(x => label(x.service_key, hi)).join(', ')}</strong>.
      </div> : docsReady ? <div className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
        {hasPendingApplication
          ? (hi ? 'आपका सर्विस आवेदन एडमिन की जाँच में है। दस्तावेज़ दोबारा भेजने की ज़रूरत नहीं है।' : 'Your service application is under admin review. No need to upload the same documents again.')
          : (hi ? 'आपके तीनों दस्तावेज़ मंज़ूर हैं। अब अपना काम चुनकर सर्विस मंज़ूरी का आवेदन करें। सिर्फ दस्तावेज़ मंज़ूर होने से नई जॉब नहीं मिलेगी।' : 'All three identity documents are approved. Apply for service eligibility; KYC alone does not activate job dispatch.')}
      </div> : <p className="text-sm text-slate-600">{hi ? 'दस्तावेज़ की जाँच और काम की मंज़ूरी अलग-अलग हैं।' : 'Identity-document review and permission to accept jobs are separate checks.'}</p>}
      {data.other_capabilities.length > 0 && <p className="text-xs text-slate-600">{data.other_capabilities.map(x => `${label(x.service_key, hi)}: ${x.status}`).join(' · ')}</p>}
      {data.application?.rejection_note && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{data.application.rejection_note}</p>}
      {docsReady && !hasPendingApplication &&
        <Link href="/technician/services/apply" className="inline-flex min-h-10 items-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white">
          {hi ? 'नई सर्विस की मंज़ूरी लें' : 'Request service approval'}
        </Link>}
    </div>}
    {data && <details className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
      <summary className="cursor-pointer font-semibold text-emerald-800">{hi ? 'पंजीकृत ईमेल और शहर देखें' : 'Registered email & service city'}</summary>
      <p className="mt-2 break-all">{hi ? 'पंजीकृत ईमेल' : 'Registered email'}: <strong>{data.profile.email || (hi ? 'उपलब्ध नहीं' : 'Not provided')}</strong></p>
      <p className="mt-1">{hi ? 'शहर' : 'City'}: <strong>{data.profile.city || (hi ? 'दर्ज नहीं' : 'Not registered')}</strong></p>
      <p className="mt-1">{hi ? 'खाते की मंज़ूरी' : 'Account verification'}: <strong>{data.profile.verification || (hi ? 'बाकी' : 'Pending')}</strong></p>
    </details>}
    <nav aria-label={hi ? 'अकाउंट लिंक' : 'Account links'} className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs font-semibold text-emerald-700 sm:text-sm">
      <Link href="/technician/settings" className="underline">{hi ? 'सेटिंग्स' : 'Settings'}</Link>
      <Link href="/technician/services/apply" className="underline">{hi ? 'सर्विस मंज़ूरी' : 'Service approvals'}</Link>
      <Link href="/technician/dashboard#documents" className="underline">{hi ? 'दस्तावेज़' : 'Documents'}</Link>
      <Link href="/technician/dashboard#my_jobs" className="underline">{hi ? 'मेरे काम' : 'My jobs'}</Link>
      <Link href="/notifications" className="underline">{hi ? 'जॉब अलर्ट' : 'Job alerts'}</Link>
      <Link href="/contact?subject=technician" className="underline">{hi ? 'सहायता' : 'Support'}</Link>
    </nav>
    <p className="mt-2 text-[11px] text-slate-500">{hi ? 'ऐप खुले होने पर स्टेटस खुद अपडेट होता है।' : 'Status refreshes automatically while this page is visible.'}</p>
  </section>;
}
