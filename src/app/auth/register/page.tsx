// PATH: replace your existing register page.tsx (e.g. app/auth/register/page.tsx)
// SERVER component: metadata, structured data and the FAQ below the form are all in the
// initial HTML, so crawlers and link previews see them without running any JavaScript.
import type { Metadata } from 'next';
import Link from 'next/link';

import RegisterClient from './RegisterClient';
import { CITIES, EXPLORE_LINKS, FAQ } from './register-config';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');

/** Adjust to the real route of this page. Query variants (?role=, ?returnTo=) canonicalise to it. */
const REGISTER_PATH = '/auth/register';

const TITLE = 'Create your AuroTap account | Water delivery & home services';
const DESCRIPTION =
  'Create your AuroTap account to order 20L RO water, book plumbing, RO and tank cleaning services, or join as a technician or supplier in supported cities.';

// Requires `metadataBase` in the root layout so the relative canonical resolves to an absolute URL.
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: REGISTER_PATH },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    type: 'website',
    siteName: 'AuroTap',
    locale: 'en_IN',
    title: TITLE,
    description: DESCRIPTION,
    url: REGISTER_PATH,
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default function RegisterPage() {
  const pageUrl = SITE_URL ? `${SITE_URL}${REGISTER_PATH}` : null;

  const jsonLd =
    SITE_URL && pageUrl
      ? JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebPage',
              '@id': `${pageUrl}#webpage`,
              url: pageUrl,
              name: TITLE,
              description: DESCRIPTION,
              inLanguage: 'en-IN',
              isPartOf: { '@type': 'WebSite', name: 'AuroTap', url: SITE_URL },
              about: { '@type': 'Organization', name: 'AuroTap', url: SITE_URL },
              potentialAction: { '@type': 'RegisterAction', target: pageUrl },
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
                { '@type': 'ListItem', position: 2, name: 'Create account', item: pageUrl },
              ],
            },
          ],
        }).replace(/</g, '\\u003c')
      : null;

  return (
    <main>
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} /> : null}

      <RegisterClient />

      {/* Crawlable, human-useful content: answers questions and links into the rest of the site. */}
      <section aria-labelledby="register-faq" className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
          <h2 id="register-faq" className="text-2xl font-extrabold tracking-tight text-slate-950">
            Before you sign up
          </h2>
          <p className="mt-2 text-[15px] leading-6 text-slate-600">
            Quick answers about AuroTap accounts for customers, technicians and suppliers.
          </p>

          <div className="mt-6 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {FAQ.map((item) => (
              <details key={item.q} className="group p-4 sm:p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-bold text-slate-900 [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span aria-hidden="true" className="text-xl leading-none text-sky-700 transition-transform group-open:rotate-45 motion-reduce:transition-none">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Cities you can choose</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{CITIES.join(' · ')}</p>
            </div>
            <nav aria-label="Explore AuroTap">
              <h3 className="text-sm font-bold text-slate-900">Explore AuroTap</h3>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {EXPLORE_LINKS.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="inline-flex py-1 text-sm font-semibold text-sky-700 hover:text-sky-900 hover:underline">
                      {l.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </section>
    </main>
  );
}
