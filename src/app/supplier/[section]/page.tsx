'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatSupplierSchedule } from '@/lib/supplier/schedule-display';
import { DEFAULT_CONTACT, whatsappHref } from '@/lib/contact-shared';
import PartnerPostalLookup from '@/components/geo/PartnerPostalLookup';
import PartnerJourney from '@/components/operations/PartnerJourney';
import { useParams } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { createClient } from '@/lib/supabase/client';

/* ───────────────────────── Types & config ───────────────────────── */

type Section = 'orders' | 'inventory' | 'earnings' | 'dispatch' | 'settings' | 'analytics' | 'support';
type Row = Record<string, unknown>;
type Status = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'delivered' | 'cancelled' | string;

const SECTIONS: Record<Section, { nav: string; title: string; subtitle: string; endpoint: string }> = {
  orders: { nav: 'Orders', title: 'Order management', subtitle: 'Assigned water orders, schedules and status. New assignments appear when dispatch eligibility is met.', endpoint: '/api/supplier/orders' },
  inventory: { nav: 'Inventory', title: 'Inventory control', subtitle: 'Current stock and reservations.', endpoint: '/api/supplier/stock' },
  earnings: { nav: 'Earnings', title: 'Earnings & payouts', subtitle: 'This month’s earnings and payout requests.', endpoint: '/api/supplier/earnings?period=month' },
  dispatch: { nav: 'Dispatch', title: 'Live dispatch control', subtitle: 'Availability, delivery coverage, location and order readiness.', endpoint: '/api/supplier/settings' },
  settings: { nav: 'Settings', title: 'Supplier account & preferences', subtitle: 'Review verified account, payout responsibility, delivery preferences and support.', endpoint: '/api/supplier/settings' },
  analytics: { nav: 'Performance', title: 'Local performance & planning', subtitle: 'Your verified orders, conservative stock planning, accepted delivery batches and suggested coverage gaps.', endpoint: '/api/supplier/intelligence' },
  support: { nav: 'Support', title: 'Supplier support', subtitle: 'Fix common dispatch problems or contact your administrator.', endpoint: '/api/supplier/settings' },
};
const ORDER = Object.keys(SECTIONS) as Section[];

const POLL_MS = 30_000; // Realtime is primary; polling is a lightweight safety net.
const UPI_RE = /^[a-z0-9._-]{2,256}@[a-z][a-z0-9]{1,63}$/i;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_RE = /^\d{9,18}$/;

/* ───────────────────────── Helpers ───────────────────────── */

const str = (v: unknown, fallback = '') => (v === null || v === undefined || v === '' ? fallback : String(v));
const norm = (v: unknown): Status => str(v).toLowerCase();
const money = (v: unknown) => '₹' + Number(v ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const num = (v: unknown) => (v === undefined || v === null ? '—' : String(v));
const label = (s: string) => s.replaceAll('_', ' ');
const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

/* ───────────────────────── Page ───────────────────────── */

export default function SupplierSectionPage() {
  const { language } = useLanguage();
  const isHindi = language === 'hi';
  const params = useParams<{ section: string }>();
  const section = params.section as Section;
  const meta = SECTIONS[section];

  // One stable client for the lifetime of the page (a new client per render would re-trigger load()).
  const supabase = useMemo(() => createClient(), []);

  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [online, setOnline] = useState(false);
  const [radius, setRadius] = useState('5');
  const latest = useRef(0);
  const hasData = useRef(false);
  const backgroundFetchInFlight = useRef(false);

  const authedFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error('Your session has expired. Sign in again to continue.');
      const res = await fetch(path, {
        ...init,
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(body?.error ?? body?.message ?? 'Request failed. Try again.', res.status);
      return body;
    },
    [supabase],
  );

  const load = useCallback(
    async (silent = false) => {
      if (!meta || (silent && backgroundFetchInFlight.current)) return;
      if (silent) backgroundFetchInFlight.current = true;
      const id = ++latest.current;
      // First load may use a skeleton; refreshes keep the current section visible.
      if (!silent && !hasData.current) setLoading(true);
      try {
        const body = await authedFetch(meta.endpoint);
        if (id !== latest.current) return; // a newer request superseded this one
        const payload = body?.data ?? body;
        setData(payload);
        hasData.current = true;
        if (!silent) setError('');
        if ((section === 'settings' || section === 'dispatch') && payload && typeof payload === 'object') {
          setOnline(Boolean((payload as Row).is_online));
          setRadius(String((payload as Row).zone_radius_km ?? 5));
        }
      } catch (e) {
        // Background polling is intentionally silent; retain data and avoid flashing errors.
        if (id === latest.current && !silent) setError(errMsg(e, 'Unable to load this page.'));
      } finally {
        if (silent) backgroundFetchInFlight.current = false;
        if (id === latest.current) setLoading(false);
      }
    },
    [meta, section, authedFetch],
  );

  useEffect(() => { void load(); }, [load]);

  // Keep the orders list fresh while the tab is visible.
  useEffect(() => {
    if (section !== 'orders') return;
    const t = setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine) void load(true); }, POLL_MS);
    return () => clearInterval(t);
  }, [section, load]);

  const send = useCallback(
    async (path: string, method: string, payload: Row, okMessage = 'Saved.', onFail?: (e: unknown) => void) => {
      setBusy(true); setNotice(''); setError('');
      try {
        const body = await authedFetch(path, { method, body: JSON.stringify(payload) });
        setNotice(body?.data?.message ?? okMessage);
        await load(true);
        return true;
      } catch (e) {
        setError(errMsg(e, 'Request failed.'));
        onFail?.(e);
        void load(true); // state may be stale (e.g. 409 after reassignment): resync the list
        return false;
      } finally {
        setBusy(false);
      }
    },
    [authedFetch, load],
  );

  if (!meta) {
    return (
      <main className="sp"><Styles />
        <h1 className="sp-h1">Page not found</h1>
        <Link href="/supplier/dashboard" className="sp-link">Back to dashboard</Link>
      </main>
    );
  }

  const rows = Array.isArray(data) ? (data as Row[]) : [];
  const obj = data && typeof data === 'object' && !Array.isArray(data) ? (data as Row) : {};

  const sectionCopy: Record<Section, { nav: string; title: string; subtitle: string }> = {
    orders: { nav: 'ऑर्डर', title: 'ऑर्डर प्रबंधन', subtitle: 'आपको दिए गए ऑर्डर, समय और डिलीवरी की स्थिति। नए ऑर्डर उपलब्धता और पात्रता के अनुसार दिखते हैं।' },
    inventory: { nav: 'स्टॉक', title: 'स्टॉक प्रबंधन', subtitle: 'उपलब्ध स्टॉक और आरक्षित कैन की जानकारी।' },
    earnings: { nav: 'कमाई', title: 'कमाई और भुगतान', subtitle: 'इस महीने की कमाई और भुगतान अनुरोध।' },
    dispatch: { nav: 'डिस्पैच', title: 'लाइव डिस्पैच कंट्रोल', subtitle: 'ऑनलाइन स्थिति, सेवा क्षेत्र, लोकेशन और ऑर्डर पात्रता।' },
    settings: { nav: 'सेटिंग', title: 'सप्लायर खाता और सुविधाएँ', subtitle: 'अपना प्रोफ़ाइल, भुगतान प्रक्रिया और सहायता देखें।' },
    analytics: { nav: 'प्रदर्शन', title: 'स्थानीय प्रदर्शन और योजना', subtitle: 'ऑर्डर, स्टॉक अनुमान, डिलीवरी ग्रुप और सेवा क्षेत्र के अवसर।' },
    support: { nav: 'सहायता', title: 'सप्लायर सहायता', subtitle: 'डिस्पैच समस्या हल करें या एडमिन से संपर्क करें।' },
  };
  const copy = isHindi ? sectionCopy[section] : meta;

  return (
    <main className="sp" data-supplier-language>
      <Styles />
      <header className="sp-head">
        <div className="sp-head-row">
          <div className="sp-head-copy">
            <p className="sp-kicker">{isHindi ? 'AuroTap सप्लायर पोर्टल' : 'AuroTap supplier portal'}</p>
            <h1 className="sp-h1">{copy.title}</h1>
            <p className="sp-sub">{copy.subtitle}</p>
          </div>
        </div>
      </header>

      <PartnerJourney role="supplier" isHindi={isHindi} />

      <div className="mt-4 flex justify-end">
        <button className="sp-btn sp-btn--ghost sp-refresh" onClick={() => void load()} disabled={busy || (loading && !hasData.current)} aria-label={isHindi ? 'पेज रीफ्रेश करें' : 'Refresh supplier section'}>
          {loading && !hasData.current ? (isHindi ? 'लोड हो रहा है…' : 'Loading…') : (isHindi ? 'रीफ्रेश' : 'Refresh')}
        </button>
      </div>

      {section === 'dispatch' && <div className="mt-4"><PartnerPostalLookup label={isHindi ? 'पिन कोड डायरेक्टरी' : 'Delivery area PIN directory'} /></div>}

      <div aria-live="polite">
        {error && <div role="alert" className="sp-msg sp-msg--err">{error}</div>}
        {notice && <div role="status" className="sp-msg sp-msg--ok">{notice}</div>}
      </div>

      {loading && !data ? <Skeleton /> : (
        <>
          {section === 'orders' && <Orders rows={rows} busy={busy} send={send} language={language} />}
          {section === 'inventory' && <Inventory obj={obj} busy={busy} send={send} setError={setError} />}
          {section === 'earnings' && <Earnings obj={obj} busy={busy} send={send} setError={setError} />}
          {section === 'dispatch' && <DispatchControl obj={obj} online={online} radius={radius} setRadius={setRadius} busy={busy} send={send} setError={setError} />}
          {section === 'settings' && <AccountSettings obj={obj} />}
          {section === 'analytics' && <Analytics insight={obj} />}
          {section === 'support' && <Support />}
        </>
      )}
    </main>
  );
}

