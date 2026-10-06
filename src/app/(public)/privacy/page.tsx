import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileText,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import { pageMeta } from '@/lib/seo';

const PRIVACY_EMAIL = 'support.aurotap@gmail.com';
const SECURITY_EMAIL = 'security@aurotap.in';

export const metadata: Metadata = {
  ...pageMeta(
    'Privacy Policy | AuroTap Water Delivery & Home Services',
    'Read the AuroTap Privacy Policy: what personal data we collect, why we use it, how it is protected, your choices and how to contact us about privacy.',
    '/privacy'
  ),
  keywords: [
    'AuroTap privacy policy',
    'AuroWater privacy policy',
    'water delivery privacy policy India',
    'AuroTap personal data',
    'AuroTap data protection',
  ],
  robots: {
    index: true,
    follow: true,
  },
};

const privacySchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'AuroTap Privacy Policy',
  url: 'https://aurotap.in/privacy',
  description:
    'Privacy information for AuroTap customers, technicians and suppliers.',
  isPartOf: {
    '@type': 'WebSite',
    name: 'AuroTap',
    url: 'https://aurotap.in/',
  },
};

const sections = [
  {
    id: 'information-we-collect',
    title: '1. Information we collect',
    intro:
      'The information AuroTap receives depends on how you use the platform.',
    points: [
      {
        title: 'Account information',
        text:
          'Depending on how you use AuroTap, we may collect the information you provide for your account, such as your name, email address, phone number and city. During registration, the account type is used to provide the appropriate customer, technician or supplier experience; administrative access is separately restricted.',
      },
      {
        title: 'Addresses and delivery details',
        text:
          'For bookings, we may collect the address and delivery details you provide, such as house or flat information, area, city, pincode and landmark. Where the service uses location coordinates, latitude and longitude may also be associated with a saved address or operational record.'
      },
      {
        title: 'Orders and service activity',
        text:
          'We keep information needed to process and support bookings, including the service selected, schedule, order status, pricing, payment method, delivery assignment and related service notes.',
      },
      {
        title: 'Payments and verification',
        text:
          'Depending on the payment workflow, we may process payment status, transaction references and payment-verification evidence such as a submitted screenshot or its storage link. Do not submit card PINs, UPI PINs, passwords or OTPs in a screenshot or message.',
      },
      {
        title: 'Feedback and support',
        text:
          'Reviews, ratings, issue categories, issue descriptions and support messages may be stored so we can improve service quality and resolve customer problems.',
      },
      {
        title: 'Operational and technical information',
        text:
          'The platform may process authentication and session information, security logs, and limited technical information needed to operate, secure and troubleshoot the service.'
      },
    ],
  },
  {
    id: 'how-we-use-information',
    title: '2. How we use your information',
    intro:
      'We use personal information for defined business and service purposes, including:',
    points: [
      {
        title: 'Provide the service',
        text:
          'Create and manage accounts, accept bookings, deliver water or coordinate requested home services, process payments and provide customer support.',
      },
      {
        title: 'Operate and improve AuroTap',
        text:
          'Understand service usage, maintain order records, measure service quality, investigate complaints and improve product reliability and customer experience.',
      },
      {
        title: 'Security and fraud prevention',
        text:
          'Authenticate users, protect accounts and systems, detect abuse or suspicious activity, enforce access controls and investigate security incidents.',
      },
      {
        title: 'Communications',
        text:
          'Send service-related messages such as booking confirmations, delivery updates, account notices and support responses. Optional marketing communications are subject to your preferences and applicable law.',
      },
      {
        title: 'Legal and compliance purposes',
        text:
          'Maintain records and respond to lawful requests, disputes, audits, regulatory requirements or other obligations that apply to the service.',
      },
    ],
  },
  {
    id: 'sharing',
    title: '3. When information may be shared',
    intro:
      'AuroTap does not sell personal information as a product to third-party advertisers. Information may be shared only when needed to operate the service, protect users, or comply with law.',
    points: [
      {
        title: 'Service providers',
        text:
          'We may use trusted technology and infrastructure providers for hosting, authentication, database services, communications, geocoding or related platform functions.',
      },
      {
        title: 'Service participants',
        text:
          'Information necessary to fulfil an order may be made available to the supplier, technician or operational team responsible for that booking.',
      },
      {
        title: 'Legal and safety requirements',
        text:
          'We may disclose information when required by applicable law, legal process, court order, or where reasonably necessary to protect the safety, rights or security of users, AuroTap or others.',
      },
    ],
  },
  {
    id: 'security',
    title: '4. Data security',
    intro:
      'AuroTap uses technical and organisational controls designed to reduce the risk of unauthorised access, loss, misuse or alteration.',
    points: [
      {
        title: 'Authentication and authorization',
        text:
          'Protected operations require authenticated requests. Application roles and database policies are used to limit access to data.',
      },
      {
        title: 'Database controls',
        text:
          'AuroTap uses PostgreSQL Row Level Security (RLS) so access rules can be enforced at the database layer.',
      },
      {
        title: 'Encrypted infrastructure connections',
        text:
          'Our managed database infrastructure uses encrypted network connections and encrypted storage protections. Security is shared between the platform provider and AuroTap application configuration.',
      },
      {
        title: 'Security reporting',
        text:
          'Suspected vulnerabilities can be reported privately to security@aurotap.in so they can be assessed and addressed.',
      },
    ],
  },
  {
    id: 'retention',
    title: '5. Retention and deletion',
    intro:
      'We retain information only for as long as reasonably necessary for the purpose for which it was collected, including service delivery, security, dispute handling and applicable legal or accounting requirements.',
    points: [
      {
        title: 'Account and service records',
        text:
          'Records connected to bookings, payments, support and disputes may need to be retained after a particular service is completed.',
      },
      {
        title: 'Deletion requests',
        text:
          'You may ask us to delete personal information subject to applicable law and legitimate retention requirements. Where deletion is not possible or appropriate, we will explain the relevant limitation when required.',
      },
    ],
  },
  {
    id: 'your-choices',
    title: '6. Your choices and rights',
    intro:
      'Subject to applicable law, you may have rights and choices relating to your personal data.',
    points: [
      {
        title: 'Access and information',
        text:
          'You can contact us to ask about the personal information associated with your account and how it is used, subject to applicable legal limits and verification requirements.'
      },
      {
        title: 'Correction',
        text:
          'You can request correction of personal information that is inaccurate or incomplete.'
      },
      {
        title: 'Deletion',
        text:
          'You can request deletion of personal information where the law permits it and no valid retention requirement applies.',
      },
      {
        title: 'Consent and marketing choices',
        text:
          'Where processing is based on consent, you may be able to withdraw that consent. You can also control optional marketing preferences available in your account.',
      },
      {
        title: 'Grievance redressal',
        text:
          'You can raise a privacy concern or grievance by contacting us using the details below.',
      },
    ],
  },
  {
    id: 'cookies',
    title: '7. Cookies and similar storage',
    intro:
      'AuroTap uses essential cookies and browser storage to keep the product working, maintain session or account state and remember certain preferences.',
    points: [
      {
        title: 'Essential storage',
        text:
          'Session-related cookies and local browser storage may be used for authentication state, dashboard continuity and essential preferences.',
      },
      {
        title: 'Optional analytics preferences',
        text:
          'AuroTap provides a preference for optional analytics in its cookie policy. Non-essential tracking should not be enabled without the relevant product configuration and user choice.',
      },
      {
        title: 'Advertising cookies',
        text:
          'The current AuroTap cookie policy states that third-party advertising cookies are not used.',
      },
    ],
  },
  {
    id: 'children',
    title: '8. Children’s privacy',
    intro:
      'AuroTap is a general consumer service and is not directed specifically to children.',
    points: [
      {
        title: 'Use by minors',
        text:
          'We do not knowingly ask children to provide personal information for an independent account. If you believe a child has provided information improperly, please contact us so we can review the situation.',
      },
    ],
  },
  {
    id: 'changes',
    title: '9. Changes to this policy',
    intro:
      'We may update this policy when our services, security controls, data practices or legal obligations change.',
    points: [
      {
        title: 'Updated version',
        text:
          'Material changes will be reflected on this page with a new “Last updated” date. Continued use of the service after an update is subject to the revised policy to the extent permitted by law.',
      },
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eaf8ff_0%,#f9fcff_45%,#ffffff_100%)] text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(privacySchema),
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
            Privacy Policy
          </span>
        </nav>

        <header className="overflow-hidden rounded-[2rem] border border-white/80 bg-slate-950 shadow-[0_30px_90px_rgba(15,23,42,0.14)]">
          <div className="relative px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-500" />

            <div className="relative grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  Privacy & data protection
                </div>

                <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">
                  Privacy, explained clearly.
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                  This policy explains what personal information AuroTap may collect,
                  why we use it, how it is protected, when it may be shared and the
                  choices available to you.
                </p>

                <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-slate-400">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    Last updated: 6 October 2026
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    Applies to AuroTap services
                  </span>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200">
                  <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                </div>

                <p className="mt-4 text-sm font-bold text-white">
                  Your information should work for your service — not against you.
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-400">
                  We aim to collect the information needed to run AuroTap and keep
                  customer, supplier and technician workflows reliable and secure.
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="h-fit rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              On this page
            </p>

            <nav className="mt-4 space-y-1">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-cyan-700"
                >
                  {section.title.replace(/^\d+\.\s*/, '')}
                </a>
              ))}
            </nav>
          </aside>

          <div className="space-y-5">
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-6 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.04)] sm:p-8"
              >
                <h2 className="text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl">
                  {section.title}
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {section.intro}
                </p>

                <div className="mt-5 space-y-3">
                  {section.points.map((point) => (
                    <div
                      key={point.title}
                      className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                          aria-hidden="true"
                        />

                        <div>
                          <h3 className="text-sm font-extrabold text-slate-900">
                            {point.title}
                          </h3>

                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            {point.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            <section className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-blue-50 p-6 sm:p-8">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-cyan-700 shadow-sm">
                <Mail className="h-5 w-5" aria-hidden="true" />
              </div>

              <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-950">
                Privacy questions or a data request?
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Email us with the account email or phone number associated with your
                request and describe what you need. Please do not send passwords,
                OTPs or payment PINs.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={`mailto:${PRIVACY_EMAIL}?subject=AuroTap%20Privacy%20Request`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-cyan-800"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  {PRIVACY_EMAIL}
                </a>

                <a
                  href={`mailto:${SECURITY_EMAIL}?subject=AuroTap%20Security%20Report`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-white/80"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Security reporting
                </a>

                <Link
                  href="/contact"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Contact AuroTap
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.04)] sm:p-8">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <UserRound className="h-5 w-5" aria-hidden="true" />
                </div>

                <div>
                  <h2 className="text-lg font-extrabold text-slate-950">
                    About this policy
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    This page describes AuroTap&apos;s current platform practices in
                    clear language. Where applicable, requests are handled subject to
                    the Digital Personal Data Protection Act, 2023, the Digital
                    Personal Data Protection Rules, 2025 and other laws that apply to
                    the service.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/security"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Security
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>

                <Link
                  href="/cookies"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Cookie policy
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>

                <Link
                  href="/terms"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Terms of Service
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </section>

            <p className="pb-4 text-center text-xs leading-5 text-slate-400">
              AuroTap · Privacy Policy · Last updated 6 October 2026
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
