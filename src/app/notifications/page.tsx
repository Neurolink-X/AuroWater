'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellOff, Check, RefreshCw, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Preferences = {
  configured: boolean; vapid_public_key: string | null;
  enabled: boolean; marketing: boolean; devices: number;
};
type Notice = {
  id: string; title: string; message: string; type: string;
  is_read: boolean; created_at: string;
};

async function authedRequest<T>(
  path: string, method = 'GET', payload?: Record<string, unknown>,
): Promise<T> {
  const supabase = createClient();
  const { data, error: sessionError } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (sessionError || !token) throw new Error('Sign in to manage your notifications.');
  const res = await fetch(path, {
    method, cache: 'no-store', credentials: 'same-origin',
    headers: {
      'Authorization': 'Bearer ' + token,
      ...(payload ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const json = await res.json().catch(() => ({})) as {
    success?: boolean; data?: T; error?: string;
  };
  if (!res.ok || json.success === false) {
    throw new Error(json.error || 'Notification service temporarily unavailable');
  }
  return json.data as T;
}

function publicKeyToBytes(encoded: string): Uint8Array {
  const padded = (encoded.replace(/-/g, '+').replace(/_/g, '/') + '===').slice(0,
    Math.ceil(encoded.length / 4) * 4);
  const raw = atob(padded);
  const key = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index++) key[index] = raw.charCodeAt(index);
  return key;
}

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const inFlightRef = useRef(false);
  const lastSyncRef = useRef(0);

  const load = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const [current, inbox] = await Promise.all([
        authedRequest<Preferences>('/api/notifications/push'),
        authedRequest<Notice[]>('/api/notifications/inbox'),
      ]);
      setPrefs(current);
      setNotices(inbox);
      lastSyncRef.current = Date.now();
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load notifications.');
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    // Refresh only when the user returns; never start background polling.
    const onReturn = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastSyncRef.current > 15_000) void load();
    };
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, [load]);

  const enable = async () => {
    if (!prefs?.configured || !prefs.vapid_public_key || busy) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) ||
        !('PushManager' in window)) {
      setError('Browser push is not supported here. Try an installed AuroTap PWA in a supported browser.');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      // Browser permission is requested ONLY from this deliberate user click.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Permission was not granted. You can still view orders and alerts in the app.');
        return;
      }
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKeyToBytes(prefs.vapid_public_key),
        });
      }
      const subscriptionJson = subscription.toJSON();
      if (!subscription.endpoint || !subscriptionJson.keys?.p256dh ||
          !subscriptionJson.keys?.auth) throw new Error('Device subscription is incomplete.');
      await authedRequest('/api/notifications/push', 'POST', {
        action: 'subscribe',
        subscription: {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscriptionJson.keys.p256dh,
            auth: subscriptionJson.keys.auth,
          },
        },
      });
      setStatus('Phone notifications enabled for this account.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not enable phone notifications.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (busy) return;
    setBusy(true);
    setStatus('');
    try {
      // Disable server-side first, so subsequent events will not be sent.
      await authedRequest('/api/notifications/push', 'POST', { action: 'disable' });
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration('/');
          const subscription = await registration?.pushManager.getSubscription();
          await subscription?.unsubscribe();
        } catch { /* already disabled on server */ }
      }
      setStatus('Phone notifications disabled. Your order history stays available.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not disable notifications.');
    } finally {
      setBusy(false);
    }
  };

  const setMarketing = async (enabled: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await authedRequest('/api/notifications/push', 'POST', { action: 'marketing', enabled });
      setPrefs(prev => prev ? { ...prev, marketing: enabled } : prev);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update preferences.');
    } finally {
      setBusy(false);
    }
  };

  const markRead = async (id?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await authedRequest('/api/notifications/inbox', 'PATCH', id ? { id } : { all: true });
      setNotices(prev => prev.map(n => !id || n.id === id ? { ...n, is_read: true } : n));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not mark notifications as read.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-7 sm:py-10">
      <header className="space-y-2">
        <Link href="/" className="text-sm font-semibold text-blue-700 hover:underline">AuroTap home</Link>
        <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Notifications & preferences</h1>
        <p className="text-sm text-slate-600">Control phone alerts for this device and account. New orders and job updates remain available in the app even if push is disabled.</p>
      </header>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error} {error.includes('Sign in') && <Link href="/auth/login?redirect=/notifications" className="font-bold underline">Sign in</Link>}</p>}
      {status && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{status}</p>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            {prefs?.enabled ? <Bell className="mt-1 text-emerald-600" size={22}/> :
              <BellOff className="mt-1 text-slate-500" size={22}/>}
            <div>
              <h2 className="font-extrabold text-slate-950">Phone push notifications</h2>
              <p className="mt-1 text-sm text-slate-600">New eligible job offers, booking progress and payment-related updates. Permission is optional.</p>
            </div>
          </div>
          {prefs && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{prefs.enabled ? 'Enabled' : 'Off'}</span>}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={() => void enable()}
            disabled={busy || loading || !prefs?.configured || prefs?.enabled}
            className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
            Enable on this phone
          </button>
          <button type="button" onClick={() => void disable()}
            disabled={busy || loading || !prefs?.enabled}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 disabled:opacity-40">
            Disable all my push alerts
          </button>
        </div>
        {prefs && !prefs.configured && <p className="mt-3 text-xs text-amber-800">Push delivery is being configured. In-app notifications remain accessible.</p>}
        {prefs && <p className="mt-3 text-xs text-slate-500">{prefs.devices} registered device(s). Up to 3 per account. Browser and operating-system permission also apply.</p>}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="text-sm text-slate-800"><strong>Promotional alerts</strong><span className="block text-xs text-slate-500">Optional offers and marketing; off by default.</span></span>
            <input type="checkbox" checked={prefs?.marketing ?? false} disabled={busy || !prefs}
              onChange={e => void setMarketing(e.target.checked)}
              className="h-5 w-5 accent-emerald-700" aria-label="Allow promotional push alerts"/>
          </label>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          <ShieldCheck size={18} className="shrink-0 text-emerald-700"/>
          <span>Permission can be withdrawn here or in browser settings. Declining push never blocks bookings or accepting jobs. Phone alerts are best-effort, not a guarantee of delivery.</span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-extrabold text-slate-950">Your in-app notifications</h2>
            <p className="text-xs text-slate-500">Latest 25. These remain available without phone permission.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading || busy}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40">
            <RefreshCw size={15}/> Refresh
          </button>
        </div>
        {!loading && notices.some(n => !n.is_read) &&
          <button type="button" onClick={() => void markRead()} disabled={busy}
            className="mb-3 flex items-center gap-1 text-xs font-bold text-blue-700 disabled:opacity-50">
            <Check size={14}/> Mark all as read
          </button>}
        {loading ? <p className="py-4 text-sm text-slate-500">Loading…</p> :
          notices.length === 0 ? <p className="py-5 text-sm text-slate-500">No notifications yet. Your order and job timelines continue to work normally.</p> :
            <div className="divide-y divide-slate-100">
              {notices.map(item => (
                <article key={item.id} className="flex items-start justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 break-words text-sm text-slate-600">{item.message}</p>
                    <time className="mt-1 block text-xs text-slate-400" dateTime={item.created_at}>
                      {new Date(item.created_at).toLocaleString('en-IN')}
                    </time>
                  </div>
                  {!item.is_read && <button type="button" onClick={() => void markRead(item.id)}
                    disabled={busy} className="shrink-0 rounded-md px-2 py-1 text-xs font-bold text-emerald-700 disabled:opacity-40">Read</button>}
                </article>
              ))}
            </div>}
      </section>
    </main>
  );
}