/* ───────────────────────── Orders ───────────────────────── */

type Send = (path: string, method: string, payload: Row, okMessage?: string, onFail?: (e: unknown) => void) => Promise<boolean>;

function Orders({ rows, busy, send, language }: { rows: Row[]; busy: boolean; send: Send; language: 'en' | 'hi' }) {
  // Optimistic status overrides: the button advances instantly, and rolls back if the server refuses.
  const [override, setOverride] = useState<Record<string, Status>>({});
  // Orders whose accept/decline choice is settled (done, or the server said 409). Hides those buttons.
  const [decided, setDecided] = useState<Set<string>>(new Set());
  const markDecided = (id: string) => setDecided((s) => new Set(s).add(id));

  const decide = async (id: string, action: 'accept' | 'reject') => {
    const ok = await send(
      `/api/supplier/orders/${encodeURIComponent(id)}/${action}`,
      'PUT',
      action === 'reject' ? { reason: 'Supplier declined' } : {},
      action === 'accept' ? 'Order accepted.' : 'Order declined.',
      (e) => { if (e instanceof ApiError && e.status === 409) markDecided(id); },
    );
    if (ok) markDecided(id);
  };

  const [refs, setRefs] = useState<Record<string, string>>({}); // UPI transaction references by order id

  const advance = async (id: string, next: Status, okMessage: string, extra: Row = {}) => {
    setOverride((o) => ({ ...o, [id]: next }));
    const ok = await send(`/api/supplier/orders/${encodeURIComponent(id)}/status`, 'PUT', { status: next.toUpperCase(), ...extra }, okMessage);
    setOverride((o) => { const { [id]: _drop, ...rest } = o; return rest; }); // server data is now the source of truth
    return ok;
  };

  if (rows.length === 0) {
    return (
      <Empty
        title={language === 'hi' ? 'अभी कोई ऑर्डर नहीं मिला' : 'No assigned orders yet'}
        text={language === 'hi' ? 'ऑर्डर मिलने के लिए ऑनलाइन हों, लोकेशन, सेवा क्षेत्र और स्टॉक की पुष्टि करें, फिर रीफ्रेश करें।' : 'Orders arrive when dispatch assigns one to you. Go online, confirm your location, radius and stock, then refresh.'}
        href="/supplier/dispatch"
        cta={language === 'hi' ? 'डिस्पैच खोलें' : 'Open dispatch'}
      />
    );
  }

  return (
    <section className="sp-grid">
      {rows.map((o, i) => {
        const id = str(o.id);
        const status = override[id] ?? norm(o.status);
        // Accept/decline only while the order is still awaiting a decision. The API answers 409 once it is accepted.
        const acceptedFlag = Boolean(o.accepted_at ?? o.supplier_accepted_at ?? o.is_accepted);
        const canAccept = !decided.has(id) && (status === 'pending' || (status === 'assigned' && !acceptedFlag));
        const deliveryAddress = str(o.address_text ?? o.address_line ?? o.address);
        const canNavigate = Boolean(deliveryAddress && deliveryAddress !== 'Address on order' && (acceptedFlag || status === 'in_progress'));
        const directionsHref = canNavigate
          ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(deliveryAddress)}`
          : null;
        return (
          <article key={id || i} className="sp-card">
            <div className="sp-row">
              <h2 className="sp-h2">Order #{str(o.order_number ?? o.booking_id, '—')}</h2>
              <StatusBadge status={status} />
            </div>
            <dl className="sp-dl">
              <dt>{language === 'hi' ? 'सेवा' : 'Service'}</dt><dd>{str(o.service_type_label ?? o.service_type, language === 'hi' ? 'पानी का ऑर्डर' : 'Water order')}</dd>
              <dt>{language === 'hi' ? 'ग्राहक' : 'Customer'}</dt><dd>{str(o.customer_name, language === 'hi' ? 'ग्राहक' : 'Customer')}{o.customer_phone ? <> · <a className="sp-a" href={`tel:${str(o.customer_phone)}`}>{str(o.customer_phone)}</a></> : null}</dd>
              <dt>{language === 'hi' ? 'पता' : 'Address'}</dt><dd>{deliveryAddress || (language === 'hi' ? 'पता स्वीकार करने के बाद उपलब्ध होगा' : 'Address on order')}</dd>
              <dt>{language === 'hi' ? 'भुगतान' : 'Payment'}</dt><dd>{norm(o.payment_status) === 'paid' ? (language === 'hi' ? 'भुगतान हो गया' : 'Paid') : (language === 'hi' ? `डिलीवरी पर भुगतान (${str(o.payment_method, 'cash').toUpperCase()})` : `Collect on delivery (${str(o.payment_method, 'cash').toUpperCase()})`)}</dd>
              <dt>{language === 'hi' ? 'समय' : 'Slot'}</dt><dd>{formatSupplierSchedule(o.scheduled_at ?? o.scheduled_date, o.time_slot ?? o.scheduled_slot, language)}</dd>
            </dl>
            <p className="sp-amount">{money(o.final_amount ?? o.total_amount ?? o.amount)}</p>

            <div className="sp-actions">
              {directionsHref && <a className="sp-link" href={directionsHref} target="_blank" rel="noopener noreferrer">{language === 'hi' ? 'डिलीवरी के लिए रास्ता खोलें' : 'Navigate to delivery'}</a>}
              {canAccept && (
                <button className="sp-btn" disabled={busy} onClick={() => void decide(id, 'accept')}>
                  {language === 'hi' ? 'ऑर्डर स्वीकार करें' : 'Accept order'}
                </button>
              )}
              {status === 'assigned' && (
                <button className="sp-btn sp-btn--go" disabled={busy} disabled={busy || !acceptedFlag} onClick={() => void advance(id, 'in_progress', language === 'hi' ? 'डिलीवरी शुरू हुई।' : 'Delivery started.')}>
                  {language === 'hi' ? 'डिलीवरी शुरू करें' : 'Start delivery'}
                </button>
              )}
              {status === 'in_progress' && (() => {
                const paid = norm(o.payment_status) === 'paid';
                const upi = norm(o.payment_method) === 'upi';
                const ref = (refs[id] ?? '').trim();
                const amount = money(o.final_amount ?? o.total_amount ?? o.amount);
                return (
                  <>
                    {!paid && upi && (
                      <label className="sp-field" style={{ flexBasis: '100%', margin: 0 }} htmlFor={`ref-${id}`}>{language === 'hi' ? 'UPI लेन-देन संदर्भ' : 'UPI transaction reference'}
                        <input id={`ref-${id}`} className="sp-input" autoComplete="off" value={refs[id] ?? ''} onChange={(e) => setRefs((r) => ({ ...r, [id]: e.target.value }))} />
                      </label>
                    )}
                    <Confirm
                      className="sp-btn sp-btn--amber"
                      confirmText={paid ? (language === 'hi' ? 'डिलीवरी की पुष्टि के लिए फिर दबाएँ' : 'Tap again to confirm delivery') : (language === 'hi' ? `फिर दबाएँ: ${amount} प्राप्त हुए` : `Tap again: ${amount} received`)}
                      disabled={busy || (!paid && upi && !ref)}
                      onConfirm={() => void advance(id, 'completed', language === 'hi' ? 'ऑर्डर डिलीवर हो गया।' : 'Order delivered.', paid ? {} : { payment_confirmed: true, ...(ref ? { payment_reference: ref } : {}) })}
                    >
                      <span className="sp-pulse" aria-hidden /> {language === 'hi' ? 'डिलीवरी पूरी करें' : 'Complete delivery'}
                    </Confirm>
                  </>
                );
              })()}
              {(status === 'completed' || status === 'delivered') && (
                <button className="sp-btn sp-btn--ghost" disabled>{language === 'hi' ? 'डिलीवर हो गया' : 'Delivered'}</button>
              )}
              {canAccept && (
                <Confirm className="sp-btn sp-btn--ghost" confirmText={language === 'hi' ? 'रद्द करने के लिए फिर दबाएँ' : 'Tap again to decline'} disabled={busy}
                  onConfirm={() => void decide(id, 'reject')}>
                  {language === 'hi' ? 'ऑर्डर अस्वीकार करें' : 'Decline'}
                </Confirm>
              )}
            </div>
            {status === 'in_progress' && <p className="sp-hint">{language === 'hi' ? 'डिलीवरी जारी है' : 'Delivery in progress'}</p>}
          </article>
        );
      })}
    </section>
  );
}

/* ───────────────────────── Inventory ───────────────────────── */

function Inventory({ obj, busy, send, setError }: { obj: Row; busy: boolean; send: Send; setError: (s: string) => void }) {
  const { language } = useLanguage();
  const isHindi = language === 'hi';
  const [delta, setDelta] = useState('');
  const submit = async () => {
    const n = Number(delta);
    if (!Number.isInteger(n) || n === 0) return setError(isHindi ? 'शून्य के अलावा पूरा नंबर डालें, जैसे 10 या -1।' : 'Enter a non-zero whole number, such as 10 or -1.');
    if (await send('/api/supplier/stock', 'PUT', { stock_delta: n }, isHindi ? 'स्टॉक अपडेट हो गया।' : 'Stock updated.')) setDelta('');
  };
  return (
    <section className="sp-grid">
      {obj.low_stock === true && (
        <div role="status" className="sp-msg sp-msg--err sp-wide">
          {isHindi ? 'स्टॉक कम है:' : 'Stock is low:'} {num(obj.cans_available)} {isHindi ? 'कैन बचे हैं (अलर्ट स्तर' : 'cans left (alert at'} {num(obj.low_stock_alert)}). {isHindi ? 'ऑर्डर मिलते रहने के लिए स्टॉक भरें।' : 'Restock to keep receiving orders.'}
        </div>
      )}
      <Metric name={isHindi ? 'उपलब्ध कैन' : 'Available cans'} value={num(obj.cans_available)} />
      <Metric name={isHindi ? 'आरक्षित कैन' : 'Reserved cans'} value={num(obj.reserved_cans)} />
      <Metric name={isHindi ? 'कम-स्टॉक अलर्ट' : 'Low-stock alert at'} value={num(obj.low_stock_alert)} />
      <Metric name={isHindi ? 'रिज़र्व बफर' : 'Reservation buffer'} value={num(obj.reservation_buffer_cans)} />
      <article className="sp-card sp-wide">
        <h2 className="sp-h2">{isHindi ? 'स्टॉक बदलें' : 'Adjust stock'}</h2>
        <p className="sp-sub">{isHindi ? 'कैन जोड़ने के लिए पॉज़िटिव नंबर और ऑफलाइन बिक्री दर्ज करने के लिए नेगेटिव नंबर डालें। आरक्षण की जाँच सर्वर पर होगी।' : 'Enter a positive number to add cans, or a negative number to record an offline sale. Reservation checks still apply on the server.'}</p>
        <div className="sp-chips" role="group" aria-label={isHindi ? 'जल्दी मात्रा चुनें' : 'Quick amounts'}>
          {[10, 25, 50, -1].map((n) => (
            <button key={n} type="button" className="sp-btn sp-btn--ghost" onClick={() => setDelta(String(n))}>{n > 0 ? `+${n}` : n}</button>
          ))}
        </div>
        <div className="sp-inline">
          <label className="sp-field" htmlFor="stock-delta">{isHindi ? 'कैन में बदलाव' : 'Change in cans'}
            <input id="stock-delta" className="sp-input" type="number" step={1} inputMode="numeric" placeholder="10 or -1" value={delta} onChange={(e) => setDelta(e.target.value)} />
          </label>
          <button className="sp-btn" disabled={busy} onClick={() => void submit()}>{busy ? (isHindi ? 'अपडेट हो रहा है…' : 'Updating…') : (isHindi ? 'स्टॉक अपडेट करें' : 'Update stock')}</button>
        </div>
      </article>
    </section>
  );
}

/* ───────────────────────── Earnings ───────────────────────── */

function Earnings({ obj, busy, send, setError }: { obj: Row; busy: boolean; send: Send; setError: (s: string) => void }) {
  const { language } = useLanguage();
  const isHindi = language === 'hi';
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'upi' | 'bank'>('upi');
  const [upi, setUpi] = useState('');
  const [account, setAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const payoutReview = obj.balance_requires_review === true;
  const verifiedBalance = typeof obj.pending_payout === 'number' && Number.isFinite(obj.pending_payout) ? obj.pending_payout : null;

  const submit = async () => {
    if (payoutReview || verifiedBalance === null || verifiedBalance <= 0) return setError('No verified transferable balance. Check the settlement explanation below.');
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0 || n > verifiedBalance) return setError(isHindi ? 'सत्यापित उपलब्ध राशि से अधिक भुगतान का अनुरोध नहीं कर सकते।' : 'Payout amount must be positive and within the verified balance.');
    if (method === 'upi' && !UPI_RE.test(upi.trim())) return setError(isHindi ? 'सही UPI ID डालें, जैसे name@bank।' : 'Enter a valid UPI ID, for example name@bank.');
    if (method === 'bank' && !ACCOUNT_RE.test(account.trim())) return setError(isHindi ? 'बैंक खाता संख्या 9 से 18 अंकों की होनी चाहिए।' : 'Bank account numbers have 9 to 18 digits.');
    if (method === 'bank' && !IFSC_RE.test(ifsc.trim())) return setError(isHindi ? '11 अक्षरों का सही IFSC डालें, जैसे HDFC0001234।' : 'Enter a valid 11-character IFSC, for example HDFC0001234.');
    const payload = method === 'upi' ? { amount: n, method, upi_id: upi.trim() } : { amount: n, method, bank_account: account.trim(), ifsc: ifsc.trim() };
    if (await send('/api/supplier/payouts', 'POST', payload, isHindi ? 'भुगतान अनुरोध भेज दिया गया।' : 'Payout request submitted.')) {
      setAmount(''); setUpi(''); setAccount(''); setIfsc('');
    }
  };

  return (
    <section className="sp-grid">
      <Metric name={isHindi ? 'पूरे हुए ऑर्डर' : 'Completed orders'} value={num(obj.order_count)} />
      <Metric name={isHindi ? 'कुल कमाई' : 'Gross earnings'} value={money(obj.gross_amount)} />
      <Metric name={isHindi ? 'निकालने योग्य बैलेंस' : 'Available for payout'} value={payoutReview || verifiedBalance === null ? 'Needs review' : money(verifiedBalance)} />
      <article className="sp-card sp-wide">
        <h2 className="sp-h2">{isHindi ? 'भुगतान अनुरोध करें' : 'Request a payout'}</h2>
        <p role="status" className="sp-sub">{str(obj.payout_message, 'Payout availability has not been verified.')}</p>
        <p className="sp-sub">{isHindi ? 'अनुरोध भेजने से पैसे ट्रांसफर नहीं होते। एडमिन बाद में इसे प्रोसेस करता है।' : 'Submitting a request does not move money. The administrator processes it afterwards.'}</p>
        <label className="sp-field" htmlFor="po-amount">{isHindi ? 'राशि (₹)' : 'Amount (₹)'}
          <input id="po-amount" className="sp-input" type="number" min={0.01} max={verifiedBalance ?? undefined} disabled={payoutReview || verifiedBalance === null || verifiedBalance <= 0} step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="sp-field" htmlFor="po-method">{isHindi ? 'भुगतान का तरीका' : 'Payout method'}
          <select id="po-method" className="sp-input" value={method} onChange={(e) => setMethod(e.target.value as 'upi' | 'bank')}>
            <option value="upi">UPI</option>
            <option value="bank">{isHindi ? 'बैंक खाता' : 'Bank account'}</option>
          </select>
        </label>
        {method === 'upi' ? (
          <label className="sp-field" htmlFor="po-upi">UPI ID
            <input id="po-upi" className="sp-input" autoComplete="off" value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@bank" />
          </label>
        ) : (
          <>
            <label className="sp-field" htmlFor="po-acc">{isHindi ? 'बैंक खाता संख्या' : 'Bank account number'}
              <input id="po-acc" className="sp-input" autoComplete="off" inputMode="numeric" value={account} onChange={(e) => setAccount(e.target.value.replace(/\D/g, ''))} />
            </label>
            <label className="sp-field" htmlFor="po-ifsc">IFSC
              <input id="po-ifsc" className="sp-input" autoComplete="off" maxLength={11} value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} />
            </label>
          </>
        )}
        <button className="sp-btn" disabled={busy || payoutReview || verifiedBalance === null || verifiedBalance <= 0} onClick={() => void submit()}>{busy ? (isHindi ? 'भेजा जा रहा है…' : 'Submitting…') : (isHindi ? 'भुगतान अनुरोध भेजें' : 'Submit payout request')}</button>
      </article>
    </section>
  );
}

/* ───────────────────────── Settings ───────────────────────── */

function DispatchControl(p: { obj: Row; online: boolean; radius: string; setRadius: (s: string) => void; busy: boolean; send: Send; setError: (s: string) => void }) {
  const { language } = useLanguage();
  const isHindi = language === 'hi';
  const saveRadius = () => {
    const n = Number(p.radius);
    if (!Number.isInteger(n) || n < 1 || n > 100) return p.setError(isHindi ? 'सेवा त्रिज्या 1 से 100 किमी के बीच पूरा नंबर होनी चाहिए।' : 'Service radius must be a whole number from 1 to 100 km.');
    void p.send('/api/supplier/settings', 'PUT', { zone_radius_km: n }, isHindi ? 'सेवा त्रिज्या सेव हो गई।' : 'Service radius saved.');
  };
  return (
    <section className="sp-grid">
      <article className="sp-card">
        <h2 className="sp-h2">{isHindi ? 'उपलब्धता' : 'Availability'}</h2>
        <p className="sp-sub">{isHindi ? 'ऑनलाइन सप्लायर को नए ऑर्डर मिल सकते हैं। लंबित ऑर्डर आपके ऑनलाइन होने पर फिर जाँचे जा सकते हैं।' : 'Online suppliers can receive new orders. Pending orders are retried when you go online.'}</p>
        <div className="sp-row">
          <StatusBadge status={p.online ? 'online' : 'offline'} />
          <button className="sp-btn" disabled={p.busy} onClick={() => void p.send('/api/supplier/settings', 'PUT', { is_online: !p.online }, p.online ? (isHindi ? 'आप ऑफलाइन हैं।' : 'You are offline.') : (isHindi ? 'आप ऑनलाइन हैं।' : 'You are online.'))}>
            {p.online ? (isHindi ? 'ऑफलाइन हों' : 'Go offline') : (isHindi ? 'ऑनलाइन हों' : 'Go online')}
          </button>
        </div>
        <label className="sp-field" htmlFor="radius">{isHindi ? 'सेवा त्रिज्या (किमी)' : 'Service radius (km)'}
          <input id="radius" className="sp-input" type="number" min={1} max={100} value={p.radius} onChange={(e) => p.setRadius(e.target.value)} />
        </label>
        <button className="sp-btn" disabled={p.busy} onClick={saveRadius}>{isHindi ? 'त्रिज्या सेव करें' : 'Save radius'}</button>
        <p className="sp-hint">{isHindi ? 'डिस्पैच लोकेशन बदलने के लिए डैशबोर्ड पर लोकेशन बटन का उपयोग करें।' : 'To change your dispatch location, use the location button on the dashboard.'}</p>
      </article>
      <article className="sp-card">
        <h2 className="sp-h2">{isHindi ? 'ऑर्डर प्राप्त करने की तैयारी' : 'Ready to receive orders?'}</h2>
        <p className="sp-sub">This checklist is operational guidance, not a guarantee. Matching also checks approved zones, workload, exact location and atomic stock reservation.</p>
        {Array.isArray((p.obj.readiness as Row | undefined)?.checks) ?
          <ul className="space-y-3">{((p.obj.readiness as Row).checks as { key:string; ok:boolean; label:string; fix:string }[])
            .filter(c => !['price','payout'].includes(c.key)).map(c =>
            <li key={c.key} className="rounded-xl border border-white/10 p-3">
              <span className={c.ok ? 'text-emerald-300' : 'text-amber-300'}>{c.ok ? '✓ ' : 'Needs attention · '}</span>
              <strong>{c.label}</strong>
              {!c.ok && <p className="mt-1 text-xs text-slate-300">{c.fix}</p>}
            </li>)}</ul> : <p className="text-amber-200">Readiness has not been verified.</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/supplier/coverage" className="sp-link">Approved service areas</Link>
          <Link href="/supplier/inventory" className="sp-link">Available stock</Link>
          <Link href="/supplier/orders" className="sp-link">Assigned orders</Link>
          <Link href="/supplier/dashboard" className="sp-link">Update base location</Link>
        </div>
        <p className="mt-3 text-xs text-slate-300">Base: {p.obj.base_lat == null || p.obj.base_lng == null ? 'Not verified' : 'Location saved'} · Service radius {p.radius} km</p>
      </article>
      <article className="sp-card sp-wide">
        <div className="flex flex-wrap items-center gap-4">
          <Image src="/images/water_can.webp" width={176} height={116} alt="Water-can delivery service" className="h-28 w-44 rounded-xl object-cover" sizes="176px" />
          <div><h2 className="sp-h2">Daily delivery workflow</h2>
          <p className="sp-sub">1. Go online → 2. Confirm stock and service area → 3. Review assigned orders → 4. Accept → 5. Deliver and record actual payment → 6. Review verified earnings.</p>
          <p className="text-xs text-amber-200">If you are online but do not receive orders, admin must inspect dispatch eligibility and unassigned backlog.</p></div>
        </div>
      </article>
    </section>
  );
}

function AccountSettings({ obj }: { obj: Row }) {
  const { language } = useLanguage();
  const isHindi = language === 'hi';
  const profile = obj.profile && typeof obj.profile === 'object' ? obj.profile as Row : {};
  return (
    <section className="sp-grid">
      <article className="sp-card">
        <h2 className="sp-h2">{isHindi ? 'मेरा व्यावसायिक खाता' : 'Business profile'}</h2>
        <p className="sp-sub">Account identity and approval are controlled through the verified supplier profile.</p>
        <dl className="sp-dl">
          <dt>Name</dt><dd>{str(profile.full_name, 'Not set')}</dd>
          <dt>City</dt><dd>{str(profile.city, 'Not set')}</dd>
          <dt>Contact</dt><dd>{str(profile.phone, 'Not set')}</dd>
        </dl>
        <Link href="/supplier/profile" className="sp-link">Manage profile and verification</Link>
      </article>
      <article className="sp-card">
        <h2 className="sp-h2">Payment and payout policy</h2>
        <p className="sp-sub">Customer prices are managed by AuroTap. Your own price-per-can field does not change customer checkout prices or dispatch ranking.</p>
        <p className="text-sm">Payout destination: {obj.has_payout_details ? 'Details saved (masked)' : 'Not configured'}</p>
        <p className="mt-2 text-sm">Supplier UPI/bank details are only payout destinations, not proof of payment. Customers should pay only via the method displayed on their confirmed order.</p>
        <Link href="/supplier/earnings" className="sp-link">Payout requests and verified balance</Link>
      </article>
      <article className="sp-card sp-wide">
        <h2 className="sp-h2">Useful supplier tools</h2>
        <div className="flex flex-wrap gap-4">
          <Link className="sp-link" href="/supplier/dispatch">Live dispatch controls</Link>
          <Link className="sp-link" href="/supplier/coverage">PIN coverage and approval</Link>
          <Link className="sp-link" href="/supplier/support">Support and troubleshooting</Link>
        </div>
      </article>
    </section>
  );
}

/* ───────────────────────── Analytics & support ───────────────────────── */

type Intelligence = {
  checked_at?: string;
  supplier_online?: boolean;
  stock?: { available: number; reserved: number; buffer: number; low_stock_alert: number };
  forecast?: { estimated_cans: number | null; confirmed_cans: number; suggested_target: number;
    free_stock: number; refill_suggestion: number; confidence: string; historical_deliveries: number } | null;
  performance?: { completed_orders: number; completed_water_cans: number;
    cancelled_orders: number; active_orders: number; accepted_offers: number;
    rejected_or_expired_offers: number; offer_acceptance_pct: number | null } | null;
  route_groups?: { date: string; slot: string; pincode: string; orders: number; cans: number }[];
  area_performance?: { zone_id: string; zone_name: string; city: string; completed: number; cancelled: number; active: number; delivered_cans: number }[];
  coverage_opportunities?: { zone_id: string; zone_name: string; city: string; request_count_30d: number;
    mapped_supplier_count: number; distance_km: number | null; already_mapped: boolean; action: string }[];
  data_quality?: { own_history_complete: boolean; route_groups_complete: boolean; coverage_sample_complete: boolean; area_performance_complete: boolean;
    forecast_note: string; coverage_note: string; route_note: string };
};

function Analytics({ insight }: { insight: Row }) {
  const { language } = useLanguage();
  const isHindi = language === 'hi';
  const result = insight as Intelligence;
  const summary = result.performance;
  const forecast = result.forecast;
  const quality = result.data_quality;
  const groups = result.route_groups ?? [];
  const opportunities = result.coverage_opportunities ?? [];
  const areas = result.area_performance ?? [];

  return (
    <section className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric name={isHindi ? 'पूरा किए ऑर्डर' : 'Completed orders'} value={summary ? String(summary.completed_orders) : 'Not verified'} />
        <Metric name={isHindi ? 'डिलीवर पानी कैन' : 'Delivered water cans'} value={summary ? String(summary.completed_water_cans) : 'Not verified'} />
        <Metric name={isHindi ? 'सक्रिय ऑर्डर' : 'Active orders'} value={summary ? String(summary.active_orders) : 'Not verified'} />
        <Metric name={isHindi ? 'स्वीकार किए ऑफर' : 'Accepted offers'} value={summary ? String(summary.accepted_offers) : 'Not verified'} />
      </div>

      <article className="sp-card">
        <h2 className="sp-h2">{isHindi ? 'ऑर्डर के लिए तैयार?' : 'Dispatch readiness signals'}</h2>
        <p className="sp-sub">Being online alone does not guarantee a new order. Dispatch still checks your approved service area, location, workload and stock atomically.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <p className={`rounded-lg p-3 text-sm font-bold ${result.supplier_online ? 'bg-emerald-900/30 text-emerald-200' : 'bg-amber-900/30 text-amber-200'}`}>
            Dispatch: {result.supplier_online ? 'Online' : 'Offline'}
          </p>
          <p className="rounded-lg bg-white/5 p-3 text-sm">
            Unreserved cans: {forecast ? forecast.free_stock : 'Not verified'}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/supplier/settings" className="sp-link">Review dispatch location</Link>
          <Link href="/supplier/coverage" className="sp-link">Check approved coverage</Link>
          <Link href="/supplier/inventory" className="sp-link">Update available stock</Link>
        </div>
      </article>

      <article className="sp-card">
        <h2 className="sp-h2">{isHindi ? 'कल का स्टॉक प्लान' : 'Tomorrow’s stock plan'}</h2>
        <p className="sp-sub">{isHindi ? 'पिछले 56 दिनों के पूरे ऑर्डर का सीमित अनुमान। यह पक्का ऑर्डर नहीं है।' : 'A conservative estimate from up to 56 days of your own completed deliveries. Not a promised order or purchase instruction.'}</p>
        {forecast ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric name={isHindi ? 'कल का अनुमान' : 'Estimated cans'} value={forecast.estimated_cans === null ? 'Insufficient history' : String(forecast.estimated_cans)} />
          <Metric name={isHindi ? 'पहले से निर्धारित' : 'Assigned for tomorrow'} value={String(forecast.confirmed_cans)} />
          <Metric name={isHindi ? 'फ्री स्टॉक' : 'Free stock'} value={String(forecast.free_stock)} />
          <Metric name={isHindi ? 'रीफिल सुझाव' : 'Suggested refill'} value={forecast.estimated_cans === null ? 'No forecast' : String(forecast.refill_suggestion)} />
        </div> : <p className="text-sm text-amber-300">Order history is incomplete. Stock forecast is not available.</p>}
        <p className="mt-3 text-xs text-slate-400">Forecast confidence: {forecast?.confidence ?? 'unverified'} · Stock changes require explicit Inventory updates. No automatic stock mutation.</p>
        <Link href="/supplier/inventory" className="sp-link">{isHindi ? 'स्टॉक खोलें' : 'Open inventory'}</Link>
      </article>

      <article className="sp-card">
        <h2 className="sp-h2">{isHindi ? 'डिलीवरी बैच' : 'Accepted delivery batches'}</h2>
        <p className="sp-sub">{isHindi ? 'केवल स्वीकार किए गए ऑर्डर, पिन कोड और समय के अनुसार ग्रुप। रूट की गारंटी नहीं।' : 'Only orders accepted by you, grouped by PIN and broad IST time window. This is not turn-by-turn navigation or an optimized route.'}</p>
        {quality?.route_groups_complete === false ? <p className="text-sm text-amber-300">Routing sample incomplete; grouping withheld.</p>
          : groups.length === 0 ? <p className="text-sm text-slate-300">No eligible accepted water deliveries in the next seven days.</p>
          : <div className="grid gap-2 sm:grid-cols-2">
            {groups.map(group => <div key={group.date + group.slot + group.pincode} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="font-bold">{group.date} · {group.slot} IST</p>
              <p className="mt-1 text-sm text-slate-300">PIN {group.pincode} · {group.orders} orders · {group.cans} cans</p>
              <Link href="/supplier/orders" className="sp-link">Open assigned orders</Link>
            </div>)}
          </div>}
      </article>

      <article className="sp-card">
        <h2 className="sp-h2">{isHindi ? 'नए क्षेत्र के अवसर' : 'Coverage gap opportunities'}</h2>
        <p className="sp-sub">{isHindi ? 'सिर्फ पर्याप्त समूह मांग और कम मैपिंग वाले क्षेत्र दिखते हैं। एडमिन स्वीकृति ज़रूरी है।' : 'Recent 30-day demand with at least five distinct customers and limited supplier mappings. Suggestions do not grant permission to serve a new area.'}</p>
        {!quality?.coverage_sample_complete ? <p className="text-sm text-amber-300">Area demand or supplier location could not be fully verified, so suggestions are hidden.</p>
          : opportunities.length === 0 ? <p className="text-sm text-slate-300">No sufficiently evidenced nearby opportunities in your registered city.</p>
          : <div className="grid gap-2 sm:grid-cols-2">
            {opportunities.map(zone => <div key={zone.zone_id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="font-bold">{zone.zone_name} · {zone.city}</p>
              <p className="mt-1 text-sm text-slate-300">{zone.request_count_30d} zone water requests / 30 days · {zone.mapped_supplier_count} mapped suppliers</p>
              <p className="mt-1 text-xs text-slate-400">{zone.distance_km !== null ? `Approx. ${zone.distance_km} km straight-line` : 'Distance not verified'}</p>
              <Link href={`/supplier/coverage?zone=${encodeURIComponent(zone.zone_id)}`} className="sp-link">
                {zone.already_mapped ? 'Review current coverage' : 'Request admin approval'}
              </Link>
            </div>)}
          </div>}
      </article>

      <article className="sp-card">
        <h2 className="sp-h2">{isHindi ? 'क्षेत्र अनुसार प्रदर्शन' : 'Local performance by service area'}</h2>
        <p className="sp-sub">Your own orders only: completed, cancelled, active, and delivered water cans by operational zone.</p>
        {quality?.area_performance_complete === false
          ? <p className="text-sm text-amber-300">Area mapping could not be fully verified.</p>
          : areas.length === 0
            ? <p className="text-sm text-slate-300">No zone-linked supplier orders in the current history.</p>
            : <div className="grid gap-2 sm:grid-cols-2">
              {areas.map(a => <div key={a.zone_id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="font-semibold">{a.zone_name} · {a.city}</p>
                <p className="mt-1 text-sm text-slate-300">Completed {a.completed} · Cancelled {a.cancelled} · Active {a.active}</p>
                <p className="mt-1 text-xs text-slate-400">Water cans delivered: {a.delivered_cans}</p>
              </div>)}
            </div>}
      </article>

      <article className="sp-card">
        <h2 className="sp-h2">Local performance and missed offers</h2>
        <p className="sp-sub">
          {summary ? `${summary.cancelled_orders} cancelled orders · ${summary.rejected_or_expired_offers} rejected or expired offers · ${summary.offer_acceptance_pct ?? '—'}% offer response acceptance` : 'Performance data could not be verified.'}
        </p>
        <p className="text-xs text-slate-400">A rejected/expired offer is not necessarily a missed sale. No competitor/customer private details are shared.</p>
        {quality && <p className="mt-3 text-xs text-slate-400">{quality.forecast_note} {quality.coverage_note} {quality.route_note}</p>}
        <Link href="/supplier/earnings" className="sp-link">Earnings & payouts</Link>
      </article>
    </section>
  );
}

function Support() {
  const { language } = useLanguage();
  const isHindi = language === 'hi';
  return (
    <section className="sp-grid">
      <article className="sp-card sp-wide">
        <h2 className="sp-h2">{isHindi ? 'ऑर्डर क्यों नहीं आ रहा?' : 'Troubleshoot missing orders'}</h2>
        <p className="sp-sub">{isHindi ? 'नीचे की जाँच क्रम से करें। केवल ऑनलाइन होना पर्याप्त नहीं है—स्वीकृत खाता, सेवा क्षेत्र, स्टॉक और ऑर्डर की पात्रता भी ज़रूरी है।' : 'Work through this checklist in order. Being online alone is not enough: account approval, service coverage, stock and order eligibility also matter.'}</p>
        <ol className="sp-steps">
          <li>{isHindi ? 'डिस्पैच सेटिंग में ऑनलाइन स्थिति और सही बेस लोकेशन जाँचें।' : 'In Dispatch, confirm you are online and your base location is correct.'}</li>
          <li>{isHindi ? 'सेवा क्षेत्र में वही पिन कोड रखें जिन्हें आप वास्तव में सेवा दे सकते हैं; पेंडिंग बदलाव के लिए एडमिन की मंज़ूरी ज़रूरी हो सकती है।' : 'In Service Areas, keep only PIN codes you can actually serve; pending coverage changes may require admin approval.'}</li>
          <li>{isHindi ? 'इन्वेंटरी में उपलब्ध कैन देखें। आरक्षित कैन और बफर स्टॉक नए ऑर्डर के लिए उपलब्ध नहीं हो सकते।' : 'Check available cans in Inventory. Reserved cans and buffer stock may not be available for new orders.'}</li>
          <li>{isHindi ? 'मेरी प्रोफ़ाइल में आवेदन/वेरिफिकेशन स्थिति देखें और आवश्यक जानकारी पूरी करें।' : 'Check your application/verification status in My Profile and complete any missing details.'}</li>
          <li>{isHindi ? 'ऑर्डर पेज को रीफ़्रेश करें। यदि फिर भी ऑर्डर नहीं दिखता, तो संभव है कोई ऑर्डर अभी आपके खाते को असाइन न हुआ हो।' : 'Refresh Orders. If nothing appears, there may simply be no order assigned to your account yet.'}</li>
        </ol>
        <div className="sp-actions">
          <Link href="/supplier/dispatch" className="sp-link">{isHindi ? 'डिस्पैच' : 'Dispatch'}</Link>
          <Link href="/supplier/coverage" className="sp-link">{isHindi ? 'सेवा क्षेत्र' : 'Service areas'}</Link>
          <Link href="/supplier/inventory" className="sp-link">{isHindi ? 'स्टॉक देखें' : 'Check inventory'}</Link>
          <Link href="/supplier/orders" className="sp-link">{isHindi ? 'ऑर्डर खोलें' : 'Open orders'}</Link>
        </div>
      </article>

      <article className="sp-card">
        <h2 className="sp-h2">{isHindi ? 'एडमिन को समस्या कैसे भेजें' : 'What to include in a support request'}</h2>
        <ul className="sp-steps">
          <li>{isHindi ? 'समस्या का प्रकार: ऑर्डर, स्टॉक, भुगतान, प्रोफ़ाइल या सेवा क्षेत्र।' : 'Issue type: order, stock, payout, profile or service coverage.'}</li>
          <li>{isHindi ? 'ऑर्डर की समस्या हो तो Order ID और घटना का अनुमानित समय दें।' : 'For order issues, include the Order ID and approximate time.'}</li>
          <li>{isHindi ? 'स्क्रीन पर दिखने वाला पूरा error message और आपने जो कदम किए, वे लिखें।' : 'Include the exact on-screen error and steps you already tried.'}</li>
          <li>{isHindi ? 'बताएँ कि समस्या मोबाइल या डेस्कटॉप पर है और कौन-सा पेज खुला था।' : 'Mention whether it happened on mobile or desktop and which page was open.'}</li>
        </ul>
        <div className="sp-actions" aria-label="Supplier support contact methods">
          <a className="sp-link" href={`mailto:${DEFAULT_CONTACT.supportEmail}?subject=${encodeURIComponent('AuroTap supplier support — orders or coverage')}`}>{isHindi ? 'ईमेल सहायता' : 'Email support'} · {DEFAULT_CONTACT.supportEmail}</a>
          <a className="sp-link" href={whatsappHref(DEFAULT_CONTACT.whatsappNumber, 'Hello AuroTap Support, I am a supplier. Issue: [orders/coverage/stock]. Order ID (if any): . Please help.')} target="_blank" rel="noopener noreferrer">{isHindi ? 'व्हाट्सऐप सहायता' : 'WhatsApp support'}</a>
          <Link className="sp-link" href="/contact?subject=supplier">{isHindi ? 'संपर्क फ़ॉर्म' : 'Contact form'}</Link>
        </div>
        <p className="sp-hint">{isHindi ? 'ईमेल या WhatsApp खुलने के बाद संदेश भेजना ज़रूरी है। यह पेज अपने-आप टिकट नहीं बनाता।' : 'Send your message in the email or WhatsApp app after it opens. This page does not create a support ticket automatically.'}</p>
      </article>

      <article className="sp-card">
        <h2 className="sp-h2">{isHindi ? 'सुरक्षा और भुगतान' : 'Account and payment safety'}</h2>
        <ul className="sp-steps">
          <li>{isHindi ? 'OTP, पासवर्ड, refresh token या पूरा बैंक खाता विवरण किसी को न भेजें।' : 'Never share OTPs, passwords, refresh tokens or full bank account details.'}</li>
          <li>{isHindi ? 'कमाई और भुगतान स्थिति के लिए Earnings पेज देखें; payout request भेजना भुगतान पूरा होना नहीं है।' : 'Use Earnings to check payout status; submitting a payout request does not mean payment has been sent.'}</li>
          <li>{isHindi ? 'डिलीवरी की स्थिति तभी अपडेट करें जब संबंधित कदम वास्तव में पूरा हो गया हो।' : 'Update delivery status only after the corresponding step has actually happened.'}</li>
        </ul>
        <Link href="/supplier/earnings" className="sp-link">{isHindi ? 'कमाई और भुगतान खोलें' : 'Open earnings and payouts'}</Link>
      </article>
    </section>
  );
}

/* ───────────────────────── Small components ───────────────────────── */

function Metric({ name, value }: { name: string; value: string }) {
  return (
    <article className="sp-card">
      <p className="sp-kicker">{name}</p>
      <p className="sp-metric">{value}</p>
    </article>
  );
}

function FragmentRow({ k, v }: { k: string; v: string }) {
  return <><dt>{k}</dt><dd>{v}</dd></>;
}

function StatusBadge({ status }: { status: string }) {
  const { language } = useLanguage();
  const tone = ['completed', 'delivered', 'online'].includes(status) ? 'ok' : ['in_progress'].includes(status) ? 'amber' : ['cancelled', 'offline'].includes(status) ? 'off' : 'info';
  const hiLabels: Record<string, string> = {
    pending: 'लंबित', assigned: 'असाइन हुआ', in_progress: 'काम जारी',
    completed: 'पूरा हुआ', delivered: 'डिलीवर हुआ', cancelled: 'रद्द',
    online: 'ऑनलाइन', offline: 'ऑफलाइन', unknown: 'अज्ञात',
  };
  const value = label(status) || 'unknown';
  return <span className={`sp-badge sp-badge--${tone}`}>{language === 'hi' ? (hiLabels[status] ?? value) : value}</span>;
}

function Empty({ title, text, href, cta }: { title: string; text: string; href: string; cta: string }) {
  return (
    <article className="sp-card sp-empty">
      <h2 className="sp-h2">{title}</h2>
      <p className="sp-sub">{text}</p>
      <Link href={href} className="sp-link">{cta}</Link>
    </article>
  );
}

function Skeleton() {
  return <section className="sp-grid" aria-busy="true" aria-label="Loading">{[0, 1, 2].map((i) => <div key={i} className="sp-card sp-skel" />)}</section>;
}

/** Two-tap confirmation that disarms itself after 4 seconds. Replaces blocking window.confirm(). */
function Confirm({ children, confirmText, onConfirm, className, disabled }: { children: ReactNode; confirmText: string; onConfirm: () => void; className: string; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={className}
      disabled={disabled}
      onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}
    >
      {armed ? confirmText : children}
    </button>
  );
}

/* ───────────────────────── Styles ───────────────────────── */

function Styles() {
  return <style>{CSS}</style>;
}

const CSS = `
.sp{--bg:#07111c;--panel:#0d1c2b;--line:#1f3446;--ink:#eef3f8;--mute:#93a4b5;--teal:#2dd4bf;--go:#10b981;--amber:#f59e0b;--bad:#f43f5e;
  min-height:80vh;background:radial-gradient(ellipse at 10% -10%,rgba(45,212,191,.12),transparent 40%),var(--bg);color:var(--ink);
  padding:clamp(18px,4vw,56px);font-family:Inter,ui-sans-serif,system-ui,sans-serif;line-height:1.5}
.sp *{box-sizing:border-box}
.sp-head{max-width:100%;min-width:0}
.sp-head-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
.sp-head-copy{min-width:0;flex:1 1 260px}
.sp-language{display:inline-flex;flex:0 0 auto;gap:4px;padding:4px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
.sp-language button{min-height:36px;padding:7px 12px;border-radius:8px;border:0;background:transparent;color:var(--mute);font:inherit;font-size:12px;font-weight:800;cursor:pointer}
.sp-language button.is-active{background:var(--teal);color:#04201c}
.sp-head{max-width:100%;min-width:0}
.sp-kicker{margin:0;color:var(--teal);font-size:12.5px;font-weight:700;letter-spacing:.02em}
.sp-h1{margin:6px 0 8px;font-size:clamp(28px,4vw,42px);font-weight:800;letter-spacing:-.02em;line-height:1.1}
.sp-h2{margin:0 0 8px;font-size:17px;font-weight:700}
.sp-sub{margin:0 0 14px;color:var(--mute);max-width:68ch}
.sp-nav{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:22px 0;padding-bottom:14px;border-bottom:1px solid var(--line)}
.sp-tab{color:var(--mute);text-decoration:none;font-weight:600;font-size:14px;padding:8px 12px;border-radius:10px}
.sp-tab:hover{color:var(--ink);background:rgba(255,255,255,.05)}
.sp-tab[aria-current=page]{color:#04201c;background:var(--teal)}
.sp-refresh{margin-left:auto}
.sp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:16px;align-items:start}
.sp-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:22px;min-width:0}
.sp-wide{grid-column:1/-1}
.sp-empty{grid-column:1/-1;text-align:center;padding:44px 22px}
.sp-empty .sp-sub{margin:0 auto 18px}
.sp-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px}
.sp-dl{display:grid;grid-template-columns:84px 1fr;gap:6px 12px;margin:0 0 12px;font-size:14px}
.sp-dl dt{color:var(--mute)} .sp-dl dd{margin:0;overflow-wrap:anywhere}
.sp-a{color:#7dd3fc}
.sp-amount{margin:0 0 14px;font-size:24px;font-weight:800;letter-spacing:-.01em}
.sp-metric{margin:10px 0 0;font-size:32px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.sp-actions{display:flex;gap:8px;flex-wrap:wrap}
.sp-hint{margin:12px 0 0;color:var(--mute);font-size:13px}
.sp-steps{margin:0 0 14px;padding-left:20px;color:var(--ink)} .sp-steps li{margin:4px 0}
.sp-chips{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}
.sp-inline{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap}
.sp-inline .sp-field{flex:1 1 180px;margin:0}
.sp-field{display:block;margin:14px 0;font-size:13px;font-weight:600;color:#cbd5e1}
.sp-input{display:block;width:100%;margin-top:6px;padding:11px 12px;background:#06101a;color:var(--ink);border:1px solid #2b4458;border-radius:10px;font:inherit}
.sp-btn{display:inline-flex;align-items:center;gap:8px;padding:11px 16px;border:0;border-radius:10px;background:var(--go);color:#03221a;font:inherit;font-weight:700;cursor:pointer;transition:filter .15s,transform .15s}
.sp-btn:hover:not(:disabled){filter:brightness(1.08)}
.sp-btn:active:not(:disabled){transform:translateY(1px)}
.sp-btn:disabled{opacity:.55;cursor:not-allowed}
.sp-btn--go{background:var(--teal)}
.sp-btn--amber{background:var(--amber);color:#2b1a00}
.sp-btn--ghost{background:transparent;color:#dbeafe;border:1px solid #38566c}
.sp-link{display:inline-block;color:#7dd3fc;text-decoration:none;font-weight:600;border:1px solid #28526b;border-radius:10px;padding:9px 14px}
.sp-link:hover{background:rgba(125,211,252,.08)}
.sp-badge{font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;text-transform:capitalize}
.sp-badge--info{background:#12324a;color:#7dd3fc} .sp-badge--ok{background:#0f3a33;color:#5eead4}
.sp-badge--amber{background:#3d2b08;color:#fbbf24} .sp-badge--off{background:#2a3440;color:#9fb0c0}
.sp-msg{margin:0 0 16px;padding:12px 14px;border-radius:12px;font-size:14px}
.sp-msg--err{background:#3b1820;border:1px solid #9f3345;color:#fecdd3}
.sp-msg--ok{background:#0f3a33;border:1px solid #21796b;color:#99f6e4}
.sp-pulse{width:8px;height:8px;border-radius:50%;background:#2b1a00;animation:sp-pulse 1.4s ease-in-out infinite}
.sp-skel{min-height:120px;background:linear-gradient(90deg,var(--panel),#12263a,var(--panel));background-size:200% 100%;animation:sp-shimmer 1.4s linear infinite}
@keyframes sp-pulse{50%{transform:scale(1.7);opacity:.5}}
@keyframes sp-shimmer{to{background-position:-200% 0}}
.sp :focus-visible{outline:2px solid #7dd3fc;outline-offset:2px}
@media (prefers-reduced-motion:reduce){.sp *{animation:none!important;transition:none!important}}
@media (max-width:520px){.sp{padding:16px 12px calc(28px + env(safe-area-inset-bottom))}.sp-dl{grid-template-columns:1fr}.sp-dl dt{margin-top:6px}.sp-refresh{margin-left:0}.sp-nav{gap:5px;margin:16px 0;padding-bottom:12px}.sp-tab{font-size:12px;padding:8px 10px}.sp-card{padding:16px}.sp-head-row{gap:12px}.sp-language{margin-left:auto}.sp-grid{grid-template-columns:minmax(0,1fr)}}
`;










// 'use client';

// import { useCallback, useEffect, useState } from 'react';
// import type { CSSProperties } from 'react';
// import Link from 'next/link';
// import { useParams } from 'next/navigation';
// import { createClient } from '@/lib/supabase/client';

// type Section = 'orders' | 'inventory' | 'earnings' | 'settings' | 'analytics' | 'support';
// const config: Record<Section, {title:string;subtitle:string;endpoint:string}> = {
//   orders: {title:'Order management',subtitle:'Assigned water orders, schedules and status. New assignments appear when dispatch eligibility is met.',endpoint:'/api/supplier/orders'},
//   inventory: {title:'Inventory control',subtitle:'Current stock and reservations from the existing supplier stock API.',endpoint:'/api/supplier/stock'},
//   earnings: {title:'Earnings & payouts',subtitle:'Earnings summary from the existing earnings RPC and payout request history.',endpoint:'/api/supplier/earnings?period=month'},
//   settings: {title:'Dispatch settings',subtitle:'Your online status, service radius and dispatch location.',endpoint:'/api/supplier/settings'},
//   analytics: {title:'Performance overview',subtitle:'Live operational data from existing orders and earnings. No fabricated metrics.',endpoint:'/api/supplier/orders'},
//   support: {title:'Supplier support',subtitle:'Support centre. Use the contact options configured for your account; a ticketing backend is not currently assumed.',endpoint:'/api/supplier/settings'},
// };

// export default function SupplierSectionPage() {
//   const params = useParams<{section:string}>();
//   const section = params.section as Section;
//   const meta = config[section];
//   const [data,setData] = useState<unknown>(null);
//   const [error,setError] = useState('');
//   const [busy,setBusy] = useState(false);
//   const [notice,setNotice] = useState('');
//   const [amount,setAmount] = useState('');
//   const [method,setMethod] = useState<'upi'|'bank'>('upi');
//   const [upi,setUpi] = useState('');
//   const [account,setAccount] = useState('');
//   const [ifsc,setIfsc] = useState('');
//   const [online,setOnline] = useState(false);
//   const [radius,setRadius] = useState('5');
//   const supabase = createClient();

//   const load = useCallback(async () => {
//     if (!meta) return;
//     setError('');
//     const {data: sessionData} = await supabase.auth.getSession();
//     const token = sessionData.session?.access_token;
//     if (!token) { setError('Your session has expired. Sign in again to continue.'); return; }
//     try {
//       const response = await fetch(meta.endpoint, {headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
//       const body = await response.json();
//       if (!response.ok) throw new Error(body?.error ?? body?.message ?? 'Unable to load this page.');
//       setData(body?.data ?? body);
//       if (section === 'settings' && body?.data) {
//         setOnline(Boolean(body.data.is_online));
//         setRadius(String(body.data.zone_radius_km ?? 5));
//       }
//     } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load this page.'); }
//   }, [meta,section,supabase]);

//   useEffect(()=>{void load();},[load]);

//   async function send(path:string, methodName:string, payload:Record<string,unknown>) {
//     setBusy(true); setNotice(''); setError('');
//     try {
//       const {data: sessionData} = await supabase.auth.getSession();
//       const token = sessionData.session?.access_token;
//       if (!token) throw new Error('Your session has expired. Sign in again.');
//       const response = await fetch(path,{method:methodName,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
//       const body=await response.json();
//       if(!response.ok) throw new Error(body?.error ?? body?.message ?? 'Request failed.');
//       setNotice(body?.data?.message ?? 'Saved successfully.');
//       await load();
//     } catch(e) {setError(e instanceof Error?e.message:'Request failed.');}
//     finally {setBusy(false);}
//   }

//   if(!meta) return <main style={shell}><h1>Supplier page not found</h1><Link href="/supplier/dashboard" style={link}>Back to dashboard</Link></main>;
//   const rows = Array.isArray(data) ? data as Record<string,unknown>[] : [];
//   const obj = data && typeof data==='object'&&!Array.isArray(data) ? data as Record<string,unknown> : {};
//   const money=(v:unknown)=>'₹'+Number(v??0).toLocaleString('en-IN',{maximumFractionDigits:2});
//   return <main style={shell}>
//     <div style={eyebrow}>AUROTAP · SUPPLIER PORTAL</div>
//     <h1 style={heading}>{meta.title}</h1><p style={sub}>{meta.subtitle}</p>
//     <div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'18px 0 24px'}}>
//       <button style={button} onClick={()=>void load()} disabled={busy}>↻ Refresh</button>
//       <Link href="/supplier/dashboard" style={link}>← Dashboard</Link>
//     </div>
//     {error && <div role="alert" style={errorBox}>{error}</div>}
//     {notice && <div role="status" style={successBox}>{notice}</div>}
//     {section==='orders' && <section style={grid}>
//       {rows.length===0?<Empty title="No assigned orders yet" text="New requests appear after dispatch assigns an eligible order to your supplier account. Go online in Dispatch settings, confirm location/radius and stock, then refresh."/>:rows.map((o,i)=><article key={String(o.id??i)} style={card}>
//         <div style={row}><b>Order #{String(o.order_number??o.id??'').slice(0,10)}</b><span style={badge}>{String(o.status??'').replaceAll('_',' ')}</span></div>
//         <p>{String(o.service_type_label??o.service_type??'Water/service order')}</p><p>{String(o.customer_name??'Customer')} · {String(o.customer_phone??'Phone unavailable')}</p>
//         <p>{String(o.address_line??o.address??'Address on order')} · {String(o.city??o.customer_city??'')}</p>
//         <p>{String(o.scheduled_date??o.scheduled_at??'Schedule pending')} {String(o.time_slot??o.scheduled_slot??'')}</p><strong>{money(o.final_amount??o.total_amount??o.amount)}</strong>
//         <div style={{...row,justifyContent:'flex-start',marginTop:16}}>
//           {['ASSIGNED','PENDING'].includes(String(o.status??'').toUpperCase()) && <>
//             <button style={button} disabled={busy} onClick={()=>void send(`/api/supplier/orders/${String(o.id)}/accept`,'PUT',{})}>{language === 'hi' ? 'ऑर्डर स्वीकार करें' : 'Accept order'}</button>
//             <button style={secondaryButton} disabled={busy} onClick={()=>{if(window.confirm('Decline this order? It may be offered to another supplier.'))void send(`/api/supplier/orders/${String(o.id)}/reject`,'PUT',{reason:'Supplier declined'});}}>Decline</button>
//           </>}
//           {String(o.status??'').toUpperCase()==='ASSIGNED' && <button style={secondaryButton} disabled={busy} onClick={()=>void send(`/api/supplier/orders/${String(o.id)}/status`,'PUT',{status:'IN_PROGRESS'})}>Start delivery</button>}
//           {String(o.status??'').toUpperCase()==='IN_PROGRESS' && <button style={button} disabled={busy} onClick={()=>{if(window.confirm('Mark this order as completed?'))void send(`/api/supplier/orders/${String(o.id)}/status`,'PUT',{status:'COMPLETED'});}}>Complete order</button>}
//         </div>
//       </article>)}
//     </section>}
//     {section==='inventory' && <section style={grid}>
//       <Metric label="Available cans" value={String(obj.cans_available??'—')}/><Metric label="Reserved cans" value={String(obj.reserved_cans??'—')}/><Metric label="Low-stock alert" value={String(obj.low_stock_alert??'—')}/><Metric label="Reservation buffer" value={String(obj.reservation_buffer_cans??'—')}/>
//       <article style={card}><h2>Adjust stock</h2><p>Positive adds stock; negative records offline sales. Server-side reservation checks still apply.</p><div style={row}><input id="stock-delta" type="number" step="1" placeholder="e.g. 10 or -1" style={input}/><button disabled={busy} style={button} onClick={()=>{const el=document.getElementById('stock-delta') as HTMLInputElement|null;const n=Number(el?.value);if(!Number.isInteger(n)||n===0){setError('Enter a non-zero whole number.');return;}void send('/api/supplier/stock','PUT',{stock_delta:n});}}>Update stock</button></div></article>
//     </section>}
//     {section==='earnings' && <section style={grid}>
//       <Metric label="Completed eligible orders" value={String(obj.order_count??'—')}/><Metric label="Gross earnings" value={money(obj.gross_amount)}/><Metric label="Pending payout" value={money(obj.pending_payout)}/>
//       <article style={card}><h2>Request a payout</h2><p>Submitting a request does not transfer money. Admin/provider processing is still required.</p>
//         <label style={label}>Amount (INR)<input style={input} value={amount} onChange={e=>setAmount(e.target.value)} type="number" min="1" step="0.01"/></label>
//         <label style={label}>Payout method<select style={input} value={method} onChange={e=>setMethod(e.target.value as 'upi'|'bank')}><option value="upi">UPI</option><option value="bank">Bank account</option></select></label>
//         {method==='upi'?<label style={label}>UPI ID<input style={input} value={upi} onChange={e=>setUpi(e.target.value)} placeholder="name@bank"/></label>:<><label style={label}>Bank account number<input style={input} value={account} onChange={e=>setAccount(e.target.value)} inputMode="numeric"/></label><label style={label}>IFSC<input style={input} value={ifsc} onChange={e=>setIfsc(e.target.value.toUpperCase())}/></label></>}
//         <button style={button} disabled={busy} onClick={()=>{const n=Number(amount);if(!Number.isFinite(n)||n<=0){setError('Enter a valid amount.');return;}void send('/api/supplier/payouts','POST',method==='upi'?{amount:n,method,upi_id:upi}:{amount:n,method,bank_account:account,ifsc});}}>Submit payout request</button>
//       </article>
//     </section>}
//     {section==='settings' && <section style={grid}>
//       <article style={card}><h2>Dispatch availability</h2><p>Online suppliers may receive eligible new orders. Existing pending orders are retried when you switch online.</p><div style={row}><span style={badge}>{online?'ONLINE':'OFFLINE'}</span><button style={button} disabled={busy} onClick={()=>void send('/api/supplier/settings','PUT',{is_online:!online})}>{online?'Go offline':'Go online'}</button></div>
//       <label style={label}>Service radius (km)<input style={input} type="number" min="1" max="100" value={radius} onChange={e=>setRadius(e.target.value)}/></label><button style={button} disabled={busy} onClick={()=>{const n=Number(radius);if(!Number.isInteger(n)||n<1||n>100){setError('Radius must be 1–100 km.');return;}void send('/api/supplier/settings','PUT',{zone_radius_km:n});}}>Save radius</button>
//       <p>Set a dispatch location from the main dashboard using the location button. Orders are only offered when eligibility, distance and stock checks pass.</p></article>
//       <article style={card}><h2>Current dispatch configuration</h2><pre style={pre}>{JSON.stringify(obj,null,2)}</pre></article>
//     </section>}
//     {section==='analytics' && <section style={grid}>
//       <Metric label="Assigned orders in list" value={String(rows.length)}/><Metric label="Completed in list" value={String(rows.filter(o=>['COMPLETED','DELIVERED'].includes(String(o.status).toUpperCase())).length)}/><Metric label="Active in list" value={String(rows.filter(o=>['ASSIGNED','IN_PROGRESS'].includes(String(o.status).toUpperCase())).length)}/>
//       <article style={card}><h2>Data integrity note</h2><p>These figures reflect the current order API response. For authoritative revenue and payout figures, use the earnings RPC; never treat a browser-derived estimate as an accounting ledger.</p><Link href="/supplier/earnings" style={link}>Open earnings →</Link></article>
//     </section>}
//     {section==='support' && <section style={grid}><article style={card}><h2>Need assistance?</h2><p>Support ticket creation is not wired to a verified ticket backend in this change. Do not enter customer payment or banking secrets in general messages.</p><p>For dispatch issues, first check online status, location, service radius, stock, and the Orders page. If a valid order still fails to assign, provide the order ID to the platform administrator for dispatch-log review.</p><Link href="/supplier/settings" style={link}>Check dispatch settings →</Link></article></section>}
//     <p style={{...sub,marginTop:28}}>Data is loaded from authenticated supplier APIs. If an endpoint or schema is unavailable, this page displays an error rather than inventing values.</p>
//   </main>;
// }

// function Metric({label,value}:{label:string;value:string}){return <article style={card}><div style={eyebrow}>{label}</div><div style={{fontSize:30,fontWeight:850,marginTop:14}}>{value}</div></article>}
// function Empty({title,text}:{title:string;text:string}){return <article style={{...card,gridColumn:'1/-1',textAlign:'center',padding:38}}><div style={{fontSize:22,fontWeight:800}}>{title}</div><p style={sub}>{text}</p><Link href="/supplier/settings" style={link}>Open dispatch settings →</Link></article>}
// const shell:CSSProperties={minHeight:'80vh',background:'radial-gradient(ellipse at 12% 0%,rgba(13,148,136,.12),transparent 35%),linear-gradient(180deg,#07111c 0%,#08131f 100%)',color:'#f1f5f9',padding:'clamp(20px,4vw,56px)',fontFamily:'Inter,ui-sans-serif,system-ui,sans-serif'};
// const eyebrow:CSSProperties={color:'#5eead4',fontWeight:800,fontSize:12,letterSpacing:2,textTransform:'uppercase'};
// const heading:CSSProperties={fontSize:'clamp(30px,4vw,44px)',fontWeight:850,letterSpacing:-1,margin:'12px 0'};
// const sub:CSSProperties={color:'#9aa9b8',lineHeight:1.7,maxWidth:850};
// const grid:CSSProperties={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,280px),1fr))',gap:16};
// const card:CSSProperties={background:'linear-gradient(145deg,rgba(17,34,49,.98),rgba(9,22,34,.98))',border:'1px solid rgba(125,211,252,.16)',borderRadius:20,padding:24,minWidth:0,boxShadow:'0 16px 40px rgba(0,0,0,.14)'};
// const row:CSSProperties={display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'};
// const badge:CSSProperties={fontSize:11,fontWeight:800,color:'#5eead4',background:'#123c3a',borderRadius:999,padding:'6px 10px'};
// const button:CSSProperties={background:'linear-gradient(135deg,#10b981,#059669)',color:'#fff',fontWeight:800,border:0,borderRadius:11,padding:'12px 16px',cursor:'pointer',boxShadow:'0 8px 22px rgba(5,150,105,.16)'};
// const secondaryButton:CSSProperties={background:'#102130',color:'#dbeafe',fontWeight:750,border:'1px solid #315066',borderRadius:11,padding:'11px 15px',cursor:'pointer'};
// const link:CSSProperties={display:'inline-block',color:'#7dd3fc',textDecoration:'none',fontWeight:750,border:'1px solid #24516a',borderRadius:10,padding:'10px 14px'};
// const input:CSSProperties={display:'block',width:'100%',boxSizing:'border-box',background:'#07111b',border:'1px solid #2b4050',borderRadius:10,color:'#f8fafc',padding:12,marginTop:8};
// const label:CSSProperties={display:'block',fontSize:13,color:'#cbd5e1',margin:'14px 0',fontWeight:700};
// const errorBox:CSSProperties={background:'#431d24',border:'1px solid #9f3345',padding:14,borderRadius:12,marginBottom:16,color:'#fecdd3'};
// const successBox:CSSProperties={background:'#123c3a',border:'1px solid #21796b',padding:14,borderRadius:12,marginBottom:16,color:'#99f6e4'};
// const pre:CSSProperties={whiteSpace:'pre-wrap',wordBreak:'break-word',color:'#b6c6d5',fontSize:12};
