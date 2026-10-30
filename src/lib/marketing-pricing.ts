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
export type CityStatus = 'live' | 'pin-approved';
export const CITIES = [
  { slug: 'kanpur',    name: 'Kanpur',    state: 'Uttar Pradesh', status: 'live' as CityStatus,
    areas: ['Kidwai Nagar', 'Swaroop Nagar', 'Kakadeo', 'Arya Nagar', 'Civil Lines', 'Govind Nagar', 'Barra', 'Kalyanpur', 'Panki', 'Shyam Nagar', 'Vikas Nagar', 'Juhi'] },
  { slug: 'lucknow',   name: 'Lucknow',   state: 'Uttar Pradesh', status: 'live' as CityStatus,
    areas: ['Gomti Nagar', 'Indira Nagar', 'Aliganj', 'Alambagh', 'Hazratganj', 'Aminabad', 'Mahanagar', 'Chinhat', 'Jankipuram', 'Rajajipuram', 'Aashiana'] },
  { slug: 'gorakhpur', name: 'Gorakhpur', state: 'Uttar Pradesh', status: 'live' as CityStatus,
    areas: ['Golghar', 'Rapti Nagar', 'Betiahata', 'Medical College Rd', 'Taramandal', 'Shahpur', 'Civil Lines', 'Asuran Chowk'] },
  { slug: 'delhi',     name: 'Delhi',     state: 'Delhi NCR', status: 'pin-approved' as CityStatus,
    areas: ['Dwarka', 'Rohini', 'Saket', 'Laxmi Nagar', 'Janakpuri', 'Pitampura', 'Mayur Vihar', 'Vasant Kunj'] },
  { slug: 'noida',     name: 'Noida',     state: 'Delhi NCR', status: 'pin-approved' as CityStatus,
    // Current launch is limited to the verified Sector 73 pilot zone.
    areas: ['Sector 73'] },
  { slug: 'gurugram',  name: 'Gurugram',  state: 'Delhi NCR', status: 'pin-approved' as CityStatus,
    areas: ['DLF Phases', 'Golf Course Road', 'Sohna Road', 'Sector 56', 'Udyog Vihar'] },
  { slug: 'agra',      name: 'Agra',      state: 'Uttar Pradesh', status: 'pin-approved' as CityStatus,
    areas: ['Sanjay Place', 'Kamla Nagar', 'Sikandra', 'Dayal Bagh', 'Shahganj', 'Taj Ganj'] },
] as const;

export const LIVE_CITIES = CITIES.filter(c => c.status === 'live');
export const PIN_CITIES = CITIES.filter(c => c.status === 'pin-approved');
const names = (list: readonly { name: string }[]) =>
  list.length > 1 ? `${list.slice(0, -1).map(c => c.name).join(', ')} and ${list[list.length - 1].name}` : list[0]?.name ?? '';
/** e.g. "Kanpur, Lucknow and Gorakhpur" */
export const LIVE_CITY_NAMES = names(LIVE_CITIES);
export const PIN_CITY_NAMES = names(PIN_CITIES);
/** Longest price lock any plan offers */
export const MAX_LOCK_MONTHS = Math.max(...VOLUME_PLANS.map(p => p.lockMonths));

export const FAQS = [
  { q: `How much does 20L RO water delivery cost?`,
    a: `Normal RO is ₹${PRICING.water.normal} per 20L can and Chilled RO is ₹${PRICING.water.chilled} per 20L can. Monthly plans lock that price for up to ${MAX_LOCK_MONTHS} months.` },
  { q: 'How do monthly water plans work?',
    a: `Plans lock your per-can price (₹${CAN_FLOOR.normal} normal, ₹${CAN_FLOOR.chilled} chilled) even if list prices change: ${PRICING.plans[1].lockMonths} months from ${PRICING.plans[1].minCans} cans a month, ${PRICING.plans[2].lockMonths} months from ${PRICING.plans[2].minCans} cans and ${PRICING.plans[3].lockMonths} months from ${PRICING.plans[3].minCans} cans. Members also get an extra discount on future list prices, and the price never goes below ₹${CAN_FLOOR.normal}. Use the savings calculator to compare with what you pay today.` },
  { q: 'How much does water tank cleaning cost?',
    a: `Tank cleaning starts from ₹${PRICING.tank[0].from} for tanks up to 500 litres, ₹${PRICING.tank[1].from} up to 1,000 litres and ₹${PRICING.tank[2].from} up to 2,000 litres. Larger or heavily soiled tanks are quoted before work begins.` },
  { q: 'What is the plumber visit charge?',
    a: `The visit charge is ₹${PRICING.plumber.visitFee} and is adjusted against the repair bill if you go ahead with the job. You see the price before you confirm.` },
  { q: 'Which cities do you serve?',
    a: `AuroTap is live in ${LIVE_CITY_NAMES}. We also serve ${PIN_CITY_NAMES} on approved PIN codes. Enter your address at booking and we confirm availability before you pay.` },
  { q: 'Which payment methods are accepted?',
    a: 'Cash and UPI are supported where available. The payment methods for your booking are shown before you confirm.' },
] as const;
