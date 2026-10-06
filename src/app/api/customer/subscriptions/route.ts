import { NextRequest } from 'next/server';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import {
  requireRole,
  requireSupabaseAuth,
} from '@/lib/api/supabase-request';

export async function GET(
  req: NextRequest
) {
  void req;

  const auth =
    await requireSupabaseAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  if (
    !requireRole(
      auth.ctx,
      'customer'
    )
  ) {
    return jsonErr(
      'Forbidden',
      403
    );
  }

  const {
    data,
    error,
  } =
    await auth.ctx.supabase
      .from(
        'water_subscriptions'
      )
      .select('*')
      .eq(
        'customer_id',
        auth.ctx.profile.id
      )
      .order(
        'created_at',
        {
          ascending: false,
        }
      );

  if (error) {
    return jsonErr(
      'Unable to load subscriptions right now',
      500
    );
  }

  return jsonOk(
    data ?? []
  );
}
