// PATH: src/app/(public)/contact/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Clock, Mail, MapPin, MessageCircle, Phone, ShieldCheck, Tag } from 'lucide-react';
import { getContactSettings } from '@/lib/contact-settings';
import {
  SUPPORT_SCHEDULE, formatPhone, isOfferActive, telHref, whatsappHref,
} from '@/lib/contact-shared';
import ContactForm from './ContactForm';
import { MobileActionBar, TrackedLink } from './LiveBits';

/** Server component, statically cached and refreshed every minute: instant first paint, zero client fetch waterfall. */
export const revalidate = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
const TITLE = 'Contact AuroTap | Book Water & Home Services, Message Support';
const DESCRIPTION = 'Keep water and essential home services within reach. Book with AuroTap, message our team or explore current offers. Check service availability and final pricing before checkout.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/contact' }, // ?subject=… deep links never become duplicate pages
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/contact', siteName: 'AuroTap', type: 'website', locale: 'en_IN' },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
};

const PATHS = [
  { href: '/book', title: 'Book a service', text: 'Water, plumber, tank cleaning and more.' },
  { href: '/service-areas', title: 'Check coverage', text: 'See which cities and areas we serve.' },
  { href: '/register/pro?type=technician', title: 'Join as technician', text: 'Get verified and receive local jobs.' },
  { href: '/become-a-supplier', title: 'Become a supplier', text: 'Partner with AuroTap in your city.' },
] as const;

const FAQ = [
  { q: 'How can I get help with an order?', a: 'Send your booking reference through the contact form or WhatsApp. Our team reviews messages during working hours; response times can vary.' },
  { q: 'Is my area covered?', a: 'Availability varies by city, address, service and partner. Use Check coverage, or ask us before you book.' },
  { q: 'What should I never share?', a: 'Never share your password, OTP or reset link with anyone, including AuroTap staff. We will never ask for them.' },
  { q: 'I can’t sign in to my account.', a: 'Use the account help form. Our team verifies ownership before changing any account details.' },
] as const;

const iconWrap = 'grid size-9 shrink-0 place-items-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pad = (n: number) => String(n).padStart(2, '0');

