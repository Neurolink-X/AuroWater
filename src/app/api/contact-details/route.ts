// PATH: src/app/api/contact-details/route.ts
import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getContactSettingsWithMeta } from '@/lib/contact-settings';
import { isOfferActive } from '@/lib/contact-shared';

/**
 * Public, read-only contact details for widgets and external embeds.
 * (The /contact page itself reads the same data on the server and no longer calls this route.)
 *
 * Design:
 *  - Single source of truth: validation and defaults live in contact-shared.ts (pure, unit-testable).
 *  - Never fails closed: if the database is down, callers still get safe defaults,
 *    flagged with `X-Contact-Source: fallback` and a short cache so recovery is fast.
 *  - ETag + 304 support, so polling widgets cost almost nothing.
 *  - Only fields that are already public on the website are exposed.
 *
 * FIXED from the previous version: its regex literals were double-escaped (`\\s`, `\\d`), so no
 * admin-configured phone or email ever validated and the route always answered `{}`.
 */
export const dynamic = 'force-dynamic'; // reads request headers; data is cached one layer down (unstable_cache)

const CACHE_LIVE = 'public, max-age=30, s-maxage=60, stale-while-revalidate=300';
const CACHE_FALLBACK = 'public, max-age=0, s-maxage=10, stale-while-revalidate=30';

const etagMatches = (header: string | null, etag: string) =>
  !!header && (header.trim() === '*' || header.split(',').some((t) => t.trim().replace(/^W\//, '') === etag.replace(/^W\//, '')));

export async function GET(req: NextRequest) {
  const { settings: s, source } = await getContactSettingsWithMeta();
  const offer = isOfferActive(s.offer) ? s.offer : null;

  // snake_case keys are kept so existing consumers keep working; new fields are additive.
  const body = {
    support_phone: s.supportPhone,
    whatsapp_number: s.whatsappNumber,
    support_email: s.supportEmail,
    office_address: s.officeAddress,
    working_hours: s.workingHours,
    offer,
  };
  const json = JSON.stringify(body);
  const etag = `W/"${createHash('sha1').update(json).digest('base64url').slice(0, 22)}"`;

  const headers: Record<string, string> = {
    'Cache-Control': source === 'live' ? CACHE_LIVE : CACHE_FALLBACK,
    ETag: etag,
    'X-Contact-Source': source,
    'X-Content-Type-Options': 'nosniff',
    'Content-Type': 'application/json; charset=utf-8',
  };

  if (etagMatches(req.headers.get('if-none-match'), etag)) return new NextResponse(null, { status: 304, headers });
  return new NextResponse(json, { status: 200, headers });
}
