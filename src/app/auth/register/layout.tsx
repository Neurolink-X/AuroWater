// PATH: same folder as page.tsx (e.g. app/auth/register/layout.tsx)
// Server component. It adds SEO to the existing client page without touching the page itself:
// metadata, structured data and a short crawlable FAQ are rendered in the initial HTML.
// To drop the FAQ, delete the <section> below. Metadata keeps working.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');

/** Set this to the real route of the register page. ?role= and ?returnTo= variants canonicalise to it. */
const REGISTER_PATH = '/auth/register';

const TITLE = 'Create your AuroTap account | Water delivery & home services';
const DESCRIPTION =
  'Create your AuroTap account to order 20L RO water, book plumbing, RO and tank cleaning services, or join as a technician or supplier in supported cities.';

// Needs `metadataBase` in the root layout so the relative canonical becomes an absolute URL.
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

const CITIES = [
  'Kanpur', 'Gorakhpur', 'Lucknow','Noida', 'Ghaziabad', 'Varanasi', 'Prayagraj', 'Agra', 'Meerut',
  'Bareilly', 'Mathura', 'Delhi', 
];

const FAQ = [
  {
    q: 'Who can create an AuroTap account?',
    a: 'Customers who want to order 20L RO water and book home water services, technicians who offer plumbing, RO service, borewell, motor repair, water tanker and tank cleaning work, and suppliers who deliver water with tankers or equipment.',
  },
  {
    q: 'Which cities can I choose?',
    a: `${CITIES.join(', ')}. Availability still varies by address, service and partner, so check your address before booking.`,
  },
  {
    q: 'Do technicians and suppliers need verification?',
    a: 'Technician and supplier accounts may need verification before they can accept jobs or deliveries.',
  },
  {
    q: 'What do I need to sign up?',
    a: 'Your name, email, a 10-digit mobile number, your city and a password of at least 8 characters with one number. Suppliers also add a business name.',
  },
];

export default function RegisterLayout({ children }: { children: ReactNode }) {
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
    <>
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} /> : null}

      {children}

      <section aria-labelledby="register-faq" className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <h2 id="register-faq" className="text-xl font-extrabold tracking-tight text-slate-950">
            Before you sign up
          </h2>
          <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {FAQ.map((item) => (
              <details key={item.q} className="group p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold text-slate-900 [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span aria-hidden="true" className="text-lg leading-none text-emerald-700 transition-transform group-open:rotate-45 motion-reduce:transition-none">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
