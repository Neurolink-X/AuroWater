'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/* ───────────────────────── Types & config ───────────────────────── */

type Section = 'orders' | 'inventory' | 'earnings' | 'settings' | 'analytics' | 'support';
type Row = Record<string, unknown>;
type Status = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'delivered' | 'cancelled' | string;

const SECTIONS: Record<Section, { nav: string; title: string; subtitle: string; endpoint: string }> = {
  orders: { nav: 'Orders', title: 'Order management', subtitle: 'Assigned water orders, schedules and status. New assignments appear when dispatch eligibility is met.', endpoint: '/api/supplier/orders' },
  inventory: { nav: 'Inventory', title: 'Inventory control', subtitle: 'Current stock and reservations.', endpoint: '/api/supplier/stock' },
  earnings: { nav: 'Earnings', title: 'Earnings & payouts', subtitle: 'This month’s earnings and payout requests.', endpoint: '/api/supplier/earnings?period=month' },
  settings: { nav: 'Dispatch', title: 'Dispatch settings', subtitle: 'Your online status, service radius and dispatch location.', endpoint: '/api/supplier/settings' },
  analytics: { nav: 'Performance', title: 'Performance overview', subtitle: 'Live figures from your current orders. Nothing here is estimated.', endpoint: '/api/supplier/orders' },
  support: { nav: 'Support', title: 'Supplier support', subtitle: 'Fix common dispatch problems or contact your administrator.', endpoint: '/api/supplier/settings' },
};
const ORDER = Object.keys(SECTIONS) as Section[];

const POLL_MS = 30_000;
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
      if (!meta) return;
      const id = ++latest.current;
      if (!silent) setLoading(true);
      try {
        const body = await authedFetch(meta.endpoint);
        if (id !== latest.current) return; // a newer request superseded this one
        const payload = body?.data ?? body;
        setData(payload);
        if (!silent) setError('');
        if (section === 'settings' && payload && typeof payload === 'object') {
          setOnline(Boolean((payload as Row).is_online));
          setRadius(String((payload as Row).zone_radius_km ?? 5));
        }
      } catch (e) {
        if (id === latest.current) setError(errMsg(e, 'Unable to load this page.'));
      } finally {
        if (id === latest.current) setLoading(false);
      }
    },
    [meta, section, authedFetch],
  );

  useEffect(() => { void load(); }, [load]);

  // Keep the orders list fresh while the tab is visible.
  useEffect(() => {
    if (section !== 'orders') return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load(true); }, POLL_MS);
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

  return (
    <main className="sp">
      <Styles />
      <header className="sp-head">
        <p className="sp-kicker">AuroTap supplier portal</p>
        <h1 className="sp-h1">{meta.title}</h1>
        <p className="sp-sub">{meta.subtitle}</p>
      </header>

      <nav className="sp-nav" aria-label="Supplier sections">
        <Link href="/supplier/dashboard" className="sp-tab">Dashboard</Link>
        {ORDER.map((s) => (
          <Link key={s} href={`/supplier/${s}`} className="sp-tab" aria-current={s === section ? 'page' : undefined}>
            {SECTIONS[s].nav}
          </Link>
        ))}
        <button className="sp-btn sp-btn--ghost sp-refresh" onClick={() => void load()} disabled={busy || loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </nav>

      <div aria-live="polite">
        {error && <div role="alert" className="sp-msg sp-msg--err">{error}</div>}
        {notice && <div role="status" className="sp-msg sp-msg--ok">{notice}</div>}
      </div>

      {loading && !data ? <Skeleton /> : (
        <>
          {section === 'orders' && <Orders rows={rows} busy={busy} send={send} />}
          {section === 'inventory' && <Inventory obj={obj} busy={busy} send={send} setError={setError} />}
          {section === 'earnings' && <Earnings obj={obj} busy={busy} send={send} setError={setError} />}
          {section === 'settings' && <Settings obj={obj} online={online} radius={radius} setRadius={setRadius} busy={busy} send={send} setError={setError} />}
          {section === 'analytics' && <Analytics rows={rows} />}
          {section === 'support' && <Support />}
        </>
      )}
    </main>
  );
}

