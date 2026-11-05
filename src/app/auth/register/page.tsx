// PATH: replace your existing register page.tsx (e.g. app/auth/register/page.tsx)
// This is a SERVER component: metadata is rendered in the initial HTML (crawlers and
// link previews see it), instead of being injected by useEffect after hydration.
import type { Metadata } from 'next';

import RegisterClient from './RegisterClient';

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
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    siteName: 'AuroTap',
    title: TITLE,
    description: DESCRIPTION,
    url: REGISTER_PATH,
  },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
};

export default function RegisterPage() {
  const jsonLd = SITE_URL
    ? JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebPage',
            '@id': `${SITE_URL}${REGISTER_PATH}#webpage`,
            url: `${SITE_URL}${REGISTER_PATH}`,
            name: TITLE,
            description: DESCRIPTION,
            inLanguage: 'en-IN',
            isPartOf: { '@type': 'WebSite', name: 'AuroTap', url: SITE_URL },
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
              { '@type': 'ListItem', position: 2, name: 'Create account', item: `${SITE_URL}${REGISTER_PATH}` },
            ],
          },
        ],
      }).replace(/</g, '\\u003c')
    : null;

  return (
    <>
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} /> : null}
      <RegisterClient />
    </>
  );
}
