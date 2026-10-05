import JsonLd from './JsonLd';
import { getSiteUrl } from '@/lib/env';

const APP_URL = getSiteUrl();
const APP_NAME =
  process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'AuroWater';

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',

  '@id': `${APP_URL}/#website`,

  name: APP_NAME,

  url: APP_URL,

  publisher: {
    '@id': `${APP_URL}/#organization`,
  },

  inLanguage: 'en-IN',
};

export default function WebSiteJsonLd() {
  return <JsonLd data={websiteJsonLd} />;
}
