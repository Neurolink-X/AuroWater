// PATH: src/lib/private-file-validation.ts
/**
 * Single source of truth for private-file rules.
 * Isomorphic on purpose: the browser pre-validates with the same rules the server enforces.
 */

export const MAX_PRIVATE_FILE_BYTES = 5 * 1024 * 1024;

export const PRIVATE_FILE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
} as const;
export type PrivateFileMime = keyof typeof PRIVATE_FILE_TYPES;

export const FILE_CATEGORIES = [
  'profile_photo', 'identity_document', 'business_document',
  'skill_certificate', 'service_evidence', 'support_attachment',
] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

/** Categories that stay hidden from their owner until an admin approves them. */
export const REVIEW_GATED_CATEGORIES: readonly string[] = ['identity_document', 'business_document', 'skill_certificate'];

export const UPLOAD_ROLES = ['customer', 'supplier', 'technician', 'plumber', 'admin'] as const;
export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Verification document slots: add a new document type here and every API + UI picks it up. */
export const DOCUMENT_SLOTS = {
  aadhaar_front: { category: 'identity_document', label: 'Aadhaar card (front)', hint: 'Clear photo or scan. All four corners visible.', roles: ['technician', 'plumber'] },
  aadhaar_back: { category: 'identity_document', label: 'Aadhaar card (back)', hint: 'Address side. Make sure the text is readable.', roles: ['technician', 'plumber'] },
  profile_photo: { category: 'profile_photo', label: 'Profile photo', hint: 'Recent, front-facing, good lighting.', roles: ['technician', 'plumber'] },
  skill_certificate: { category: 'skill_certificate', label: 'Skill certificate', hint: 'Trade or training certificate (JPG, PNG, WebP or PDF).', roles: ['technician', 'plumber'] },
  business_certificate: { category: 'business_document', label: 'Business certificate', hint: 'GST, shop licence or registration document.', roles: ['supplier', 'admin'] },
} as const;
export type DocumentSlot = keyof typeof DOCUMENT_SLOTS;
export const isDocumentSlot = (v: unknown): v is DocumentSlot =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(DOCUMENT_SLOTS, v);
export const slotsForRole = (role: string) =>
  (Object.entries(DOCUMENT_SLOTS) as [DocumentSlot, (typeof DOCUMENT_SLOTS)[DocumentSlot]][])
    .filter(([, s]) => (s.roles as readonly string[]).includes(role))
    .map(([slot, s]) => ({ slot, category: s.category, label: s.label, hint: s.hint }));
/** Roles an admin may review: every slot role except admin itself. */
export const slotApplicantRoles = (slot: DocumentSlot) => (DOCUMENT_SLOTS[slot].roles as readonly string[]).filter((r) => r !== 'admin');

export function isPrivateFileMime(value: string): value is PrivateFileMime {
  return Object.prototype.hasOwnProperty.call(PRIVATE_FILE_TYPES, value);
}

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const at = (b: Uint8Array, sig: number[], off = 0) => b.length >= off + sig.length && sig.every((v, i) => b[off + i] === v);

/** Identifies the real type from magic bytes, so a wrong or missing browser MIME (common on phones) is not a problem. */
export function detectPrivateFileMime(bytes: Uint8Array): PrivateFileMime | null {
  if (at(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (at(bytes, [137, 80, 78, 71, 13, 10, 26, 10])) return 'image/png';
  if (at(bytes, ascii('RIFF')) && at(bytes, ascii('WEBP'), 8)) return 'image/webp';
  if (at(bytes, ascii('%PDF-'))) return 'application/pdf';
  return null;
}

export function matchesPrivateFileSignature(bytes: Uint8Array, type: string): boolean {
  return detectPrivateFileMime(bytes) === type;
}

export function sanitizePrivateFileName(value: string, fallback: string): string {
  const cleaned = value
    .replace(/[\/\\\x00-\x1F\x7F\u202A-\u202E\u2066-\u2069]/g, '_') // separators, control chars, bidi spoofing
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 180);
  return cleaned || fallback;
}

export function isValidPrivateFileSize(size: number): boolean {
  return Number.isSafeInteger(size) && size > 0 && size <= MAX_PRIVATE_FILE_BYTES;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** SHA-256 hex via Web Crypto (Node 18+ and browsers). Stored in audit meta for integrity checks. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
