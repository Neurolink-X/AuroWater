'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !cancelled) {
        setHasSession(true);
        setReady(true);
      }
    });

    void (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            window.history.replaceState({}, '', '/auth/update-password');
          }
        }
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          setHasSession(true);
          setReady(true);
          return;
        }
      } catch {
        /* hash session may still arrive via onAuthStateChange */
      }
      window.setTimeout(() => {
        if (!cancelled) setReady(true);
      }, 2200);
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Password updated. Sign in with the new password.');
      window.location.assign('/login');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A1628] px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8">
        <h1 className="font-[Syne] text-2xl font-black">Set a new password</h1>
        {!ready ? (
          <p className="mt-4 text-sm text-white/55">Opening your reset link…</p>
        ) : !hasSession ? (
          <div className="mt-4 space-y-3 text-sm text-white/70">
            <p>This reset link is missing or expired. Request a new one from Forgot password.</p>
            <Link href="/auth/forgot-password" className="block font-bold text-cyan-300">
              Request a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)}>
            <p className="mt-2 text-sm text-white/55">Choose a new password for this account.</p>
            <input
              type="password"
              className="mt-6 w-full rounded-xl border border-white/10 bg-[#0A1628] px-3 py-2.5"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 font-extrabold text-slate-950 disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}
        <Link href="/login" className="mt-4 block text-center text-sm text-cyan-300">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
