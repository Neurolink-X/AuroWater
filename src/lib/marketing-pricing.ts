/**
 * src/lib/marketing-pricing.ts  (NOT src/lib/pricing.ts, that is your order engine)
 * Public-facing prices, plans, cities and FAQs for the homepage + SEO schema.
 * Keep these numbers in sync with the values your checkout really charges.
 * Used by the page UI *and* the JSON-LD schema, so they can never disagree.
 * ⚠️ Plan discounts, tank-cleaning and visit-fee numbers are PROPOSED.
 *    Confirm them against your real margins before publishing.
 */
import { CAN_PRICES, CAN_FLOOR, VOLUME_PLANS, planForQty, memberCanPrice, upcomingIncrease } from '@/lib/pricing';
export { planForQty, memberCanPrice, upcomingIncrease, CAN_FLOOR };
export type { VolumePlan as Plan } from '@/lib/pricing';

export const SITE = {
  name: 'AuroTap',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aurotap.in',
  phone: '+919889305803', // e.g. '+91XXXXXXXXXX' – add for LocalBusiness schema
  /** Real profile URLs (Google Business Profile, Instagram, Facebook, LinkedIn...) for the schema `sameAs` field */
  social: [] as string[],
};

export const PRICING = {
  water: CAN_PRICES,
  plans: VOLUME_PLANS, // defined once in src/lib/pricing.ts
  tank: [
    { size: 'Up to 500 L',     from: 499 },
    { size: '501 – 1,000 L',   from: 699 },
    { size: '1,001 – 2,000 L', from: 999 },
  ],
  plumber: { visitFee: 149, adjustedAgainstJob: true },
} as const;

/**
 * Fees your checkout adds on top of the can price (your engine's convenienceFee).
 * Set these to the REAL values so the savings calculator never overstates savings.
 * 0 = no per-delivery fee on can orders.
 */
export const ORDER_FEES = { perDelivery: 0, assumedDeliveriesPerMonth: 4 } as const;


/**
 * Operating cities. status:
 *  'live'          = fully operational city
 *  'pin-approved'  = served only on approved PIN codes (availability checked at booking)
 * Add or remove areas here; the homepage, SEO schema and FAQ all update together.
 */
export type CityStatus = 'live' | 'pin-approved' | 'pilot';
export const CITIES = [
  { slug: 'kanpur',    name: 'Kanpur',    state: 'Uttar Pradesh', status: 'live' as CityStatus,
    areas: ['Kidwai Nagar', 'Swaroop Nagar', 'Kakadeo', 'Arya Nagar', 'Civil Lines', 'Govind Nagar', 'Barra', 'Kalyanpur', 'Panki', 'Shyam Nagar', 'Vikas Nagar', 'Juhi'] },
  { slug: 'lucknow',   name: 'Lucknow',   state: 'Uttar Pradesh', status: 'live' as CityStatus,
    areas: ['Gomti Nagar', 'Indira Nagar', 'Aliganj', 'Alambagh', 'Hazratganj', 'Aminabad', 'Mahanagar', 'Chinhat', 'Jankipuram', 'Rajajipuram', 'Aashiana'] },
  { slug: 'gorakhpur', name: 'Gorakhpur', state: 'Uttar Pradesh', status: 'live' as CityStatus,
    areas: ['Golghar', 'Rapti Nagar', 'Betiahata', 'Medical College Rd', 'Taramandal', 'Shahpur', 'Civil Lines', 'Asuran Chowk'] },
  { slug: 'delhi',     name: 'Delhi',     state: 'Delhi NCR', status: 'pin-approved' as CityStatus,
    areas: ['Dwarka', 'Rohini', 'Saket', 'Laxmi Nagar', 'Janakpuri', 'Pitampura', 'Mayur Vihar', 'Vasant Kunj'] },
  { slug: 'noida',     name: 'Noida',     state: 'Uttar Pradesh', status: 'live' as CityStatus,
    // Citywide booking coverage; listed neighborhoods are examples only.
    areas: ['Sector 18', 'Sector 62', 'Sector 73', 'Sector 76', 'Sector 137', 'Noida Extension'] },
  { slug: 'gurugram',  name: 'Gurugram',  state: 'Delhi NCR', status: 'pin-approved' as CityStatus,
    areas: ['DLF Phases', 'Golf Course Road', 'Sohna Road', 'Sector 56', 'Udyog Vihar'] },
  { slug: 'agra',      name: 'Agra',      state: 'Uttar Pradesh', status: 'pin-approved' as CityStatus,
    areas: ['Sanjay Place', 'Kamla Nagar', 'Sikandra', 'Dayal Bagh', 'Shahganj', 'Taj Ganj'] },
] as const;

export const LIVE_CITIES = CITIES.filter(c => c.status === 'live');
export const PIN_CITIES = CITIES.filter(c => c.status === 'pin-approved');
export const PILOT_CITIES = CITIES.filter(c => c.status === 'pilot');
const names = (list: readonly { name: string }[]) =>
  list.length > 1 ? `${list.slice(0, -1).map(c => c.name).join(', ')} and ${list[list.length - 1].name}` : list[0]?.name ?? '';
/** e.g. "Kanpur, Lucknow and Gorakhpur" */
export const LIVE_CITY_NAMES = names(LIVE_CITIES);
export const PIN_CITY_NAMES = names(PIN_CITIES);
/** Longest price lock any plan offers */
export const MAX_LOCK_MONTHS = Math.max(...VOLUME_PLANS.map(p => p.lockMonths));

export const FAQS = [
  {q:'How much does 20L RO water delivery cost?',a:'Current normal and chilled RO rates, applicable city prices, fees and taxes are shown before you confirm a booking.'},
  {q:'How do monthly water plans work?',a:'Each recurring delivery is paid separately under its saved pricing contract. New plans use the currently published rates. You can pause or cancel future deliveries.'},
  {q:'How much does water tank cleaning cost?',a:'Current base rates are shown at booking. Tank size, scope and any additional work are quoted before confirmation.'},
  {q:'What is the plumber visit charge?',a:'Current labour base rates and applicable fees are shown at booking. Additional work and materials need an agreed quote.'},
  {q:'Which cities do you serve?',a:'Check the live service-area directory or enter your address at booking for current city and area availability.'},
  {q:'Which payment methods are accepted?',a:'Cash and UPI are supported where available. Review the payment methods shown before confirming your booking.'},
] as const;
