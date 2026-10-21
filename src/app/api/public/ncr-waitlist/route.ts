import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { createAnonClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 4_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s()-]{8,20}$/;
const ALLOWED_CITIES = new Set(['Delhi', 'Noida', 'Greater Noida', 'Ghaziabad']);

export async function POST(req: NextRequest) {
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) return jsonErr('Request too large', 413);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('Invalid request body', 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonErr('Invalid request body', 400);
  }

  const input = body as Record<string, unknown>;
  // Honeypot: quietly accept bots without persisting their payload.
  if (typeof input.website === 'string' && input.website.trim()) {
    return jsonOk({ received: true }, 201);
  }

  const city = typeof input.city === 'string' ? input.city.trim() : '';
  const area = typeof input.area === 'string' ? input.area.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const phone = typeof input.phone === 'string' ? input.phone.trim() : '';

  if (!ALLOWED_CITIES.has(city)) return jsonErr('Choose a supported NCR area', 400);
  if (area.length < 2 || area.length > 100 || /[<>]/.test(area)) {
    return jsonErr('Enter a valid sector or neighbourhood', 400);
  }
  if (!email && !phone) return jsonErr('Enter an email address or phone number', 400);
  if (email && (email.length > 254 || !EMAIL_RE.test(email))) {
    return jsonErr('Enter a valid email address', 400);
  }
  if (phone && !PHONE_RE.test(phone)) return jsonErr('Enter a valid phone number', 400);

  try {
    // Reuse the existing public waitlist table and its existing INSERT RLS policy.
    // Store locality in the existing city field to avoid an unnecessary migration.
    const db = createAnonClient();
    const { error } = await db.from('waitlist').insert({
      city: `${city} — ${area}`,
      email: email || null,
      phone: phone || null,
    });
    if (error) {
      console.error('[ncr-waitlist] insert failed:', error.code);
      return jsonErr('Could not save your request right now. Please try again later.', 503);
    }
    return jsonOk({ received: true }, 201);
  } catch {
    return jsonErr('Waitlist is temporarily unavailable. Please try again later.', 503);
  }
}
