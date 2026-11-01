// PATH: src/app/api/contact/route.ts
import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { consumeRateLimit } from '@/lib/api/rate-limit';
import { createServiceClient } from '@/utils/supabase/server';
import { contactSchema, firstIssue } from '@/lib/contact-shared';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 12_000;
const PER_IP = { max: 6, windowSeconds: 3600 };
const PER_EMAIL = { max: 3, windowSeconds: 3600 };

/** Prefer headers set by the platform (hard to spoof) over client-supplied X-Forwarded-For. */
function clientIp(req: NextRequest) {
  const h = req.headers;
  return h.get('cf-connecting-ip') || h.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
    || h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

/** Browser POSTs always send Origin. Compare hosts (not full origins) so reverse proxies and www/apex setups don't break. */
function isSameSite(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (!origin) return true; // non-browser client (curl, server-to-server): rate limits still apply
  let host: string;
  try { host = new URL(origin).host; } catch { return false; }
  const allowed = new Set([req.headers.get('x-forwarded-host'), req.headers.get('host'), req.nextUrl.host].filter(Boolean) as string[]);
  try { if (process.env.NEXT_PUBLIC_SITE_URL) allowed.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).host); } catch { /* ignore bad env */ }
  return allowed.has(host);
}

function limited(retryAfter: number) {
  const res = jsonErr('Too many requests. Please try again later or call us.', 429, 'RATE_LIMITED');
  res.headers.set('Retry-After', String(Math.max(1, retryAfter)));
  return res;
}

export async function POST(req: NextRequest) {
  if (!isSameSite(req)) return jsonErr('Invalid request origin.', 403);
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return jsonErr('Message too large.', 413);

  // Cheap rejections first: they never touch the database or burn anyone's quota.
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return jsonErr('Message too large.', 413);
    raw = JSON.parse(text);
  } catch { return jsonErr('Invalid request.', 400); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return jsonErr('Invalid request.', 400);

  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) return jsonErr(firstIssue(parsed.error), 422);
  const { name, email, phone, subject, message, website } = parsed.data;

  // Honeypot tripped: pretend success so bots learn nothing, store nothing.
  if (website) return jsonOk({ received: true as const, message: 'Thank you. Your message has been received.' }, 201);

  let db;
  try { db = createServiceClient(); } catch (e) {
    console.error('[contact] service client unavailable', e);
    return jsonErr('Contact form is temporarily unavailable. Please call or WhatsApp us.', 503, 'UNAVAILABLE');
  }

  // Durable per-network and per-email limits. A limiter outage must not silently
  // remove abuse protection on this unauthenticated public write endpoint.
  for (const [scope, id, cfg] of [['contact-ip', clientIp(req), PER_IP], ['contact-email', email, PER_EMAIL]] as const) {
    const rate = await consumeRateLimit(db, scope, id, cfg.max, cfg.windowSeconds);
    if (rate.unavailable) {
      console.error('[contact] rate limiter unavailable', scope);
      const response = jsonErr('Messaging is temporarily unavailable. Please try again later.', 503, 'RATE_LIMIT_UNAVAILABLE');
      response.headers.set('Retry-After', '60');
      response.headers.set('Cache-Control', 'no-store');
      return response;
    }
    if (!rate.allowed) return limited(rate.retryAfter);
  }

  const { data, error } = await db.from('contact_requests')
    .insert({ name, email, phone, subject, message })
    .select('id').maybeSingle();
  if (error) {
    console.error('[contact] submission failed', error); // never leak database errors to a public client
    return jsonErr('We could not submit your message. Please try again, or call us.', 500, 'CONTACT_SUBMISSION_FAILED');
  }

  // Short human-friendly reference the customer can quote on a call.
  const reference = data?.id ? String(data.id).replace(/-/g, '').slice(0, 8).toUpperCase() : undefined;
  const res = jsonOk({ received: true as const, reference, message: 'Thank you. Your message has been received.' }, 201);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
