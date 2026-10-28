// app/page.tsx — SERVER component: owns metadata + structured data (SEO).
import type { Metadata } from 'next';
import HomeClient from './HomeClient';
import { SITE, PRICING, FAQS, CITIES, LIVE_CITY_NAMES, PIN_CITY_NAMES, MAX_LOCK_MONTHS } from '@/lib/marketing-pricing';

const title = `RO Water ₹${PRICING.water.normal}/Can, Plumber & Tank Cleaning | ${SITE.name}`;
const description =
  `Order 20L RO water cans from ₹${PRICING.water.normal}, book a plumber or schedule water tank cleaning in ${LIVE_CITY_NAMES.replace(' and ', ' & ')}, plus ${PIN_CITY_NAMES.replace(' and ', ' & ')} on select PIN codes. ` +
  `Monthly plans lock your price for up to ${MAX_LOCK_MONTHS} months. Clear prices before you confirm. Cash + UPI.`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title,
  description,
  keywords: [
    'RO water can delivery', '20 litre water can price', 'water delivery Kanpur', 'water delivery Lucknow',
    'water delivery Gorakhpur', 'water delivery Delhi', 'water delivery Noida', 'water delivery Gurugram', 'water delivery Agra', 'plumber Noida', 'plumber Gurugram', 'tank cleaning Delhi NCR', 'plumber near me', 'water tank cleaning service', 'chilled water can delivery',
    'bulk water for events', 'monthly water subscription',
  ],
  alternates: { canonical: '/' },
  openGraph: { title, description, url: '/', siteName: SITE.name, locale: 'en_IN', type: 'website' },
  twitter: { card: 'summary_large_image', title, description },
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'LocalBusiness',
      '@id': `${SITE.url}/#business`,
      name: SITE.name,
      url: SITE.url,
      ...(SITE.phone ? { telephone: SITE.phone } : {}),
      priceRange: '₹',
      paymentAccepted: 'Cash, UPI',
      areaServed: CITIES.map(c => ({ '@type': 'City', name: c.name })),
      makesOffer: [
        { '@type': 'Offer', name: 'Normal RO 20L can', price: PRICING.water.normal, priceCurrency: 'INR' },
        { '@type': 'Offer', name: 'Chilled RO 20L can', price: PRICING.water.chilled, priceCurrency: 'INR' },
        { '@type': 'Offer', name: 'Water tank cleaning (up to 500 L, from)', price: PRICING.tank[0].from, priceCurrency: 'INR' },
        { '@type': 'Offer', name: 'Plumber visit', price: PRICING.plumber.visitFee, priceCurrency: 'INR' },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQS.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ],
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HomeClient />
    </>
  );
}
