/** Shared by the server page and the client directory. No 'use client' here. */

export const BRAND = 'AuroTap';
/** Route of this page. Change it if your route differs (used for canonical, Open Graph, JSON-LD). */
export const PAGE_PATH = '/technicians';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aurotap.com').replace(/\/$/, '');

/** Your original marketing badge, kept. Only keep a figure you can substantiate. Set to '' to hide it. */
export const EARNINGS_CLAIM = 'EARN ₹30,000+ / MONTH';
/** Your original behaviour was 4.8 for technicians with no rating. null shows a "New" badge instead of a rating nobody gave. */
export const DEFAULT_RATING: number | null = null;

export const UP_CITIES = ['Kanpur', 'Gorakhpur', 'Lucknow', 'NCR'] as const;

export type ServiceKey = 'water_tanker' | 'ro_service' | 'plumbing' | 'borewell' | 'motor_pump' | 'tank_cleaning';

export type Technician = {
  id: string;
  name: string;
  initials: string;
  skills: string[];
  city: string;
  rating: number | null;
  jobs: number;
  verified: boolean;
  available: boolean;
  preferredServiceKey: ServiceKey;
  speciality: string;
  experience: string;
};

export const SERVICES: { key: ServiceKey; skill: string; label: string; icon: string; blurb: string }[] = [
  { key: 'plumbing', skill: 'Plumbing', label: 'Plumbing', icon: '🔧', blurb: 'Leaks, pipes, taps, bathroom and kitchen fittings.' },
  { key: 'ro_service', skill: 'RO Service', label: 'RO service', icon: '💧', blurb: 'RO installation, repair and filter changes.' },
  { key: 'water_tanker', skill: 'Water Tanker', label: 'Water tanker', icon: '🚰', blurb: 'Bulk water for homes, societies and sites.' },
  { key: 'borewell', skill: 'Borewell', label: 'Borewell', icon: '⛏️', blurb: 'Borewell drilling, repair and servicing.' },
  { key: 'motor_pump', skill: 'Motor Repair', label: 'Motor and pump', icon: '⚙️', blurb: 'Water motor and pump repair and replacement.' },
  { key: 'tank_cleaning', skill: 'Tank Cleaning', label: 'Tank cleaning', icon: '🪣', blurb: 'Cleaning of overhead and underground tanks.' },
];

export const SKILL_ICONS: Record<string, string> = Object.fromEntries(SERVICES.map((s) => [s.skill, s.icon]));

export const FAQS = [
  { q: 'How do I book a technician?', a: 'Pick a service or browse the list, choose a technician who shows as Available, and tap Book Now. The booking page opens with that service already selected.' },
  { q: 'Which cities do you serve?', a: `We currently list technicians in ${UP_CITIES.slice(0, -1).join(', ')} and ${UP_CITIES[UP_CITIES.length - 1]}. More cities are added over time.` },
  { q: 'Which services can I book?', a: 'Plumbing, RO service, water tanker, borewell, motor and pump repair, and tank cleaning.' },
  { q: 'What do Live and Busy mean?', a: 'Live means the technician is taking new jobs right now. Busy means they are not accepting new bookings at the moment, so check back later.' },
  { q: 'What does the Verified badge mean?', a: `Technicians apply on ${BRAND}, and our team reviews each application and contacts the applicant to check their details. The badge shows which profiles are marked as verified in our directory.` },
  { q: 'How do I join as a technician?', a: 'Apply in about two minutes on the partner registration page. We review applications within 24 hours.' },
];
