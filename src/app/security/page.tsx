import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react';

import { pageMeta } from '@/lib/seo';

const SECURITY_EMAIL = 'security@aurotap.in';

export const metadata: Metadata = {
  ...pageMeta(
    'AuroTap Security | Data Protection & Vulnerability Reporting',
    'Learn how AuroTap protects customer accounts, orders and service data with authentication, access controls, database security and responsible vulnerability reporting.',
    '/security'
  ),
  keywords: [
    'AuroTap security',
    'AuroWater security',
    'AuroTap data security',
    'water delivery data protection',
    'AuroTap vulnerability reporting',
    'AuroTap privacy and security',
  ],
  robots: {
    index: true,
    follow: true,
  },
};

const securitySchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'AuroTap Security',
  url: 'https://aurotap.in/security',
  description:
    'How AuroTap protects customer accounts, orders and service data and how to report a security vulnerability.',
  isPartOf: {
    '@type': 'WebSite',
    name: 'AuroTap',
    url: 'https://aurotap.in/',
  },
};

const controls = [
  {
    icon: LockKeyhole,
    title: 'Protected authentication',
    description:
      'Customer and professional accounts use authenticated sessions. Access to private account data is checked before protected operations are performed.',
  },
  {
    icon: ShieldCheck,
    title: 'Database access controls',
    description:
      'AuroTap uses PostgreSQL Row Level Security (RLS) policies to restrict database rows according to the signed-in user and application role.',
  },
  {
    icon: UserRoundCheck,
    title: 'Role-based access',
    description:
      'Customer, technician, supplier and admin responsibilities are separated. Administrative access is not exposed as a public client-side switch.',
  },
  {
    icon: KeyRound,
    title: 'Server-side secrets',
    description:
      'Sensitive service credentials are kept on the server side. The application does not intentionally expose privileged database credentials to the browser.',
  },
] as const;

const dataLayers = [
  'Account details such as name, email address, phone number and city.',
  'Booking information such as service, schedule, delivery address and order status.',
  'Payment-verification information when a payment workflow requires it, including transaction metadata and uploaded proof links.',
  'Operational information used to coordinate delivery or service work, where applicable.',
] as const;

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eaf8ff_0%,#f8fbff_42%,#ffffff_100%)] text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(securitySchema),
        }}
      />

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
            Security
          </span>
        </nav>

        <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-slate-950 shadow-[0_30px_90px_rgba(15,23,42,0.16)]">
          <div className="relative px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-500" />

            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

            <div className="relative grid gap-10 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Security & trust
                </div>

                <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">
                  Security is part of the product.
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                  AuroTap is designed so account access, customer data and operational
                  records are protected by multiple layers — authentication, server-side
                  authorization and database-level access controls.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <a
                    href={`mailto:${SECURITY_EMAIL}?subject=AuroTap%20Security%20Report`}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-slate-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-cyan-50"
                  >
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    Report a vulnerability
                  </a>

                  <Link
                    href="/privacy"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                  >
                    Privacy policy
                    <ArrowRight
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  </Link>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
                  Our approach
                </p>

                <div className="mt-4 space-y-4">
                  {[
                    'Least-privilege access',
                    'Authenticated requests',
                    'Database-level authorization',
                    'Responsible vulnerability reporting',
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-3"
                    >
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300"
                        aria-hidden="true"
                      />
                      <p className="text-sm font-semibold text-slate-200">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {controls.map((item) => {
            const Icon = item.icon;

            return (
              <article
                key={item.title}
                className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.06)]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                  <Icon
                    className="h-5 w-5"
                    aria-hidden="true"
                  />
                </div>

                <h2 className="mt-5 text-lg font-extrabold tracking-tight text-slate-950">
                  {item.title}
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {item.description}
                </p>
              </article>
            );
          })}
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.86fr]">
          <article className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)] sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <ShieldCheck
                  className="h-5 w-5"
                  aria-hidden="true"
                />
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                  Data protection
                </p>
                <h2 className="text-xl font-extrabold tracking-tight text-slate-950">
                  What we protect
                </h2>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {dataLayers.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                >
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />

                  <p className="text-sm leading-6 text-slate-600">
                    {item}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-5 text-xs leading-5 text-slate-500">
              Infrastructure providers such as Supabase use encrypted network
              connections and encrypted storage protections. AuroTap remains
              responsible for configuring its own application-level permissions
              and access policies correctly.
            </p>
          </article>

          <aside className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-blue-50 p-6 sm:p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-cyan-700 shadow-sm">
              <AlertTriangle
                className="h-5 w-5"
                aria-hidden="true"
              />
            </div>

            <h2 className="mt-5 text-xl font-extrabold tracking-tight text-slate-950">
              Reporting a vulnerability
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Please report suspected security issues before sharing them publicly.
              We ask researchers to avoid accessing, changing or deleting customer
              data while validating a finding.
            </p>

            <div className="mt-5 rounded-2xl border border-cyan-100 bg-white/80 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                Security contact
              </p>

              <a
                href={`mailto:${SECURITY_EMAIL}?subject=AuroTap%20Security%20Report`}
                className="mt-1 inline-flex items-center gap-2 text-sm font-extrabold text-cyan-700 hover:underline"
              >
                {SECURITY_EMAIL}
                <ExternalLink
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                />
              </a>
            </div>

            <div className="mt-5 space-y-2 text-xs leading-5 text-slate-500">
              <p>Include the affected URL or feature.</p>
              <p>Describe the steps needed to reproduce the issue.</p>
              <p>Explain the potential impact and any evidence.</p>
              <p>Remove passwords, OTPs and customer personal information.</p>
            </div>
          </aside>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)] sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                Related policies
              </p>

              <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-950">
                See how AuroTap handles privacy and cookies
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Security and privacy work together: security protects information,
                while the privacy policy explains what information AuroTap collects,
                why it is used and the choices available to you.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/privacy"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Privacy policy
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>

              <Link
                href="/cookies"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Cookie policy
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <p className="mt-6 text-center text-xs leading-5 text-slate-400">
          Last updated: 6 October 2026 · AuroTap security information is
          reviewed as the platform changes.
        </p>
      </div>
    </main>
  );
}