/* ───────────────────────── Orders ───────────────────────── */

type Send = (path: string, method: string, payload: Row, okMessage?: string, onFail?: (e: unknown) => void) => Promise<boolean>;

function Orders({ rows, busy, send }: { rows: Row[]; busy: boolean; send: Send }) {
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
        title="No assigned orders yet"
        text="Orders arrive when dispatch assigns one to you. Go online, confirm your location, radius and stock, then refresh."
        href="/supplier/settings"
        cta="Open dispatch settings"
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
        return (
          <article key={id || i} className="sp-card">
            <div className="sp-row">
              <h2 className="sp-h2">Order #{str(o.order_number ?? o.id).slice(0, 10)}</h2>
              <StatusBadge status={status} />
            </div>
            <dl className="sp-dl">
              <dt>Service</dt><dd>{str(o.service_type_label ?? o.service_type, 'Water order')}</dd>
              <dt>Customer</dt><dd>{str(o.customer_name, 'Customer')}{o.customer_phone ? <> · <a className="sp-a" href={`tel:${str(o.customer_phone)}`}>{str(o.customer_phone)}</a></> : null}</dd>
              <dt>Address</dt><dd>{str(o.address_text ?? o.address_line ?? o.address, 'Address on order')}</dd>
              <dt>Payment</dt><dd>{norm(o.payment_status) === 'paid' ? 'Paid' : `Collect on delivery (${str(o.payment_method, 'cash').toUpperCase()})`}</dd>
              <dt>Slot</dt><dd>{str(o.scheduled_date ?? o.scheduled_at, 'Schedule pending')} {str(o.time_slot ?? o.scheduled_slot)}</dd>
            </dl>
            <p className="sp-amount">{money(o.final_amount ?? o.total_amount ?? o.amount)}</p>

            <div className="sp-actions">
              {canAccept && (
                <button className="sp-btn" disabled={busy} onClick={() => void decide(id, 'accept')}>
                  Accept order
                </button>
              )}
              {status === 'assigned' && (
                <button className="sp-btn sp-btn--go" disabled={busy} onClick={() => void advance(id, 'in_progress', 'Delivery started.')}>
                  Start delivery
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
                      <label className="sp-field" style={{ flexBasis: '100%', margin: 0 }} htmlFor={`ref-${id}`}>UPI transaction reference
                        <input id={`ref-${id}`} className="sp-input" autoComplete="off" value={refs[id] ?? ''} onChange={(e) => setRefs((r) => ({ ...r, [id]: e.target.value }))} />
                      </label>
                    )}
                    <Confirm
                      className="sp-btn sp-btn--amber"
                      confirmText={paid ? 'Tap again to confirm delivery' : `Tap again: ${amount} received`}
                      disabled={busy || (!paid && upi && !ref)}
                      onConfirm={() => void advance(id, 'completed', 'Order delivered.', paid ? {} : { payment_confirmed: true, ...(ref ? { payment_reference: ref } : {}) })}
                    >
                      <span className="sp-pulse" aria-hidden /> Complete delivery
                    </Confirm>
                  </>
                );
              })()}
              {(status === 'completed' || status === 'delivered') && (
                <button className="sp-btn sp-btn--ghost" disabled>Delivered</button>
              )}
              {canAccept && (
                <Confirm className="sp-btn sp-btn--ghost" confirmText="Tap again to decline" disabled={busy}
                  onConfirm={() => void decide(id, 'reject')}>
                  Decline
                </Confirm>
              )}
            </div>
            {status === 'in_progress' && <p className="sp-hint">Delivery in progress</p>}
          </article>
        );
      })}
    </section>
  );
}

/* ───────────────────────── Inventory ───────────────────────── */

