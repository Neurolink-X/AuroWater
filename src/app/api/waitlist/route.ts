import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { isCityUuid } from '@/lib/cities';
import { createServiceClient } from '@/utils/supabase/server';

const WaitlistSchema = z.object({
  city_id: z.string().max(80).optional().nullable(),
  custom_city: z.string().max(100).optional().nullable(),
  custom_state: z.string().max(100).optional().nullable(),
  area: z.string().trim().min(2).max(120).optional().nullable(),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/).optional().nullable(),
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable(),
  role: z.enum(['customer', 'seller', 'agent']).optional(),
  business_name: z.string().max(200).optional().nullable(),
  message: z.string().max(500).optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  source: z.enum(['register', 'homepage', 'book', 'book-zone', 'ncr']).optional(),
  website: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const fail = (message: string, status: number) => {
    const response = jsonErr(message, status);
    response.headers.set('X-Request-Id', requestId);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  };
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('Invalid JSON', 400);
  }

  const parsed = WaitlistSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr('Invalid data', 400);
  }

  const d = parsed.data;
  // Honeypot: silently discard automated submissions.
  if (typeof d.website === 'string' && d.website.trim()) {
    return jsonOk({ success: true, message: 'Added to waitlist!' });
  }
  const phone = (d.phone ?? '').replace(/\D/g, '').slice(-10);
  const name = (d.name ?? '').trim() || 'Waitlist';
  const rawId = (d.city_id ?? '').trim() || null;
  const city_id = isCityUuid(rawId) ? rawId : null;
  const custom_city = (d.custom_city ?? d.city ?? (!city_id && rawId ? rawId : '')).trim() || null;

  if (!/^[6-9]\d{9}$/.test(phone) && !(typeof d.email === 'string' && d.email.includes('@'))) {
    return jsonErr('Provide a valid Indian mobile number or email', 400);
  }
  if (!city_id && !custom_city) {
    return jsonErr('Provide city_id or custom_city', 400);
  }

  try {
    const sb = createServiceClient();
    if (/^[6-9]\d{9}$/.test(phone)) {
      let q = sb
        .from('city_waitlist')
        .select('id')
        .eq('phone', phone)
        .gte('created_at', new Date(Date.now() - 86_400_000).toISOString());
      if (city_id) q = q.eq('city_id', city_id);
      else if (custom_city) q = q.ilike('custom_city', custom_city);
      if (d.area) q = q.ilike('area', d.area.trim());
      const { data: existing, error: lookupError } = await q.limit(1).maybeSingle();
      if (lookupError) {
        console.error('[waitlist] duplicate lookup failed', { requestId, code: lookupError.code, message: lookupError.message });
        return fail('Waitlist is temporarily unavailable. Please try again.', 503);
      }
      if (existing) {
        return jsonOk({ message: 'Already on waitlist. We will notify you!' });
      }
    }
    if (d.email) {
      let q = sb
        .from('city_waitlist')
        .select('id')
        .ilike('email', d.email.trim())
        .gte('created_at', new Date(Date.now() - 86_400_000).toISOString());
      if (city_id) q = q.eq('city_id', city_id);
      else if (custom_city) q = q.ilike('custom_city', custom_city);
      if (d.area) q = q.ilike('area', d.area.trim());
      const { data: existing } = await q.limit(1).maybeSingle();
      if (existing) return jsonOk({ message: 'Already on waitlist. We will notify you!' });
    }

    const { error } = await sb.from('city_waitlist').insert({
      city_id,
      custom_city,
      custom_state: d.custom_state ?? null,
      area: d.area?.trim() || null,
      pincode: d.pincode ?? null,
      name,
      phone: /^[6-9]\d{9}$/.test(phone) ? phone : null,
      email: d.email ?? null,
      role: d.role ?? 'customer',
      business_name: d.business_name ?? null,
      message: d.message ?? null,
      lat: d.lat ?? null,
      lng: d.lng ?? null,
      source: d.source ?? 'register',
    });

    if (error) {
      console.error('[waitlist] insert failed', { requestId, code: error.code, message: error.message, details: error.details, hint: error.hint });
      return fail('Could not join waitlist. Please try again.', 503);
    }
    const response = jsonOk({ success: true, message: 'Added to waitlist!' });
    response.headers.set('X-Request-Id', requestId);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    console.error('[waitlist] unexpected failure', { requestId, message: error instanceof Error ? error.message : 'unknown' });
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
        id, name, phone, email, role, status, source, created_at,
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
