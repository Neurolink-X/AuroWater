import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FALLBACK_CITIES } from '@/lib/cities';
import { isSupabaseConfigured } from '@/lib/db/supabase';
import { getSupabaseServiceRoleKey } from '@/lib/env/supabase-service-role';

export const revalidate = 300;

const CACHE = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
};

function ok(data: unknown) {
  return NextResponse.json(data, { headers: CACHE });
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return ok(FALLBACK_CITIES);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = getSupabaseServiceRoleKey();
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = service ?? anon;
  if (!url || !key) {
    return ok(FALLBACK_CITIES);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const sb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb
      .from('cities')
      .select('id, name, slug, status, lat, lng, radius_km, is_featured, sort_order')
      .order('sort_order', { ascending: true })
      .abortSignal(controller.signal);

    if (error || !data?.length) {
      return ok(FALLBACK_CITIES);
    }
    return ok(data);
  } catch {
    return ok(FALLBACK_CITIES);
  } finally {
    clearTimeout(timeout);
  }
}