function Inventory({ obj, busy, send, setError }: { obj: Row; busy: boolean; send: Send; setError: (s: string) => void }) {
  const [delta, setDelta] = useState('');
  const submit = async () => {
    const n = Number(delta);
    if (!Number.isInteger(n) || n === 0) return setError('Enter a non-zero whole number, such as 10 or -1.');
    if (await send('/api/supplier/stock', 'PUT', { stock_delta: n }, 'Stock updated.')) setDelta('');
  };
  return (
    <section className="sp-grid">
      <Metric name="Available cans" value={num(obj.cans_available)} />
      <Metric name="Reserved cans" value={num(obj.reserved_cans)} />
      <Metric name="Low-stock alert at" value={num(obj.low_stock_alert)} />
      <Metric name="Reservation buffer" value={num(obj.reservation_buffer_cans)} />
      <article className="sp-card sp-wide">
        <h2 className="sp-h2">Adjust stock</h2>
        <p className="sp-sub">Enter a positive number to add cans, or a negative number to record an offline sale. Reservation checks still apply on the server.</p>
        <div className="sp-inline">
          <label className="sp-field" htmlFor="stock-delta">Change in cans
            <input id="stock-delta" className="sp-input" type="number" step={1} inputMode="numeric" placeholder="10 or -1" value={delta} onChange={(e) => setDelta(e.target.value)} />
          </label>
          <button className="sp-btn" disabled={busy} onClick={() => void submit()}>Update stock</button>
        </div>
      </article>
    </section>
  );
}

/* ───────────────────────── Earnings ───────────────────────── */

function Earnings({ obj, busy, send, setError }: { obj: Row; busy: boolean; send: Send; setError: (s: string) => void }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'upi' | 'bank'>('upi');
  const [upi, setUpi] = useState('');
  const [account, setAccount] = useState('');
  const [ifsc, setIfsc] = useState('');

  const submit = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return setError('Enter a payout amount greater than ₹0.');
    if (method === 'upi' && !UPI_RE.test(upi.trim())) return setError('Enter a valid UPI ID, for example name@bank.');
    if (method === 'bank' && !ACCOUNT_RE.test(account.trim())) return setError('Bank account numbers have 9 to 18 digits.');
    if (method === 'bank' && !IFSC_RE.test(ifsc.trim())) return setError('Enter a valid 11-character IFSC, for example HDFC0001234.');
    const payload = method === 'upi' ? { amount: n, method, upi_id: upi.trim() } : { amount: n, method, bank_account: account.trim(), ifsc: ifsc.trim() };
    if (await send('/api/supplier/payouts', 'POST', payload, 'Payout request submitted.')) {
      setAmount(''); setUpi(''); setAccount(''); setIfsc(''); // never keep banking details in memory longer than needed
    }
  };

  return (
    <section className="sp-grid">
      <Metric name="Completed orders" value={num(obj.order_count)} />
      <Metric name="Gross earnings" value={money(obj.gross_amount)} />
      <Metric name="Pending payout" value={money(obj.pending_payout)} />
      <article className="sp-card sp-wide">
        <h2 className="sp-h2">Request a payout</h2>
        <p className="sp-sub">Submitting a request does not move money. The administrator processes it afterwards.</p>
        <label className="sp-field" htmlFor="po-amount">Amount (₹)
          <input id="po-amount" className="sp-input" type="number" min={1} step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="sp-field" htmlFor="po-method">Payout method
          <select id="po-method" className="sp-input" value={method} onChange={(e) => setMethod(e.target.value as 'upi' | 'bank')}>
            <option value="upi">UPI</option>
            <option value="bank">Bank account</option>
          </select>
        </label>
        {method === 'upi' ? (
          <label className="sp-field" htmlFor="po-upi">UPI ID
            <input id="po-upi" className="sp-input" autoComplete="off" value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@bank" />
          </label>
        ) : (
          <>
            <label className="sp-field" htmlFor="po-acc">Bank account number
              <input id="po-acc" className="sp-input" autoComplete="off" inputMode="numeric" value={account} onChange={(e) => setAccount(e.target.value.replace(/\D/g, ''))} />
            </label>
            <label className="sp-field" htmlFor="po-ifsc">IFSC
              <input id="po-ifsc" className="sp-input" autoComplete="off" maxLength={11} value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} />
            </label>
          </>
        )}
        <button className="sp-btn" disabled={busy} onClick={() => void submit()}>Submit payout request</button>
      </article>
    </section>
  );
}

/* ───────────────────────── Settings ───────────────────────── */

