/** Shared by the server page and the client page. No 'use client' here. */

export const BRAND = 'AuroWater';
/** Route of this page. Change it if your route differs (canonical, Open Graph, JSON-LD). */
export const PAGE_PATH = '/pricing';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aurotap.com').replace(/\/$/, '');
export const WHATSAPP = 'https://wa.me/919889305803';

// Launch water-can rates, shared by the page, the comparison table and the structured data.
export const NORMAL_RO_PRICE = 20;
export const CHILLED_RO_PRICE = 25;
export const RECURRING_RO_PRICE = 20;

export const CITIES = ['Kanpur', 'Lucknow', 'Gorakhpur'] as const;

// Single source for the layout metadata and the page's structured data.
export const PAGE_TITLE = 'Water Delivery Pricing & Recurring Plans | AuroWater';
export const PAGE_DESCRIPTION = `Compare one-time and recurring 20L water-can delivery (from ₹${NORMAL_RO_PRICE}, Chilled RO ₹${CHILLED_RO_PRICE}) and home water-service prices in ${CITIES.join(', ')}. Delivery included, no separate water handling fee, final total shown before you confirm.`;
export const PAGE_KEYWORDS = ['water can delivery price', '20 litre water can Kanpur', 'RO water delivery Lucknow', 'chilled water for events', 'plumber booking', 'water tank cleaning service', 'water tanker booking Gorakhpur'];

export type FaqItem = { q: string; a: string };

export const FAQS: FaqItem[] = [
  { q: 'What is the minimum order for can delivery?', a: 'You can order one 20L can on a pay-as-you-go basis. The current per-can rate and final total are shown before you confirm; water-can orders have no separate handling fee.' },
  { q: 'How does recurring delivery work?', a: 'Choose the number of cans per delivery and a weekly or monthly schedule. Each delivery is charged separately by cash or UPI; there is no automatic debit. You can pause or cancel future deliveries.' },
  { q: 'Can I mix can delivery and other services?', a: 'Yes! Book tanker delivery, RO service, or plumbing alongside your can subscription — all from one account.' },
  { q: 'What payment methods are accepted?', a: 'Recurring water deliveries currently support cash or UPI payment per delivery. Other payment options are shown only when available in the booking flow.' },
  { q: 'Can I pause or cancel recurring deliveries?', a: 'You can pause, resume or cancel future deliveries from your subscriptions page. Orders already in progress may not be cancellable.' },
  { q: 'Are taxes and order fees included?', a: 'The final payable total is shown before you confirm. Water-can orders currently have no separate handling fee. Any legally applicable tax treatment must be verified for the supplier and service before it is advertised as included.' },
  { q: 'Where is AuroWater available?', a: 'Live service zones currently cover eligible areas of Kanpur, Lucknow and Gorakhpur. Availability is confirmed from your delivery address; other areas may be added later.' },
  { q: 'How do I change a recurring plan?', a: 'Pause or cancel the existing schedule and create a new booking with the quantity and frequency you need.' },
  { q: 'How do plumbing and tank cleaning bookings work?', a: 'Choose the service, check availability for your address, and review the starting estimate. The scope and final price are confirmed before work begins, and parts or extra work may cost more.' },
];

export type ServiceKey = 'water_tanker' | 'plumbing' | 'borewell' | 'motor_pump' | 'ro_service' | 'tank_cleaning';

/** Original six service cards. Prices come from live settings on the client. */
export const SERVICE_CARDS: { key: ServiceKey; emoji: string; name: string; note: string; skill: string }[] = [
  { key: 'water_tanker', emoji: '🚰', name: 'Water Tanker', note: 'Final quote depends on volume, access and service area.', skill: 'Water Tanker' },
  { key: 'plumbing', emoji: '🔧', name: 'Plumbing', note: 'Materials and additional work may cost extra.', skill: 'Plumbing' },
  { key: 'borewell', emoji: '⛏️', name: 'Borewell Service', note: 'Scope and site requirements affect the quote.', skill: 'Borewell' },
  { key: 'motor_pump', emoji: '⚙️', name: 'Motor & Pump Repair', note: 'Parts and repair work are quoted after diagnosis.', skill: 'Motor Repair' },
  { key: 'ro_service', emoji: '💧', name: 'RO Service', note: 'Replacement parts may cost extra.', skill: 'RO Service' },
  { key: 'tank_cleaning', emoji: '🪣', name: 'Tank Cleaning', note: 'Tank capacity and access can affect the final price.', skill: 'Tank Cleaning' },
];