export default async function ContactPage() {
  const s = await getContactSettings();
  const offer = isOfferActive(s.offer) ? s.offer : null;
  const call = telHref(s.supportPhone);
  const wa = whatsappHref(s.whatsappNumber);
  const prettyPhone = formatPhone(s.supportPhone);

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ContactPage', name: TITLE, description: DESCRIPTION, ...(SITE_URL ? { url: `${SITE_URL}/contact` } : {}),
        about: { '@id': SITE_URL ? `${SITE_URL}/#organization` : '#organization' },
      },
      {
        '@type': 'Organization', '@id': SITE_URL ? `${SITE_URL}/#organization` : '#organization', name: 'AuroTap',
        ...(SITE_URL ? { url: SITE_URL, logo: `${SITE_URL}/aurotap-mark.svg` } : {}),
        email: s.supportEmail, telephone: `+91${s.supportPhone}`,
        address: { '@type': 'PostalAddress', streetAddress: s.officeAddress, addressCountry: 'IN' },
        contactPoint: [{
          '@type': 'ContactPoint', contactType: 'customer support', telephone: `+91${s.supportPhone}`, email: s.supportEmail,
          areaServed: 'IN', availableLanguage: ['English', 'Hindi'],
          hoursAvailable: {
            '@type': 'OpeningHoursSpecification', dayOfWeek: SUPPORT_SCHEDULE.days.map((d) => DAY_NAMES[d]),
            opens: `${pad(SUPPORT_SCHEDULE.openHour)}:00`, closes: `${pad(SUPPORT_SCHEDULE.closeHour)}:00`,
          },
        }],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL ?? '/' },
          { '@type': 'ListItem', position: 2, name: 'Contact', item: SITE_URL ? `${SITE_URL}/contact` : '/contact' },
        ],
      },
    ],
  }).replace(/</g, '\\u003c');

  return (
    <div className="min-h-screen bg-[#F4F8F6] pb-20 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      {/* ───────── Hero (static gradient: no animations, no font imports, nothing render-blocking) ───────── */}
      <header className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-800 to-emerald-600 px-5 pb-28 pt-14 text-center sm:pt-20">
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[-120px] size-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(52,211,153,0.22),transparent_70%)]" />
        <div className="relative mx-auto max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-200">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-300" /> Contact AuroTap support
          </p>
          <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Your essentials, <span className="text-emerald-300">one tap away.</span>
            <span className="mt-2 block text-[0.54em] font-extrabold leading-tight text-white/90">Small essentials. A little more peace of mind.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/70">
            A home runs on the little things. From drinking water to a tap that needs fixing, find everyday help in one place. Book a service or send us a message whenever you need guidance.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/book" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-6 text-[15px] font-extrabold text-emerald-950 shadow-lg shadow-black/20 transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Book a service <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <TrackedLink href={wa} event="contact_whatsapp_click" external
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#25D366] px-6 text-[15px] font-extrabold text-slate-950 shadow-lg shadow-black/20 transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              <MessageCircle size={18} aria-hidden="true" /> Message us
            </TrackedLink>
          </div>
          <p className="mx-auto mt-5 max-w-xl text-sm font-semibold text-emerald-100">Start with a booking. Stay connected with messages. Support is available when you need guidance.</p>
          <ul className="mt-6 flex flex-wrap justify-center gap-2 text-xs font-semibold text-white/85">
            {['Simple online booking', 'Message-led support', 'Check offers and coverage'].map((t) => (
              <li key={t} className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2"><span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-300" />{t}</li>
            ))}
          </ul>
        </div>
        <svg aria-hidden="true" className="absolute inset-x-0 -bottom-px h-14 w-full" viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path fill="#F4F8F6" d="M0,48 C240,84 480,8 720,40 C960,72 1200,16 1440,48 L1440,80 L0,80 Z" />
        </svg>
      </header>

      <main className="relative z-10 mx-auto -mt-14 max-w-6xl px-4 sm:px-6">
        {/* ───────── Offer (admin-managed: shows only when set in `settings` and not expired) ───────── */}
        {offer && (
          <aside aria-label="Current offer" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow-sm sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><Tag size={18} aria-hidden="true" /></span>
              <div>
                <p className="font-extrabold text-amber-950">{offer.headline}</p>
                {offer.body && <p className="mt-0.5 text-sm text-amber-900/80">{offer.body}</p>}
                <p className="mt-1 text-xs text-amber-800/70">
                  {offer.expiresAt && <>Valid until {new Date(offer.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}. </>}
                  Terms apply; the final price is shown before you confirm a booking.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {offer.code && <code className="rounded-lg border border-dashed border-amber-400 bg-white px-3 py-1.5 text-sm font-black tracking-wider text-amber-900">{offer.code}</code>}
              {offer.href && <Link href={offer.href} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-amber-600 px-4 text-sm font-bold text-white hover:bg-amber-700">Claim offer <ArrowRight size={15} aria-hidden="true" /></Link>}
            </div>
          </aside>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
          {/* ───────── Form ───────── */}
          <section id="contact-form" aria-labelledby="form-title" className="scroll-mt-6 overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04),0_20px_60px_rgba(13,155,108,0.08)]">
            <div className="border-b border-emerald-50 px-5 pb-5 pt-7 sm:px-8">
              <h2 id="form-title" className="text-2xl font-black tracking-tight text-emerald-950">Send us a message</h2>
              <p className="mt-1 text-sm text-slate-500">Tell us what you need. Your message goes to our support inbox, where our team can follow up during working hours.</p>
            </div>
            <div className="px-5 pb-8 pt-6 sm:px-8"><ContactForm phone={s.supportPhone} /></div>
          </section>

          {/* ───────── Sidebar ───────── */}
          <div className="flex flex-col gap-5 max-lg:order-first">
            <section aria-labelledby="wa-title" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-800 to-emerald-700 p-6">
              <div className="relative">
                <h2 id="wa-title" className="text-xl font-black tracking-tight text-white">Chat on WhatsApp</h2>
                <p className="mt-1 text-sm leading-6 text-white/75">A question about your order, an offer or joining our network? Send a message and keep the conversation in one place.</p>
                <TrackedLink href={wa} event="contact_whatsapp_click" external
                  className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-bold text-slate-950 shadow-lg shadow-black/20 transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  <MessageCircle size={19} aria-hidden="true" /> Start WhatsApp chat
                </TrackedLink>
                <Link href="/book" className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/25 text-sm font-bold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  Book water or home services <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </section>

            <section aria-labelledby="details-title" className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
              <h2 id="details-title" className="mb-3 border-b border-emerald-50 pb-3 text-base font-black text-emerald-950">Other ways to connect</h2>
              <dl className="divide-y divide-slate-50">
                {[
                  { icon: <Mail size={17} aria-hidden="true" />, label: 'Email', value: <a href={`mailto:${s.supportEmail}`} className="break-all hover:underline">{s.supportEmail}</a> },
                  { icon: <MapPin size={17} aria-hidden="true" />, label: 'Address', value: s.officeAddress },
                  { icon: <Clock size={17} aria-hidden="true" />, label: 'Working hours', value: s.workingHours },
                ].map((row) => (
                  <div key={row.label} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <span className={iconWrap}>{row.icon}</span>
                    <div><dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{row.label}</dt><dd className="text-sm font-semibold text-slate-800">{row.value}</dd></div>
                  </div>
                ))}
              </dl>
              <details className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <summary className="cursor-pointer font-semibold text-emerald-900">Need phone support instead?</summary>
                <a href={call} className="mt-2 inline-flex min-h-10 items-center gap-2 font-semibold text-emerald-800 underline underline-offset-2"><Phone size={15} aria-hidden="true" /> Call {prettyPhone}</a>
              </details>
            </section>

            <p className="flex gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-[13px] leading-6 text-emerald-900">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
              <span><strong>Make the day a little easier.</strong> Book the essentials online, explore any available offers and message us for help. Partner enquiries are welcome too.</span>
            </p>
          </div>
        </div>

        {/* ───────── Quick paths (internal linking + faster self-serve) ───────── */}
        <nav aria-label="Other ways we can help" className="mt-10">
          <h2 className="text-xl font-black tracking-tight text-emerald-950">Looking for something specific?</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PATHS.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className="group flex h-full flex-col rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
                  <span className="flex items-center justify-between font-extrabold text-emerald-950">{p.title}<ArrowRight size={16} className="text-emerald-600 transition group-hover:translate-x-0.5" aria-hidden="true" /></span>
                  <span className="mt-1 text-sm text-slate-500">{p.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* ───────── FAQ (native <details>: zero JavaScript) ───────── */}
        <section aria-labelledby="faq-title" className="mt-10 pb-16">
          <h2 id="faq-title" className="text-xl font-black tracking-tight text-emerald-950">Quick answers</h2>
          <div className="mt-4 divide-y divide-emerald-50 overflow-hidden rounded-2xl border border-emerald-100 bg-white">
            {FAQ.map((f) => (
              <details key={f.q} className="group p-4 sm:px-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 [&::-webkit-details-marker]:hidden">
                  {f.q}<span aria-hidden="true" className="text-xl leading-none text-emerald-600 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {f.a}{f.q.startsWith('I can’t') && <> <Link href="/account-help" className="font-bold text-emerald-700 underline">Get account help</Link>.</>}
                </p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <MobileActionBar whatsappLink={wa} />
    </div>
  );
}