function Settings(p: { obj: Row; online: boolean; radius: string; setRadius: (s: string) => void; busy: boolean; send: Send; setError: (s: string) => void }) {
  const saveRadius = () => {
    const n = Number(p.radius);
    if (!Number.isInteger(n) || n < 1 || n > 100) return p.setError('Service radius must be a whole number from 1 to 100 km.');
    void p.send('/api/supplier/settings', 'PUT', { zone_radius_km: n }, 'Service radius saved.');
  };
  return (
    <section className="sp-grid">
      <article className="sp-card">
        <h2 className="sp-h2">Availability</h2>
        <p className="sp-sub">Online suppliers can receive new orders. Pending orders are retried when you go online.</p>
        <div className="sp-row">
          <StatusBadge status={p.online ? 'online' : 'offline'} />
          <button className="sp-btn" disabled={p.busy} onClick={() => void p.send('/api/supplier/settings', 'PUT', { is_online: !p.online }, p.online ? 'You are offline.' : 'You are online.')}>
            {p.online ? 'Go offline' : 'Go online'}
          </button>
        </div>
        <label className="sp-field" htmlFor="radius">Service radius (km)
          <input id="radius" className="sp-input" type="number" min={1} max={100} value={p.radius} onChange={(e) => p.setRadius(e.target.value)} />
        </label>
        <button className="sp-btn" disabled={p.busy} onClick={saveRadius}>Save radius</button>
        <p className="sp-hint">To change your dispatch location, use the location button on the dashboard.</p>
      </article>
      <article className="sp-card">
        <h2 className="sp-h2">Current configuration</h2>
        <dl className="sp-dl">
          {Object.entries(p.obj).filter(([, v]) => typeof v !== 'object').map(([k, v]) => (
            <FragmentRow key={k} k={label(k)} v={str(v, '—')} />
          ))}
        </dl>
      </article>
    </section>
  );
}

/* ───────────────────────── Analytics & support ───────────────────────── */

function Analytics({ rows }: { rows: Row[] }) {
  const count = (set: string[]) => rows.filter((o) => set.includes(norm(o.status))).length;
  return (
    <section className="sp-grid">
      <Metric name="Orders in list" value={String(rows.length)} />
      <Metric name="Completed" value={String(count(['completed', 'delivered']))} />
      <Metric name="Active" value={String(count(['assigned', 'in_progress']))} />
      <article className="sp-card sp-wide">
        <h2 className="sp-h2">About these numbers</h2>
        <p className="sp-sub">They count the orders currently returned by your orders list. For revenue and payouts, use the Earnings page, which reads from the accounting source.</p>
        <Link href="/supplier/earnings" className="sp-link">Open earnings</Link>
      </article>
    </section>
  );
}

function Support() {
  return (
    <section className="sp-grid">
      <article className="sp-card sp-wide">
        <h2 className="sp-h2">If an order isn’t reaching you</h2>
        <ol className="sp-steps">
          <li>Check that you are online in Dispatch settings.</li>
          <li>Confirm your dispatch location and service radius.</li>
          <li>Check that you have enough available cans in Inventory.</li>
          <li>Refresh the Orders page.</li>
        </ol>
        <p className="sp-sub">If a valid order still doesn’t assign, send the order ID to your platform administrator for a dispatch-log review. Never share banking secrets or customer payment details in messages.</p>
        <Link href="/supplier/settings" className="sp-link">Check dispatch settings</Link>
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
  const tone = ['completed', 'delivered', 'online'].includes(status) ? 'ok' : ['in_progress'].includes(status) ? 'amber' : ['cancelled', 'offline'].includes(status) ? 'off' : 'info';
  return <span className={`sp-badge sp-badge--${tone}`}>{label(status) || 'unknown'}</span>;
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
.sp-head{max-width:760px}
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
@media (max-width:520px){.sp-dl{grid-template-columns:1fr}.sp-dl dt{margin-top:6px}.sp-refresh{margin-left:0}}
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
//             <button style={button} disabled={busy} onClick={()=>void send(`/api/supplier/orders/${String(o.id)}/accept`,'PUT',{})}>Accept order</button>
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
