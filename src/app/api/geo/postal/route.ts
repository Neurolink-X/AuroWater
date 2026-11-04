import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/utils/supabase/server';
import { postalDistrictForCity } from '@/lib/postal-city';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PINCODE = /^[0-9]{6}$/;
const MAX_RESULTS = 50;

function response(results: unknown[]) {
  return NextResponse.json(
    { results },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    },
  );
}

/**
 * Public India Post directory lookup.
 * The browser calls this same-origin endpoint, so the site's CSP does not need
 * to trust a third-party postal API. Data comes from the already-imported
 * public.pincode_directory table; this endpoint never returns customer data.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const pincode = (params.get('pincode') ?? '').trim();
  const office = (params.get('office') ?? '').trim().replace(/[^a-z0-9 .'-]/gi, '').slice(0, 80);
  const city = (params.get('city') ?? '').trim().toLowerCase().slice(0, 60);
  const strictCity = params.get('strictCity') === 'true';

  if (pincode && !PINCODE.test(pincode)) {
    return NextResponse.json({ error: 'pincode must be 6 digits' }, { status: 400 });
  }
  if (!pincode && office.length < 3) {
    return NextResponse.json({ error: 'Enter a 6-digit pincode or at least 3 letters of a post-office name' }, { status: 400 });
  }

  try {
    const db = createServiceClient();
    const district = postalDistrictForCity(city);
    const run = (preferCity: boolean) => {
      let query = db
        .from('pincode_directory')
        .select('office_name, pincode, district, state')
        .order('office_name', { ascending: true })
        .limit(MAX_RESULTS);
      if (pincode) return query.eq('pincode', pincode);
      query = query.ilike('office_name', `%${office}%`);
      if (strictCity && district) query = query.ilike('district', `%${district}%`);
      else if (preferCity && district) query = query.ilike('district', `%${district}%`);
      return query;
    };

    // Prioritize the selected city's postal district for EVERY configured city.
    // Strict lookups never offer cross-city PINs. Non-strict lookup allows a
    // nationwide fallback if no local name exists, for legacy broad searches.
    let { data, error } = await run(Boolean(district));
    if (!error && !pincode && !strictCity && district && !data?.length) {
      ({ data, error } = await run(false));
    }
    if (error) {
      console.error('[geo/postal] directory lookup failed', { code: error.code, message: error.message });
      return NextResponse.json({ error: 'Postal lookup is temporarily unavailable' }, { status: 503 });
    }

    const seen = new Set<string>();
    const results = (data ?? [])
      .map((row: { office_name?: unknown; pincode?: unknown; district?: unknown; state?: unknown }) => ({
        name: String(row.office_name ?? '').replace(/\s*\(.*?\)\s*/g, '').trim(),
        pincode: String(row.pincode ?? '').trim(),
        district: String(row.district ?? '').trim(),
        state: String(row.state ?? '').trim(),
      }))
      .filter((row) => row.name && PINCODE.test(row.pincode))
      .filter((row) => {
        const key = `${row.name.toLowerCase()}:${row.pincode}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    return response(results);
  } catch (error) {
    console.error('[geo/postal] unexpected failure', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Postal lookup is temporarily unavailable' }, { status: 503 });
  }
}
