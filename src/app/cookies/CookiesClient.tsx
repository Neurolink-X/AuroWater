'use client';

import {
  CheckCircle2,
  ChevronRight,
  Cookie,
  Info,
  LockKeyhole,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';

import { safeGet, safeSet } from '@/lib/storage';

const PREF_KEY = 'aw_cookie_prefs';

type Prefs = {
  essential: true;
  analytics: boolean;
};

const cookieRows = [
  {
    name: 'aw_session / aw_role',
    purpose:
      'Maintain essential authentication and application routing state for the signed-in experience.',
    duration: 'Session / up to 7 days',
    type: 'Essential',
  },
  {
    name: 'aurowater_session',
    purpose:
      'Maintain dashboard/session continuity used by the application.',
    duration: 'Until logout',
    type: 'Essential',
  },
  {
    name: 'aw_cookie_prefs',
    purpose:
      'Remember your cookie preference so the site does not repeatedly ask for the same choice.',
    duration: 'Up to 1 year',
    type: 'Essential',
  },
] as const;

export default function CookiesClient() {
  const [prefs, setPrefs] = useState<Prefs>({
    essential: true,
    analytics: false,
  });

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = safeGet(PREF_KEY);

    if (!raw) return;

    try {
      const parsed =
        JSON.parse(raw) as Partial<Prefs>;

      setPrefs({
        essential: true,
        analytics: Boolean(
          parsed.analytics
        ),
      });
    } catch {
      /* Ignore malformed local preference data. */
    }
  }, []);

  const save = (
    next: Prefs
  ) => {
    setPrefs(next);
    safeSet(
      PREF_KEY,
      JSON.stringify(next)
    );

    setSaved(true);

    window.setTimeout(() => {
      setSaved(false);
    }, 2200);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eaf8ff_0%,#f9fcff_45%,#ffffff_100%)] text-slate-900">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
        <nav
          aria-label="Breadcrumb"
          className="mb-8 flex items-center gap-2 text-sm font-semibold text-slate-500"
        >
          <Link
            href="/"
            className="transition hover:text-cyan-700"
          >
            Home
          </Link>

          <ChevronRight
            className="h-4 w-4 text-slate-300"
            aria-hidden="true"
          />

          <span
            className="text-slate-900"
            aria-current="page"
          >
            Cookie Policy
          </span>
        </nav>

        <header className="overflow-hidden rounded-[2rem] border border-white/80 bg-slate-950 shadow-[0_30px_90px_rgba(15,23,42,0.14)]">
          <div className="relative px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-500" />

            <div className="relative grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
                  <Cookie
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                  Cookies & browser storage
                </div>

                <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">
                  Cookie choices, made clear.
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                  AuroTap uses a small amount of essential browser storage to
                  keep the service working. This page explains what is used,
                  why it is needed and how your optional analytics preference
                  is stored.
                </p>

                <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-slate-400">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    Last updated: 6 October 2026
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    No third-party advertising cookies
                  </span>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200">
                  <ShieldCheck
                    className="h-5 w-5"
                    aria-hidden="true"
                  />
                </div>

                <p className="mt-4 text-sm font-bold text-white">
                  Essential first.
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Essential storage supports core product functions.
                  Optional preferences should never be treated as required
                  for basic access to the service.
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <article className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.04)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
              <LockKeyhole
                className="h-5 w-5"
                aria-hidden="true"
              />
            </div>

            <h2 className="mt-4 text-base font-extrabold text-slate-950">
              Essential storage
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-600">
              Used for authentication, session continuity and essential
              application preferences.
            </p>
          </article>

          <article className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.04)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Settings2
                className="h-5 w-5"
                aria-hidden="true"
              />
            </div>

            <h2 className="mt-4 text-base font-extrabold text-slate-950">
              Your preference
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-600">
              Your optional analytics choice is saved locally in your browser.
            </p>
          </article>

          <article className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.04)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <ShieldCheck
                className="h-5 w-5"
                aria-hidden="true"
              />
            </div>

            <h2 className="mt-4 text-base font-extrabold text-slate-950">
              No ad cookies
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-600">
              The current AuroTap cookie policy does not use third-party
              advertising cookies.
            </p>
          </article>
        </section>

        <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-100 px-6 py-6 sm:px-8">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                <Cookie
                  className="h-5 w-5"
                  aria-hidden="true"
                />
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">
                  Storage details
                </p>

                <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-950">
                  What AuroTap stores in your browser
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  The table below reflects the application&apos;s current
                  client-side storage and session-cookie design.
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-5 py-4 sm:px-8">
                    Name
                  </th>
                  <th className="px-5 py-4">
                    Purpose
                  </th>
                  <th className="px-5 py-4">
                    Duration
                  </th>
                  <th className="px-5 py-4">
                    Type
                  </th>
                </tr>
              </thead>

              <tbody>
                {cookieRows.map(
                  (row) => (
                    <tr
                      key={row.name}
                      className="border-t border-slate-100 align-top"
                    >
                      <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-800 sm:px-8">
                        {row.name}
                      </td>

                      <td className="px-5 py-4 leading-6 text-slate-600">
                        {row.purpose}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {row.duration}
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          {row.type}
                        </span>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.8fr]">
          <article className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)] sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <Settings2
                  className="h-5 w-5"
                  aria-hidden="true"
                />
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                  Preferences
                </p>

                <h2 className="text-xl font-extrabold tracking-tight text-slate-950">
                  Choose your optional settings
                </h2>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between gap-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <div>
                  <p className="text-sm font-extrabold text-slate-900">
                    Essential
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Always enabled because it supports core application
                    functionality.
                  </p>
                </div>

                <span className="inline-flex shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                  Always on
                </span>
              </div>

              <label className="flex cursor-pointer items-center justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-cyan-200 hover:bg-cyan-50/30">
                <span>
                  <span className="block text-sm font-extrabold text-slate-900">
                    Optional analytics
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    Save your preference for optional analytics features.
                  </span>
                </span>

                <input
                  type="checkbox"
                  checked={prefs.analytics}
                  onChange={(event) =>
                    save({
                      essential: true,
                      analytics:
                        event.target.checked,
                    })
                  }
                  className="h-5 w-5 shrink-0 accent-cyan-700"
                  aria-label="Allow optional analytics"
                />
              </label>
            </div>

            <div
              aria-live="polite"
              className={[
                'mt-4 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                saved
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-50 text-slate-500',
              ].join(' ')}
            >
              {saved
                ? 'Preference saved on this device.'
                : prefs.analytics
                  ? 'Optional analytics preference is currently enabled.'
                  : 'Optional analytics preference is currently disabled.'}
            </div>
          </article>

          <aside className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-blue-50 p-6 sm:p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-cyan-700 shadow-sm">
              <Info
                className="h-5 w-5"
                aria-hidden="true"
              />
            </div>

            <h2 className="mt-5 text-xl font-extrabold tracking-tight text-slate-950">
              What does this mean?
            </h2>

            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <p>
                Essential storage helps AuroTap remember the state required
                for the application to function correctly.
              </p>

              <p>
                Your optional analytics setting is saved in your browser so
                the site can remember your choice.
              </p>

              <p>
                The current application does not include a third-party
                advertising cookie system.
              </p>
            </div>
          </aside>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.04)] sm:p-8">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <ShieldCheck
                className="h-5 w-5"
                aria-hidden="true"
              />
            </div>

            <div>
              <h2 className="text-lg font-extrabold text-slate-950">
                Cookies, privacy and security
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-600">
                Cookies are only one part of AuroTap&apos;s data practices.
                Read the privacy policy for information about personal data,
                and the security page for application and database security
                controls.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/privacy"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Privacy policy
              <ChevronRight
                className="h-4 w-4"
                aria-hidden="true"
              />
            </Link>

            <Link
              href="/security"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Security
              <ChevronRight
                className="h-4 w-4"
                aria-hidden="true"
              />
            </Link>

            <Link
              href="/terms"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Terms of Service
              <ChevronRight
                className="h-4 w-4"
                aria-hidden="true"
              />
            </Link>
          </div>
        </section>

        <div className="mt-7 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
            aria-hidden="true"
          />

          <p className="text-xs leading-5 text-amber-900">
            Browser settings can also block or delete cookies and local
            storage. Doing so may affect parts of AuroTap that depend on
            authentication or saved preferences.
          </p>
        </div>

        <p className="mt-6 pb-4 text-center text-xs leading-5 text-slate-400">
          AuroTap · Cookie Policy · Last updated 6 October 2026
        </p>
      </div>
    </main>
  );
}
