import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireAdmin, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { isCityUuid } from '@/lib/cities';
import { createServiceClient } from '@/utils/supabase/server';

const WaitlistSchema = z.object({
  city_id: z.string().max(80).optional().nullable(),
  custom_city: z.string().max(100).optional().nullable(),
  custom_state: z.string().max(100).optional().nullable(),
  name: z.string().min(2).max(100).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().nullable(),
  role: z.enum(['customer', 'seller', 'agent']).optional(),
  business_name: z.string().max(200).optional().nullable(),
  message: z.string().max(500).optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  source: z.enum(['register', 'homepage', 'book']).optional(),
  city: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
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
    if (phone) {
      let q = sb
        .from('city_waitlist')
        .select('id')
        .eq('phone', phone)
        .gte('created_at', new Date(Date.now() - 86_400_000).toISOString());
      if (city_id) q = q.eq('city_id', city_id);
      const { data: existing } = await q.maybeSingle();
      if (existing) {
        return jsonOk({ message: 'Already on waitlist. We will notify you!' });
      }
    }

    const { error } = await sb.from('city_waitlist').insert({
      city_id,
      custom_city,
      custom_state: d.custom_state ?? null,
      name,
      phone: /^[6-9]\d{9}$/.test(phone) ? phone : '0000000000',
      email: d.email ?? null,
      role: d.role ?? 'customer',
      business_name: d.business_name ?? null,
      message: d.message ?? null,
      lat: d.lat ?? null,
      lng: d.lng ?? null,
      source: d.source ?? 'register',
    });

    if (error) {
      return jsonErr('Could not join waitlist', 500);
    }
    return jsonOk({ success: true, message: 'Added to waitlist!' });
  } catch {
    return jsonErr('Something went wrong. Please try again.', 500);
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
        custom_city, custom_state, business_name, city_id,
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
