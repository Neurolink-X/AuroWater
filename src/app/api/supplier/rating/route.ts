import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 1000;

/** Returns only the signed-in supplier's aggregate rating from real reviews.stars rows. */
export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  try {
    const service = createServiceClient();
    let total = 0;
    let count = 0;
    for (let start = 0; ; start += PAGE_SIZE) {
      const { data, error } = await service
        .from('reviews')
        .select('stars')
        .eq('supplier_id', auth.ctx.profile.id)
        .range(start, start + PAGE_SIZE - 1);

      if (error) {
        console.error('[supplier/rating] review aggregate failed', { code: error.code });
        return jsonErr('Could not load supplier rating.', 502);
      }

      const rows = data ?? [];
      for (const row of rows) {
        const stars = Number(row.stars);
        if (!Number.isInteger(stars) || stars < 1 || stars > 5) continue;
        total += stars;
        count += 1;
      }
      if (rows.length < PAGE_SIZE) break;
    }

    return jsonOk({
      average_rating: count ? Math.round((total / count) * 10) / 10 : 0,
      review_count: count,
    });
  } catch (error) {
    console.error('[supplier/rating] unexpected failure', error instanceof Error ? error.message : error);
    return jsonErr('Could not load supplier rating.', 500);
  }
}
