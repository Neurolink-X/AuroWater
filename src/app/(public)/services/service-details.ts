/* ─────────────────────────────────────────────
   Service detail content, shared by:
   - /services/[slug]/page.tsx   (page + structured data)
   - /services/[slug]/opengraph-image.tsx   (WhatsApp / social preview)
   - your sitemap (see serviceSitemapEntries at the bottom)
   No 'use client': server files can import it with zero browser cost.
───────────────────────────────────────────── */

import { BRAND, CITY_LINE, LIVE_CITIES, SERVICES, SITE_URL, type ServiceKey } from './services-data';

export type ServiceDetail = {
  key: ServiceKey;
  title: string;
  eyebrow: string;
  /** Short Hindi line for Hindi-speaking searchers (shown under the heading). */
  hindi: string;
  description: string;
  /** About 155 characters, no prices (prices are live). */
  metaDescription: string;
  /** Natural phrases people type, including Hinglish. Used for keywords. */
  searchTerms: string[];
  startingPrice: string;
  unit: string;
  icon: string;
  accent: string;
  benefits: string[];
  process: string[];
  faqs: { question: string; answer: string }[];
};

// "Kanpur, Lucknow and Gorakhpur" for sentences
const CITIES_AND = LIVE_CITIES.length > 1
  ? `${LIVE_CITIES.slice(0, -1).join(', ')} and ${LIVE_CITIES[LIVE_CITIES.length - 1]}`
  : LIVE_CITIES.join('');

