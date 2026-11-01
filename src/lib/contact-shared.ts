// PATH: src/lib/contact-shared.ts
import { z } from 'zod';

/**
 * Single source of truth for the Contact feature (page, form, both API routes).
 * Isomorphic and pure: no Node-only or browser-only imports, so it is trivially unit-testable.
 */

export const SUBJECTS = ['General', 'Booking Help', 'Technician Registration', 'Supplier Partnership', 'Complaint', 'Other'] as const;
export type Subject = (typeof SUBJECTS)[number];

/** ?subject=technician style deep links from other pages. */
export const SUBJECT_ALIASES: Record<string, Subject> = {
  general: 'General', booking: 'Booking Help', technician: 'Technician Registration',
  supplier: 'Supplier Partnership', complaint: 'Complaint', other: 'Other',
};

export const LIMITS = { nameMin: 2, nameMax: 100, emailMax: 254, messageMin: 10, messageMax: 3000 } as const;

/** Service promises shown on the page. Change them here only if the operation really changes. */
export const SERVICE_PROMISES = {
  emailReply: 'within 24 hours',
  whatsappReply: 'usually within 30 minutes during working hours',
} as const;

/** Support schedule in IST. 0 = Sunday. Drives the live "Open now" badge and structured data. */
export const SUPPORT_SCHEDULE = { days: [1, 2, 3, 4, 5, 6], openHour: 8, closeHour: 20, timeZone: 'Asia/Kolkata' } as const;

/* ───────────── phone helpers ───────────── */

/** Accepts 9889305803, +91 98893 05803, 09889305803, 91-9889305803 → "9889305803". Returns null if not an Indian mobile. */
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}
export const formatPhone = (tenDigits: string) => `+91 ${tenDigits.slice(0, 5)} ${tenDigits.slice(5)}`;
export const telHref = (tenDigits: string) => `tel:+91${tenDigits}`;
export const whatsappHref = (tenDigits: string, text = 'Hi AuroTap, I need help with…') =>
  `https://wa.me/91${tenDigits}?text=${encodeURIComponent(text)}`;

/* ───────────── form schema (client + server) ───────────── */

export const contactSchema = z.object({
  name: z.string().trim()
    .min(LIMITS.nameMin, 'Please enter your name.')
    .max(LIMITS.nameMax, 'Name is too long.'),
  email: z.string().trim()
    .min(1, 'Enter your email address.')
    .max(LIMITS.emailMax, 'Email address is too long.')
    .email('Enter a valid email address.')
    .transform((v) => v.toLowerCase()),
  phone: z.string().trim()
    .min(1, 'Enter your phone number so we can call you back.')
    .refine((v) => normalizePhone(v) !== null, 'Enter a valid 10-digit Indian mobile number.')
    .transform((v) => normalizePhone(v) as string),
  subject: z.enum(SUBJECTS).default('General'),
  message: z.string().trim()
    .min(LIMITS.messageMin, `Please tell us a little more (at least ${LIMITS.messageMin} characters).`)
    .max(LIMITS.messageMax, `Please keep your message under ${LIMITS.messageMax} characters.`),
  /** Honeypot: invisible to people, tempting to bots. */
  website: z.string().max(200).optional().default(''),
});
export type ContactInput = z.input<typeof contactSchema>;

export const firstIssue = (e: z.ZodError, fallback = 'Please check the details and try again.') => e.issues[0]?.message || fallback;

/* ───────────── admin-managed settings ───────────── */

export type Offer = { headline: string; body?: string; code?: string; expiresAt?: string; href?: string };
export type ContactSettings = {
  supportPhone: string;       // 10 digits
  whatsappNumber: string;     // 10 digits
  supportEmail: string;
  officeAddress: string;
  workingHours: string;
  offer: Offer | null;        // only ever set from the admin `settings` table: no hard-coded discount claims
};

export const DEFAULT_CONTACT: ContactSettings = {
  supportPhone: '9889305803',
  whatsappNumber: '9889305803',
  supportEmail: 'support.aurotap@gmail.com',
  officeAddress: 'Kanpur, Uttar Pradesh',
  workingHours: 'Mon–Sat, 8AM–8PM IST',
  offer: null,
};

export const SETTINGS_KEYS = [
  'support_phone', 'whatsapp_number', 'support_email', 'office_address', 'working_hours',
  'contact_offer_headline', 'contact_offer_body', 'contact_offer_code', 'contact_offer_expires_at', 'contact_offer_link',
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const asText = (v: unknown, max: number) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, max) : '');
/** Only same-site paths or https links may be used as an offer link. */
const safeHref = (v: string) => (v.startsWith('/') && !v.startsWith('//')) || /^https:\/\//i.test(v) ? v : undefined;

/** Pure and defensive: bad or missing admin values silently fall back to safe defaults. */
export function parseContactSettings(rows: { key: string; value: unknown }[]): ContactSettings {
  const raw = new Map(rows.map((r) => [r.key, r.value]));
  const out: ContactSettings = { ...DEFAULT_CONTACT };

  const phone = normalizePhone(asText(raw.get('support_phone'), 20));
  if (phone) out.supportPhone = phone;
  const wa = normalizePhone(asText(raw.get('whatsapp_number'), 20));
  out.whatsappNumber = wa ?? phone ?? DEFAULT_CONTACT.whatsappNumber;
  const email = asText(raw.get('support_email'), 254).toLowerCase();
  if (EMAIL_RE.test(email)) out.supportEmail = email;
  const address = asText(raw.get('office_address'), 200); if (address) out.officeAddress = address;
  const hours = asText(raw.get('working_hours'), 80); if (hours) out.workingHours = hours;

  const headline = asText(raw.get('contact_offer_headline'), 90);
  if (headline) {
    const expires = asText(raw.get('contact_offer_expires_at'), 40);
    const href = safeHref(asText(raw.get('contact_offer_link'), 300));
    out.offer = {
      headline,
      body: asText(raw.get('contact_offer_body'), 220) || undefined,
      code: asText(raw.get('contact_offer_code'), 24).toUpperCase() || undefined,
      expiresAt: expires && !Number.isNaN(Date.parse(expires)) ? expires : undefined,
      href,
    };
  }
  return out;
}

export const isOfferActive = (offer: Offer | null, now = Date.now()): offer is Offer =>
  !!offer && (!offer.expiresAt || Date.parse(offer.expiresAt) > now);

/* ───────────── live support status (IST) ───────────── */

export function supportStatus(now = new Date()): { open: boolean; label: string } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: SUPPORT_SCHEDULE.timeZone, weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  const open = (SUPPORT_SCHEDULE.days as readonly number[]).includes(day) && hour >= SUPPORT_SCHEDULE.openHour && hour < SUPPORT_SCHEDULE.closeHour;
  return open ? { open, label: 'Support is online now' } : { open, label: 'Offline now · message us and we’ll reply when we’re back' };
}
