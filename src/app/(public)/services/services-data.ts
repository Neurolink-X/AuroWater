/* ─────────────────────────────────────────────
   Shared data for the Services page.
   No 'use client' here, so server files (page.tsx, sitemap.ts,
   /services/[key]) can import it without sending it to the browser twice.
───────────────────────────────────────────── */

export const BRAND = 'AuroTap';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://aurotap.in').replace(/\/$/, '');
export const PAGE_PATH = '/services';

export const LIVE_CITIES = ['Kanpur', 'Lucknow', 'Gorakhpur'] as const;
export const CITY_LINE = 'Kanpur, Lucknow & Gorakhpur';

/* ── Types ── */
export type ServiceKey =
  | 'water_can'
  | 'water_tanker'
  | 'ro_service'
  | 'plumbing'
  | 'borewell'
  | 'motor_pump'
  | 'tank_cleaning';

export type ServiceCategory = 'All' | 'Water' | 'Plumbing' | 'Electrical' | 'Cleaning';

export type Service = {
  key: ServiceKey;
  category: Exclude<ServiceCategory, 'All'>;
  title: string;
  tag: string;
  fromPrice: number;
  unit: string;
  desc: string;
  /** Price-free text for search engines (visible prices come from live settings). */
  seoDesc?: string;
  accent: string;
  accentLight: string;
  includes: string[];
  badge?: string;
};

/* ── Services ── */
export const SERVICES: Service[] = [
  {
    key: 'water_can',
    category: 'Water',
    title: 'Normal & Chilled RO Water',
    tag: 'Water supply',
    fromPrice: 20,
    unit: '/ 20L can',
    desc: 'Choose everyday Normal RO Water for ₹20 per 20L can or chilled water for ₹25 per 20L can. Delivery availability and final total are confirmed before booking.',
    seoDesc: 'Normal and chilled RO drinking water delivered in 20 litre cans. Delivery availability and final total are confirmed before booking.',
    accent: '#1D6FC4',
    accentLight: '#EFF6FF',
    includes: ['Normal RO ₹20 / 20L', 'Chilled RO ₹25 / 20L', 'Delivery availability checked'],
    badge: 'Normal ₹20 · Chilled ₹25',
  },
  {
    key: 'water_tanker',
    category: 'Water',
    title: 'Water Tanker Delivery',
    tag: 'Bulk service',
    fromPrice: 299,
    unit: 'starting estimate',
    desc: 'Request bulk water delivery for homes, offices and sites. Volume, access, availability and final price are confirmed before booking.',
    accent: '#0284C7',
    accentLight: '#F0F9FF',
    includes: ['Volume options', 'Address and access check', 'Quote confirmed before booking'],
  },
  {
    key: 'ro_service',
    category: 'Plumbing',
    title: 'RO Service & Repair',
    tag: 'Repair & care',
    fromPrice: 349,
    unit: 'starting estimate',
    desc: 'Request purifier diagnostics, filter service or repair. Replacement parts and extra work are quoted separately.',
    accent: '#0369A1',
    accentLight: '#E0F2FE',
    includes: ['Service request details', 'Filter / repair options', 'Parts quoted separately'],
  },
  {
    key: 'plumbing',
    category: 'Plumbing',
    title: 'Plumbing Services',
    tag: 'Quick Fix',
    fromPrice: 149,
    unit: '/ visit',
    desc: 'Leaks, fittings, pipe repair and more. Clear estimates before work begins.',
    accent: '#1E40AF',
    accentLight: '#EFF6FF',
    includes: ['Leak fixing', 'Fittings & repair', 'Pipe maintenance'],
  },
  {
    key: 'borewell',
    category: 'Plumbing',
    title: 'Borewell Services',
    tag: 'Deep Work',
    fromPrice: 499,
    unit: 'starting estimate',
    desc: 'Boring, installation, and repairs. Dependable scheduling, transparent options.',
    accent: '#1D4ED8',
    accentLight: '#EEF2FF',
    includes: ['Borewell repair', 'New installation', 'Diagnostic support'],
  },
  {
    key: 'motor_pump',
    category: 'Electrical',
    title: 'Motor Pump Repair',
    tag: 'Pump service',
    fromPrice: 299,
    unit: '/ visit',
    desc: 'Request inspection or repair for motors and submersible pumps. Final scope depends on diagnosis and parts.',
    accent: '#2563EB',
    accentLight: '#EFF6FF',
    includes: ['Issue details', 'Inspection request', 'Repair scope confirmed'],
  },
  {
    key: 'tank_cleaning',
    category: 'Cleaning',
    title: 'Water Tank Cleaning',
    tag: 'Hygienic',
    fromPrice: 599,
    unit: 'starting estimate',
    desc: 'Request water-tank cleaning. Tank size, access, cleaning scope and the final price are confirmed before work begins.',
    accent: '#075985',
    accentLight: '#F0F9FF',
    includes: ['Tank details', 'Cleaning scope confirmed', 'After-care guidance where applicable'],
  },
];

export const CATEGORIES: ServiceCategory[] = ['All', 'Water', 'Plumbing', 'Electrical', 'Cleaning'];

export const CATEGORY_ICONS: Record<ServiceCategory, string> = {
  All: '◈',
  Water: '⬡',
  Plumbing: '⚙',
  Electrical: '⚡',
  Cleaning: '✦',
};

/* ── Images: one lookup table instead of long ternary chains ── */
export const ILLUSTRATIONS: Record<ServiceKey, string> = {
  water_can: '/illustrations/water-can-delivery.svg',
  water_tanker: '/illustrations/water-tanker.svg',
  ro_service: '/illustrations/pump-service.svg',
  motor_pump: '/illustrations/pump-service.svg',
  tank_cleaning: '/illustrations/tank-cleaning.svg',
  plumbing: '/illustrations/plumber-repair.svg',
  borewell: '/illustrations/home-technician.svg',
};

export const ILLUSTRATION_ALT: Record<ServiceKey, string> = {
  water_can: '20 litre reusable water jars for home delivery in India',
  water_tanker: 'Water tanker delivering bulk water to a home',
  ro_service: 'Technician servicing a household RO water purifier',
  motor_pump: 'Technician repairing a motor pump',
  tank_cleaning: 'Professional cleaning an overhead water tank',
  plumbing: 'Plumber at work repairing household plumbing',
  borewell: 'Home-service technician for borewell work',
};

/* ── FAQ (server-rendered on the page and used for structured data) ── */
export const SERVICE_FAQS: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: 'Which cities does AuroTap serve?',
    a: `AuroTap currently serves ${CITY_LINE}. Availability can differ by area, so we check your address before a booking is confirmed.`,
  },
  {
    q: 'Which water and home services can I book?',
    a: 'You can book 20L normal and chilled RO water cans, water tanker delivery, RO service and repair, plumbing, borewell services, motor pump repair and water tank cleaning.',
  },
  {
    q: 'Will I know the price before I book?',
    a: 'Yes. Water can prices are shown on this page. For repairs and installations you see the starting estimate, and the service scope and final price are confirmed before work begins. Replacement parts are quoted separately.',
  },
  {
    q: 'How do I check if you deliver to my area?',
    a: 'Choose a service and enter your address on the booking page. We check serviceability for your area and tell you before you confirm.',
  },
];
