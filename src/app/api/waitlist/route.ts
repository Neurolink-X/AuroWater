import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { isCityUuid } from '@/lib/cities';
import { createServiceClient } from '@/utils/supabase/server';

const WaitlistSchema = z.object({
  city_id: z.string().max(80).optional().nullable(),
  custom_city: z.string().trim().max(100).optional().nullable(),
  custom_state: z.string().trim().max(100).optional().nullable(),
  area: z.string().trim().min(2).max(120).optional().nullable(),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/).optional().nullable(),
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().trim().toLowerCase().max(254).email().optional().nullable(),
  role: z.enum(['customer', 'seller', 'agent']).optional(),
  business_name: z.string().max(200).optional().nullable(),
  message: z.string().max(500).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  source: z.enum(['register', 'homepage', 'book', 'book-zone', 'ncr', 'service-areas']).optional(),
  website: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const respond = (response: Response) => {
    response.headers.set('X-Request-Id', requestId);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  };
  const fail = (message: string, status: number) => respond(jsonErr(message, status));
  const success = (message: string) => respond(jsonOk({ success: true, message }));
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid request. Please submit the form again.', 400);
  }

  const parsed = WaitlistSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Check the form details and try again.', 400);
  }

  const d = parsed.data;
  // Honeypot: silently discard automated submissions.
  if (typeof d.website === 'string' && d.website.trim()) {
    return success('Added to waitlist!');
  }
  const digits = (d.phone ?? '').replace(/\D/g, '');
  const phone = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  const validPhone = /^[6-9]\d{9}$/.test(phone);
  const name = (d.name ?? '').trim() || 'Waitlist';
  const rawId = (d.city_id ?? '').trim() || null;
  const city_id = isCityUuid(rawId) ? rawId : null;
  const custom_city = [d.custom_city, d.city, city_id ? null : rawId]
    .find((city) => city?.trim())?.trim() || null;

  if ((digits && !validPhone) || (!validPhone && !d.email)) {
    return fail('Provide a valid 10-digit Indian mobile number or email.', 400);
  }
  if (!city_id && !custom_city) {
    return fail('Choose a city or enter your city name.', 400);
  }

  try {
    const sb = createServiceClient();
    const signal = AbortSignal.timeout(8_000);
    // Case-insensitive exact matching. User-entered % and _ must stay literal.
    const pattern = (value: string) => value.replace(/[\\%_]/g, '\\$&');
    const findExisting = (column: 'phone' | 'email', value: string) => {
      let q = sb.from('city_waitlist').select('id')
        .gte('created_at', new Date(Date.now() - 86_400_000).toISOString());
      q = column === 'phone' ? q.eq(column, value) : q.ilike(column, pattern(value));
      if (city_id) q = q.eq('city_id', city_id);
      else if (custom_city) q = q.ilike('custom_city', pattern(custom_city));
      if (d.area) q = q.ilike('area', pattern(d.area));
      return q.limit(1).maybeSingle().abortSignal(signal);
    };
    const lookups = [];
    if (validPhone) lookups.push(findExisting('phone', phone));
    if (d.email) lookups.push(findExisting('email', d.email));
    const results = await Promise.all(lookups);
    if (results.some((result) => result.error)) {
      console.error('[waitlist] duplicate lookup failed', { requestId, code: results.find((result) => result.error)?.error?.code });
      return fail('Waitlist is temporarily unavailable. Please try again.', 503);
    }
    if (results.some((result) => result.data)) {
      return success('Already on waitlist. We will notify you!');
    }

    const { error } = await sb.from('city_waitlist').insert({
      city_id,
      custom_city,
      custom_state: d.custom_state ?? null,
      area: d.area?.trim() || null,
      pincode: d.pincode ?? null,
      name,
      phone: validPhone ? phone : null,
      email: d.email ?? null,
      role: d.role ?? 'customer',
      business_name: d.business_name ?? null,
      message: d.message ?? null,
      lat: d.lat ?? null,
      lng: d.lng ?? null,
      source: d.source ?? 'register',
    }).abortSignal(signal);

    if (error) {
      console.error('[waitlist] insert failed', { requestId, code: error.code });
      return fail('Could not join waitlist. Please try again.', 503);
    }
    return success('Added to waitlist!');
  } catch (error) {
    console.error('[waitlist] unexpected failure', { requestId, name: error instanceof Error ? error.name : 'unknown' });
    return fail('Something went wrong. Please try again.', 503);
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireAdmin(auth.ctx)) return jsonErr('Forbidden', 403);

  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from('city_waitlist')
      .select(
        `
        id, name, phone, email, role, status, source, message, created_at,
        custom_city, custom_state, area, pincode, business_name, city_id,
        cities ( name, status )
      `
      )
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) return jsonErr(error.message, 500);

    const rows = (data ?? []).map((row) => {
      const nested = row.cities as { name?: string; status?: string } | { name?: string; status?: string }[] | null;
      const city = Array.isArray(nested) ? nested[0] : nested;
      return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        role: row.role,
        status: row.status,
        source: row.source,
        message: row.message,
        created_at: row.created_at,
        custom_city: row.custom_city,
        area: row.area,
        pincode: row.pincode,
        custom_state: row.custom_state,
        business_name: row.business_name,
        city_id: row.city_id,
        city_name: city?.name ?? row.custom_city ?? 'Unknown',
        city_status: city?.status ?? null,
      };
    });

    return jsonOk(rows);
  } catch {
    return jsonErr('Waitlist unavailable', 500);
  }
}
