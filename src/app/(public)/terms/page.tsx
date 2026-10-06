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
  UserCheck,
} from 'lucide-react';

import { pageMeta } from '@/lib/seo';

const SUPPORT_EMAIL = 'support.aurotap@gmail.com';
const SECURITY_EMAIL = 'security@aurotap.in';

export const metadata: Metadata = {
  ...pageMeta(
    'Terms of Service | AuroTap Water Delivery & Home Services',
    'Read the AuroTap Terms of Service covering accounts, bookings, water delivery, home services, payments, cancellations, customer responsibilities, supplier and technician participation, complaints and platform use.',
    '/terms'
  ),
  keywords: [
    'AuroTap terms of service',
    'AuroWater terms and conditions',
    'AuroTap terms and conditions',
    'water delivery terms India',
    'AuroTap booking terms',
    'AuroTap cancellation policy',
    'AuroTap customer terms',
  ],
  robots: { index: true, follow: true },
};

const termsSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'AuroTap Terms of Service',
  url: 'https://aurotap.in/terms',
  description: 'Terms governing use of AuroTap water delivery and home-service platform.',
  isPartOf: {
    '@type': 'WebSite',
    name: 'AuroTap',
    url: 'https://aurotap.in/',
  },
};

const sections = [
  {
    id: 'acceptance',
    title: '1. Acceptance of these terms',
    intro:
      'By using AuroTap, creating an account, requesting a booking or participating as a supplier or technician, you agree to these Terms of Service and any applicable service-specific terms shown during the booking process.',
    points: [
      ['Use the platform lawfully', 'Use AuroTap only for lawful purposes and do not misuse, disrupt, bypass or interfere with the platform or another user.'],
      ['Service-specific terms', 'Prices, availability, service scope, scheduling and transaction-specific conditions may be shown during booking and form part of the transaction when you proceed.'],
    ],
  },
  {
    id: 'accounts',
    title: '2. Accounts and account security',
    intro:
      'Some AuroTap features require an account so bookings, communications and service records can be associated with the correct person.',
    points: [
      ['Accurate information', 'Provide information that is accurate and keep it reasonably updated when necessary for service delivery or account support.'],
      ['Protect your credentials', 'Keep passwords, authentication links, OTPs and other account credentials confidential. AuroTap staff should not ask you to disclose an OTP or UPI PIN.'],
      ['Suspension and termination', 'AuroTap may restrict, suspend or terminate access where reasonably necessary to protect the platform or users, prevent abuse, or address suspected fraud, security issues or unlawful activity, subject to applicable law.'],
    ],
  },
  {
    id: 'services',
    title: '3. AuroTap services',
    intro:
      'AuroTap provides a technology platform for requesting and coordinating water delivery and selected home water-related services.',
    points: [
      ['Water delivery', 'Availability depends on delivery area, supplier capacity, stock, schedule and other operational factors. A booking request is not a guarantee until the applicable system indicates confirmation.'],
      ['Home services', 'For plumbing, RO service, borewell, motor repair or other listed services, final scope may depend on inspection, site conditions, parts, materials and the service selected.'],
      ['Service providers', 'Some services are fulfilled by partner suppliers or technicians. AuroTap may coordinate the booking while the relevant provider performs the service.'],
      ['Operational changes', 'Delivery times, assigned personnel or availability may change because of traffic, weather, stock, technical problems, safety concerns, provider availability or other circumstances outside reasonable control.'],
    ],
  },
  {
    id: 'booking',
    title: '4. Booking, pricing and confirmation',
    intro:
      'The booking flow is the primary place where the details of a requested service are presented for review.',
    points: [
      ['Before confirmation', 'Review the selected service, quantity, address, schedule, applicable fees and total amount before submitting or confirming the booking.'],
      ['Displayed price', 'The amount shown in the booking flow is the amount intended for the transaction unless an additional charge, adjustment or later-approved work is clearly identified.'],
      ['Additional work', 'For technician-led services, work, parts or materials outside the original scope may require separate approval and may carry additional charges.'],
      ['Confirmation', 'A booking becomes confirmed when AuroTap or the applicable booking system indicates that the request has been accepted or confirmed.'],
    ],
  },
  {
    id: 'payments',
    title: '5. Payments',
    intro:
      'AuroTap supports the payment methods displayed in the applicable booking flow or account area.',
    points: [
      ['Payment methods', 'Depending on service and configuration, available methods may include cash, UPI, online payment or other methods displayed during checkout.'],
      ['Payment verification', 'Where payment verification is used, AuroTap may request transaction information or proof of payment. Never share your UPI PIN, card PIN, password or OTP with staff or in payment evidence.'],
      ['Payment status', 'An order may remain pending payment verification until the applicable evidence or transaction status has been reviewed.'],
      ['Taxes and charges', 'Applicable taxes, convenience charges, emergency charges or other transaction-specific fees will be shown where applicable before or during the relevant transaction.'],
    ],
  },
  {
    id: 'cancellation',
    title: '6. Cancellations, rescheduling and refunds',
    intro:
      'Cancellation, rescheduling and refund outcomes can depend on service type, timing, order status, payment method and work already performed.',
    points: [
      ['Cancellation', 'Cancellation may be available only before a relevant operational stage or cutoff. The applicable option and any charge, where applicable, will be shown in the booking or support flow.'],
      ['Rescheduling', 'Where rescheduling is supported, the requested date or time remains subject to service availability.'],
      ['Refunds', 'Where a refund is approved, the amount and processing method depend on the applicable transaction and payment provider workflow. Processing times may vary.'],
      ['Work already performed', 'Where a technician has travelled, inspected a site or started approved work, cancellation or refund treatment may differ because work or costs may already have been incurred.'],
    ],
  },
  {
    id: 'customer-responsibilities',
    title: '7. Customer responsibilities',
    intro:
      'Reliable service depends on accurate information and safe access.',
    points: [
      ['Correct delivery information', 'Provide a usable address, contact information and relevant landmarks or access instructions. Incorrect or incomplete details may delay service.'],
      ['Safe access', 'Provide reasonable and safe access for delivery or technician work where required and disclose known hazards that could affect people or equipment.'],
      ['Fair use', 'Do not submit fraudulent orders, impersonate another person, abuse support channels, manipulate ratings or attempt to obtain services or credits through deceptive means.'],
    ],
  },
  {
    id: 'professional-participants',
    title: '8. Supplier and technician participation',
    intro:
      'Suppliers and technicians use AuroTap as professional participants in a managed service workflow.',
    points: [
      ['Verification and eligibility', 'AuroTap may require identity, business, skill, service-area or other information before enabling professional participation. Approval is not a guarantee of continued access or minimum earnings.'],
      ['Professional conduct', 'Suppliers and technicians are expected to provide the agreed service professionally, accurately represent capabilities and follow applicable safety and legal requirements.'],
      ['Responsibility for work', 'Where a supplier or technician performs the service, that provider remains responsible for the work it performs, subject to the applicable commercial arrangement and law.'],
    ],
  },
  {
    id: 'complaints',
    title: '9. Feedback, complaints and service quality',
    intro:
      'AuroTap uses customer feedback to identify service problems and improve operations.',
    points: [
      ['Honest feedback', 'Provide accurate reviews, ratings and complaint details. Do not use feedback tools for knowingly false allegations, threats or unnecessary disclosure of personal information.'],
      ['Service-quality review', 'Where feedback indicates a service problem, AuroTap may create an internal service-quality case, investigate the issue, contact relevant parties and record the outcome.'],
      ['Support', 'For an order problem, contact AuroTap through the available support channels as soon as reasonably possible so the issue can be reviewed with the relevant order information.'],
    ],
  },
  {
    id: 'acceptable-use',
    title: '10. Prohibited use',
    intro:
      'You must not use AuroTap to harm people, the platform or its infrastructure.',
    points: [
      ['Security abuse', 'Do not probe, scan, attack, overload, bypass authentication or attempt unauthorised access to AuroTap systems or another user account.'],
      ['Fraud and manipulation', 'Do not create deceptive accounts, fake bookings, fraudulent payment evidence, fake reviews, referral abuse or other attempts to manipulate the platform.'],
      ['Harmful content or activity', 'Do not upload or transmit unlawful, malicious, infringing or otherwise harmful content through AuroTap.'],
    ],
  },
  {
    id: 'intellectual-property',
    title: '11. Intellectual property',
    intro:
      'AuroTap and its licensors retain rights in the platform, branding, software, design and original content except where rights belong to another party.',
    points: [
      ['Limited use', 'You receive a limited, non-exclusive right to use AuroTap for its intended purpose. You may not copy, resell, reverse engineer or commercially exploit platform components except as permitted by law.'],
      ['User-submitted content', 'You remain responsible for content you submit and grant AuroTap the limited rights needed to store, display, process and use that content to provide, secure and improve the relevant service, subject to the Privacy Policy and applicable law.'],
    ],
  },
  {
    id: 'availability',
    title: '12. Availability and third-party services',
    intro:
      'AuroTap depends on networks, hosting, authentication, payment providers, communications providers and other external systems.',
    points: [
      ['Service availability', 'We aim to keep AuroTap available and reliable, but no internet service can be guaranteed to operate without interruption, delay or error.'],
      ['Third-party services', 'Third-party services may have their own terms, privacy policies, outages or limitations. Their availability can affect the AuroTap experience.'],
    ],
  },
  {
    id: 'liability',
    title: '13. Disclaimers and liability',
    intro:
      'To the extent permitted by applicable law, these terms describe the limits of AuroTap responsibility for use of the platform.',
    points: [
      ['Service information', 'AuroTap aims to present accurate service, pricing and availability information, but operational conditions can change and errors may occasionally occur. Please contact support when information appears incorrect.'],
      ['No uninterrupted-service guarantee', 'The platform and related services are subject to operational and technical limitations and are not guaranteed to be uninterrupted.'],
      ['Limitation of liability', 'To the maximum extent permitted by applicable law, AuroTap will not be responsible for indirect, incidental, special or consequential losses arising from use of the platform. Nothing here excludes liability that cannot lawfully be excluded.'],
      ['Mandatory rights preserved', 'These limitations apply only to the extent permitted under applicable law and do not remove rights or remedies that cannot legally be waived or limited.'],
    ],
  },
  {
    id: 'changes',
    title: '14. Changes to these terms',
    intro:
      'AuroTap may update these terms when services, pricing models, operational processes or legal requirements change.',
    points: [
      ['Updated version', 'The latest version will be published on this page with an updated date. Material changes should be communicated through appropriate channels where required by law.'],
      ['Continued use', 'Continued use of AuroTap after an updated version becomes effective means you accept the revised terms to the extent permitted by applicable law.'],
    ],
  },
  {
    id: 'governing-law',
    title: '15. Governing law and disputes',
    intro:
      'These terms are intended for use in India and should be read together with mandatory rights available under applicable Indian law.',
    points: [
      ['Applicable law', 'Subject to mandatory consumer or other statutory rights, these terms are governed by the laws of India.'],
      ['Good-faith resolution', 'Before starting formal proceedings, we encourage customers and AuroTap to contact support and make a reasonable effort to resolve the dispute directly.'],
      ['Mandatory rights preserved', 'Nothing in these terms is intended to remove rights or remedies that cannot legally be waived or limited under applicable law.'],
    ],
  },
] as const;

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#eaf8ff_0%,#f9fcff_45%,#ffffff_100%)] text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(termsSchema) }}
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
        <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-2 text-sm font-semibold text-slate-500">
          <Link href="/" className="transition hover:text-cyan-700">Home</Link>
          <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden="true" />
          <span className="text-slate-900" aria-current="page">Terms of Service</span>
        </nav>

        <header className="overflow-hidden rounded-[2rem] border border-white/80 bg-slate-950 shadow-[0_30px_90px_rgba(15,23,42,0.14)]">
          <div className="relative px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-500" />
            <div className="relative grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  Terms & customer protection
                </div>

                <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">
                  Clear terms for reliable service.
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                  These terms explain how AuroTap accounts, bookings, water delivery,
                  home services, payments, cancellations, professional participation,
                  complaints and use of the platform work.
                </p>

                <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-slate-400">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Last updated: 6 October 2026</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Applies to AuroTap services</span>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200">
                  <UserCheck className="h-5 w-5" aria-hidden="true" />
                </div>

                <p className="mt-4 text-sm font-bold text-white">What matters before you book</p>

                <div className="mt-3 space-y-3">
                  {[
                    'Check the service and address',
                    'Review the price and applicable charges',
                    'Confirm the schedule',
                    'Keep your contact details accurate',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
                      <p className="text-xs leading-5 text-slate-300">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="h-fit rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">On this page</p>
            <nav className="mt-4 space-y-1">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={'#' + section.id}
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
                <p className="mt-2 text-sm leading-6 text-slate-600">{section.intro}</p>

                <div className="mt-5 space-y-3">
                  {section.points.map(([title, text]) => (
                    <div key={title} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
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
                Questions about these terms?
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                For booking, service or account questions, contact AuroTap support.
                For a suspected security vulnerability, use the dedicated security
                contact.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Link
                  href="/contact?subject=general"
                  className="group inline-flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-800 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-cyan-100"
                >
                  <span className="flex items-center gap-2.5">
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    Contact support
                  </span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>

                <Link
                  href="/security#report-vulnerability"
                  className="group inline-flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-700 transition hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-cyan-50/40 hover:shadow-sm focus:outline-none focus:ring-4 focus:ring-cyan-100"
                >
                  <span className="flex items-center gap-2.5">
                    <ShieldCheck className="h-4 w-4 text-cyan-700" aria-hidden="true" />
                    Security reporting
                  </span>
                  <ArrowRight className="h-4 w-4 text-cyan-700 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.04)] sm:p-8">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                </div>

                <div>
                  <h2 className="text-lg font-extrabold text-slate-950">Related policies</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    These Terms of Service work alongside AuroTap&apos;s privacy,
                    cookie and security information.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/privacy" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                  Privacy policy <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/cookies" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                  Cookie policy <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/security" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                  Security <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </section>

            <p className="pb-4 text-center text-xs leading-5 text-slate-400">
              AuroTap · Terms of Service · Last updated 6 October 2026
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
