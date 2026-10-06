import { NextRequest } from 'next/server';

import { jsonErr, jsonOk } from '@/lib/api/json-response';
import {
  requireRole,
  requireSupabaseAuth,
} from '@/lib/api/supabase-request';

import type { ProfileRole } from '@/lib/db/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUBSCRIPTION_ROLES: ProfileRole[] = [
  'customer',
  'supplier',
];

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  // Customer → can manage their water subscriptions
  // Supplier → can also purchase water for themselves
  //
  // Technician is NOT a subscription buyer through this endpoint.
  // Admin should use a separate admin subscription endpoint.
  if (!requireRole(auth.ctx, SUBSCRIPTION_ROLES)) {
    return jsonErr('Forbidden', 403);
  }

  const { data, error } = await auth.ctx.supabase
    .from('water_subscriptions')
    .select('*')
    .eq('customer_id', auth.ctx.profile.id)
    .order('created_at', {
      ascending: false,
    });

  if (error) {
    console.error(
      '[water-subscriptions] failed to load subscriptions:',
      error,
    );

    return jsonErr(
      'Unable to load subscriptions right now',
      500,
    );
  }

  return jsonOk(data ?? []);
}
