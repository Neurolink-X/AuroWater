import { getPublicServiceCities } from '@/lib/public-city-directory.server';
import { CAN_PRICES } from '@/lib/booking-pricing';

/**
 * Structured data (JSON-LD) for the public /book page.
 * Server component: render it once inside the /book page, next to <BookingWizard />.
 * Prices come from booking-pricing.ts, so markup always matches what customers see.
 */
export default async function BookingSeo() {
  // Publish active coverage only when confirmed by the authoritative city directory.
  const cities = (await getPublicServiceCities()).filter(city => city.status === 'active').map(city => city.name);

  const offer = (name: string, price: number) => ({
    '@type': 'Offer',
    name,
    price,
    priceCurrency: 'INR',
    availability: 'https://schema.org/InStock',
  });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: '20L RO drinking water can delivery',
    serviceType: 'Doorstep drinking water delivery',
    provider: { '@type': 'Organization', name: 'AuroTap' },
    areaServed: cities.map((name) => ({ '@type': 'City', name })),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Water can plans',
      itemListElement: [
        offer('Normal RO water, 20L can', CAN_PRICES.normal),
        offer('Chilled RO water, 20L can', CAN_PRICES.chilled),
        offer('Subscription, 20L can per delivery', CAN_PRICES.subscription),
      ],
    },
  };

  return (
    <script
      type="application/ld+json"
      // Escape "<" so the JSON can never close the script tag early.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
    />
  );
}