export const SERVICE_DETAILS: Record<ServiceKey, ServiceDetail> = {
  water_can: {
    key: 'water_can', title: '20L Water Can Delivery', eyebrow: 'Daily drinking water',
    hindi: '20 लीटर पानी की कैन होम डिलीवरी',
    description: `Order a 20-litre drinking water can for home, shops or offices in eligible areas of ${CITIES_AND}. Choose Normal RO for everyday use or Chilled RO for gatherings; check address serviceability and the current total before confirming.`,
    metaDescription: `Order 20L Normal or Chilled RO water cans for home, shop or office in ${CITIES_AND}. Check your address and see the total before you book.`,
    searchTerms: ['20 litre water can delivery', 'RO water jar home delivery', 'chilled water can delivery', 'paani ki can delivery'],
    startingPrice: '₹20', unit: 'per 20L Normal RO can; Chilled RO priced separately', icon: '💧', accent: '#0284c7',
    benefits: ['Normal RO and Chilled RO options', 'One-time orders and Normal RO recurring delivery', 'Address and delivery-slot availability checked', 'Review current unit price and order total before confirming'],
    process: ['Choose Normal RO or Chilled RO and quantity', 'Confirm your address and available delivery slot', 'Review the final total and place your order'],
    faqs: [
      { question: 'How much does a 20L water can cost?', answer: 'The current configured Normal RO and Chilled RO rates are shown on the pricing page and in booking. Check the final total for your address before placing an order.' },
      { question: 'Can I order chilled water on a recurring schedule?', answer: 'Chilled RO is currently a one-time booking option. Recurring delivery is available for Normal RO where supported.' },
      { question: 'Where is delivery available?', answer: `${BRAND} currently serves eligible areas of ${CITIES_AND}. Availability is checked against your delivery address.` },
    ],
  },
  water_tanker: {
    key: 'water_tanker', title: 'Water Tanker Delivery', eyebrow: 'Bulk water supply',
    hindi: 'पानी का टैंकर बुक करें',
    description: 'Request bulk water delivery for homes, apartments, offices, construction sites and events. Availability depends on your delivery location and capacity needs.',
    metaDescription: `Book a water tanker for your home, apartment, site or event in ${CITIES_AND}. Share the volume, check availability and confirm the quote.`,
    searchTerms: ['water tanker booking', 'paani ka tanker', 'bulk water supply', 'tanker for construction site'],
    startingPrice: '₹299–₹799', unit: 'starting estimate; volume and access affect the quote', icon: '🚚', accent: '#0284c7',
    benefits: ['Share the volume you need', 'Confirm delivery access and location', 'See available options before confirming', 'Keep booking details in one account'],
    process: ['Choose tanker service and volume', 'Provide delivery address and timing', 'Confirm the available quote and booking'],
    faqs: [{ question: 'Is every tanker size available everywhere?', answer: 'No. Available volume and delivery options depend on the location and supplier.' }],
  },
  ro_service: {
    key: 'ro_service', title: 'RO Service & Repair', eyebrow: 'Water purifier care',
    hindi: 'RO सर्विस, फिल्टर बदलना और रिपेयर',
    description: 'Request water-purifier diagnostics, filter service or repairs. The technician can assess the unit and confirm any parts or additional work before proceeding.',
    metaDescription: `Book RO service, filter change or repair in ${CITIES_AND}. Describe the problem, check your address and confirm the estimate before work.`,
    searchTerms: ['RO service near me', 'RO repair', 'RO filter change', 'water purifier service'],
    startingPrice: '₹349', unit: 'starting estimate; parts may cost extra', icon: '🛠️', accent: '#0369a1',
    benefits: ['Describe your purifier issue', 'Request diagnostics and filter service', 'Confirm repair scope before work', 'Keep service history with your account'],
    process: ['Choose the RO issue or service type', 'Select address and a suitable slot', 'Review the visit details and confirm'],
    faqs: [{ question: 'Are filters included in the starting rate?', answer: 'Replacement parts may cost extra. Confirm the itemised estimate before approving repairs.' }],
  },
  plumbing: {
    key: 'plumbing', title: 'Plumbing Services', eyebrow: 'Home water systems',
    hindi: 'प्लंबर सर्विस: नल, पाइप और लीकेज की मरम्मत',
    description: 'Book help for leaking taps, pipe issues, fittings, blockages and routine plumbing work, subject to local service availability.',
    metaDescription: `Book a plumber for leaks, taps, pipes and fittings in ${CITIES_AND}. Check availability for your address and confirm the estimate first.`,
    searchTerms: ['plumber near me', 'tap leakage repair', 'pipe fitting service', 'plumber booking online'],
    startingPrice: '₹149', unit: 'indicative starting visit rate', icon: '🔧', accent: '#1e40af',
    benefits: ['Describe the issue before the visit', 'Request help with common household plumbing', 'Review any additional work estimate', 'Keep booking updates in one place'],
    process: ['Select the issue and add details', 'Choose your address and available slot', 'Review the estimate and confirm'],
    faqs: [{ question: 'Does the visit price include materials?', answer: 'Materials and additional work may be charged separately. Confirm the estimate with the service professional.' }],
  },
  borewell: {
    key: 'borewell', title: 'Borewell Services', eyebrow: 'Borewell installation and repair',
    hindi: 'बोरवेल रिपेयर और इंस्टॉलेशन',
    description: 'Request borewell drilling, inspection or repair. For drilling, choose diameter and estimated depth in feet to understand indicative drilling-only costs. Casing, pump, electrical work and survey are separate; final charges require a site quotation.',
    metaDescription: `Request borewell inspection, repair or installation in ${CITIES_AND}. Share your site details and confirm scope and quote before work.`,
    searchTerms: ['borewell drilling per foot', 'borewell drilling price', 'borewell repair', 'borewell installation', 'borewell service near me'],
    startingPrice: '₹80–₹150', unit: 'per foot, indicative 4.5-inch drilling only; final quote after site check', icon: '⛏️', accent: '#1d4ed8',
    benefits: ['Choose drilling, inspection or repair', '4.5-inch drilling guide ₹80–₹150/ft; 6–6.5-inch ₹150–₹250/ft; 8-inch ₹300–₹500/ft', 'Casing, pump, electrical work and survey quoted separately', 'Site conditions, permissions and deeper drilling can change the rate'],
    process: ['Choose drilling, repair or inspection and share location', 'For drilling, select diameter and estimated depth in feet', 'Review the provisional estimate; approve the itemised site quote before work'],
    faqs: [{ question: 'Is the per-foot price the complete borewell cost?', answer: 'No. Drilling is charged per foot. Casing pipe, pump, wiring, survey, transport, taxes and any other work are separate where applicable.' }, { question: 'Is ₹90–₹110 per foot guaranteed?', answer: 'No. It is a possible local starting-rate proposal for suitable small-diameter drilling, not a verified fixed price. Actual rates depend on diameter, depth, terrain and contractor quote.' }, { question: 'How do I calculate drilling cost?', answer: 'Multiply the estimated drilling depth in feet by the quoted per-foot rate. For example, 300 ft × ₹100/ft = ₹30,000 for drilling alone.' }, { question: 'Can installation be quoted from the website alone?', answer: 'No. The estimate is provisional. Site feasibility, groundwater permissions, drilling depth and itemised final charges must be confirmed before work.' }],
  },
  motor_pump: {
    key: 'motor_pump', title: 'Motor & Submersible Pump Repair', eyebrow: 'Water pump support',
    hindi: 'मोटर पंप और सबमर्सिबल पंप रिपेयर',
    description: 'Request inspection or repair for household motors and submersible pumps. Final work and parts depend on the diagnosis.',
    metaDescription: `Get motor and submersible pump repair in ${CITIES_AND}. Describe the fault, book a visit and confirm parts and charges before work.`,
    searchTerms: ['motor pump repair', 'submersible pump repair', 'water pump mechanic near me'],
    startingPrice: '₹299', unit: 'starting estimate; parts may cost extra', icon: '⚙️', accent: '#2563eb',
    benefits: ['Describe the motor or pump symptoms', 'Request a diagnostic visit', 'Confirm parts and repair charges before work', 'Keep the service request accessible in your account'],
    process: ['Select the pump problem', 'Share address and preferred timing', 'Review the visit details and confirm'],
    faqs: [{ question: 'Are spare parts included?', answer: 'Parts are generally quoted separately after diagnosis. Confirm any warranty terms before approving work.' }],
  },
  tank_cleaning: {
    key: 'tank_cleaning', title: 'Water Tank Cleaning', eyebrow: 'Tank hygiene',
    hindi: 'पानी की टंकी की सफाई',
    description: 'Request cleaning and sanitation for household or commercial water tanks. Confirm tank size, access and the service scope before booking.',
    metaDescription: `Book water tank cleaning for homes and buildings in ${CITIES_AND}. Share tank size, check availability and confirm the price before work.`,
    searchTerms: ['water tank cleaning', 'overhead tank cleaning', 'tanki safai service'],
    startingPrice: '₹599', unit: 'starting estimate; tank size affects the quote', icon: '🪣', accent: '#075985',
    benefits: ['Specify tank type and approximate capacity', 'Arrange an appropriate service slot', 'Confirm the cleaning scope before work', 'Keep booking information in your account'],
    process: ['Share tank type and capacity', 'Choose address and available timing', 'Confirm scope and final price'],
    faqs: [{ question: 'Does price depend on tank size?', answer: 'It can. Confirm the final rate for your tank capacity and access requirements before confirming.' }],
  },
};

