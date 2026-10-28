// src/components/ui/DatabaseErrorBanner.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Friendly banner when APIs fail.
 * Understands 4 situations: database setup, network, access, and general.
 */

type ErrorKind = 'setup' | 'network' | 'auth' | 'generic';

type DatabaseErrorBannerProps = {
  message: string;
  /** Optional: shows a "Try again" button. */
  onRetry?: () => void | Promise<void>;
  className?: string;
};

const SETUP_RE =
  /\b(PGRST205|DB_NOT_READY|schema cache|Database not ready|ALL_MIGRATIONS_ORDERED|MISCONFIG_ENV|SERVICE_ROLE_MISSING)\b/i;

const NETWORK_RE =
  /(failed to fetch|network ?error|timed? ?out|timeout|econn|enotfound|offline)/i;

const AUTH_RE =
  /\b(401|403|unauthori[sz]ed|forbidden|jwt expired|invalid token)\b/i;

const RELOAD_SQL = "SELECT pg_notify('pgrst', 'reload schema');";

const KINDS: Record<
  ErrorKind,
  { title: string; hint: string | null; box: string; button: string }
> = {
  setup: {
    title: 'Database setup required',
    hint: null,
    box: 'border-amber-200 bg-amber-50 text-amber-950',
    button:
      'border-amber-300 bg-white/80 text-amber-950 hover:bg-white focus-visible:ring-amber-500',
  },
  network: {
    title: 'Connection problem',
    hint: 'Check your internet and try again.',
    box: 'border-sky-200 bg-sky-50 text-sky-950',
    button:
      'border-sky-300 bg-white/80 text-sky-950 hover:bg-white focus-visible:ring-sky-500',
  },
  auth: {
    title: 'Access problem',
    hint: 'Please sign in again. If it keeps happening, check that this account has access.',
    box: 'border-rose-200 bg-rose-50 text-rose-900',
    button:
      'border-rose-300 bg-white/80 text-rose-900 hover:bg-white focus-visible:ring-rose-500',
  },
  generic: {
    title: 'Unable to load data',
    hint: null,
    box: 'border-rose-200 bg-rose-50 text-rose-900',
    button:
      'border-rose-300 bg-white/80 text-rose-900 hover:bg-white focus-visible:ring-rose-500',
  },
};

function detectKind(message: string): ErrorKind {
  if (SETUP_RE.test(message)) return 'setup';
  if (NETWORK_RE.test(message)) return 'network';
  if (AUTH_RE.test(message)) return 'auth';
  return 'generic';
}

function WarningIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d="M12 3 2.5 20h19L12 3Z"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 10v4.5" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function DatabaseErrorBanner({
  message,
  onRetry,
  className = '',
}: DatabaseErrorBannerProps) {
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const text = message?.trim() || 'Something went wrong. Please try again.';
  const kind = useMemo(() => detectKind(text), [text]);
  const style = KINDS[kind];
  const isSetup = kind === 'setup';

  // Clean up the timer if the banner disappears.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(RELOAD_SQL);
      setCopied(true);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the command is still visible on screen.
      setCopied(false);
    }
  }, []);

  const handleRetry = useCallback(async () => {
    if (!onRetry || retrying) return;

    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }, [onRetry, retrying]);

  const buttonBase =
    'inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div
      role="alert"
      className={`rounded-2xl border p-4 ${style.box} ${className}`}
    >
      <div className="flex items-start gap-3">
        <WarningIcon />

        <div className="min-w-0 flex-1">
          <div className="mb-1 text-sm font-extrabold">{style.title}</div>

          <p className="break-words text-sm leading-relaxed opacity-95">
            {text}
          </p>

          {style.hint ? (
            <p className="mt-2 text-xs font-semibold opacity-80">
              {style.hint}
            </p>
          ) : null}

          {isSetup ? (
            <p className="mt-2 text-xs font-semibold text-amber-900/90">
              Run{' '}
              <code className="rounded bg-white/80 px-1.5 py-0.5">
                sql/ALL_MIGRATIONS_ORDERED.sql
              </code>{' '}
              in the Supabase SQL Editor, then execute{' '}
              <code className="break-all rounded bg-white/80 px-1.5 py-0.5">
                {RELOAD_SQL}
              </code>
            </p>
          ) : null}

          {(onRetry || isSetup) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {onRetry && (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={retrying}
                  className={`${buttonBase} ${style.button}`}
                >
                  {retrying && (
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                    />
                  )}
                  {retrying ? 'Trying…' : 'Try again'}
                </button>
              )}

              {isSetup && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`${buttonBase} ${style.button}`}
                >
                  {copied ? 'Copied ✓' : 'Copy reload command'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DatabaseErrorBanner;
