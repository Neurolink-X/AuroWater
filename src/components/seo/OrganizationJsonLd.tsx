import JsonLd from './JsonLd';
import { getSiteUrl } from '@/lib/env';

const APP_URL = getSiteUrl();

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${APP_URL}/#organization`,
  name: 'AuroWater',
  alternateName: 'AuroTap',
  url: `${APP_URL}/`,
  logo: {
    '@type': 'ImageObject',
    url: `${APP_URL}/splash-logo.svg`,
  },
};

export default function OrganizationJsonLd() {
  return <JsonLd data={organizationJsonLd} />;
}