/* FAQs every service page shares. Real questions, honest answers. */
export const SHARED_FAQS: ReadonlyArray<{ question: string; answer: string }> = [
  {
    question: `Which cities does ${BRAND} serve?`,
    answer: `${BRAND} currently serves ${CITY_LINE}. Availability depends on your area, so we check your address before a booking is confirmed.`,
  },
  {
    question: 'Do you serve Delhi NCR?',
    answer: `Not yet. ${BRAND} currently serves ${CITY_LINE} only.`,
  },
  {
    question: 'Will I know the price before I book?',
    answer: 'Yes. You see the price or starting estimate first, and the service scope and final price are confirmed before work begins. Parts and extra work are quoted separately.',
  },
];

/* Title near 60 characters: full city list when it fits, otherwise a shorter area name */
export function serviceSeoTitle(s: ServiceDetail): string {
  const full = `${s.title} in ${CITY_LINE} | ${BRAND}`;
  return full.length <= 66 ? full : `${s.title} in Uttar Pradesh | ${BRAND}`;
}

export function serviceKeywords(s: ServiceDetail): string[] {
  return Array.from(
    new Set([
      s.title,
      ...s.searchTerms,
      ...LIVE_CITIES.flatMap((c) => [`${s.title} ${c}`, ...s.searchTerms.slice(0, 2).map((t) => `${t} ${c}`)]),
      BRAND,
    ]),
  );
}

/* Spread this into your existing src/app/sitemap.ts:
     return [ ...yourExistingEntries, ...serviceSitemapEntries() ];            */
export function serviceSitemapEntries(now: Date = new Date()) {
  return [
    { url: `${SITE_URL}/services`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.9 },
    ...SERVICES.map((s) => ({
      url: `${SITE_URL}/services/${s.key}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}
