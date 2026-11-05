// PATH: same folder as page.tsx. Plain module (no 'use client'), so the server page and the client form share one source of truth.

export const CITIES = [
  'Kanpur', 'Gorakhpur', 'Lucknow', 'Varanasi', 'Prayagraj', 'Agra', 'Meerut',
  'Bareilly', 'Aligarh', 'Mathura', 'Delhi', 'Noida', 'Ghaziabad',
] as const;
export type City = (typeof CITIES)[number];

export const SKILLS = ['Plumbing', 'RO Service', 'Borewell', 'Motor Repair', 'Water Tanker', 'Tank Cleaning'] as const;

export const FLEET_TYPES = ['Tanker', 'Equipment', 'Both'] as const;
export type Fleet = (typeof FLEET_TYPES)[number];

/** One message for every role: the same panel, the same trust points, the same labels. */
export const PANEL = {
  title: 'Water delivered. Water problems solved.',
  text: 'One AuroTap account to order 20L RO water, book trusted home water services, or grow your service or delivery business.',
  short: 'One account to order water, book home water services, or grow your business.',
  benefits: [
    'Order water and book home water services',
    'Join as a technician or water supplier',
    'Manage orders, jobs and your profile in one place',
  ],
  trust: [
    'Secure signup',
    'Check your address before every booking',
    'Technician and supplier accounts may need verification',
    'Support on WhatsApp and email',
  ],
} as const;

/** Server-rendered on the page for search engines and for people who want answers before signing up. */
export const FAQ: readonly { q: string; a: string }[] = [
  {
    q: 'Who can create an AuroTap account?',
    a: 'Customers who want to order 20L RO water and book home water services, technicians who offer plumbing, RO service, borewell, motor repair, water tanker and tank cleaning work, and suppliers who deliver water with tankers or equipment can all sign up here.',
  },
  {
    q: 'Which cities can I choose?',
    a: `You can choose from ${CITIES.join(', ')}. Your city shows where you are based. Availability still varies by address, service and partner, so check your address before booking.`,
  },
  {
    q: 'Do technicians and suppliers need to be verified?',
    a: 'Technician and supplier accounts may need verification before they can accept jobs or deliveries. The skills, service cities and fleet type you pick at signup are declared preferences and do not replace that review.',
  },
  {
    q: 'What do I need to sign up?',
    a: 'Your name, an email address, a 10-digit Indian mobile number, your city and a password of at least 8 characters with one number. Suppliers also add a business name. A GST number is optional.',
  },
];

export const EXPLORE_LINKS: readonly { href: string; title: string }[] = [
  { href: '/how-it-works', title: 'How it works' },
  { href: '/pricing', title: 'Pricing' },
  { href: '/service-areas', title: 'Service areas' },
  { href: '/services', title: 'All services' },
  { href: '/become-a-supplier', title: 'Become a supplier' },
  { href: '/account-help', title: 'Can’t sign in?' },
];
