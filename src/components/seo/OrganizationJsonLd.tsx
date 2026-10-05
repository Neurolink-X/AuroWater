import JsonLd from './JsonLd';

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://aurotap.in/#organization',
  name: 'AuroWater',
  url: 'https://aurotap.in/',
  logo: {
    '@type': 'ImageObject',
    url: 'https://aurotap.in/logo.png',
  },
};

export default function OrganizationJsonLd() {
  return <JsonLd data={organizationJsonLd} />;
}
