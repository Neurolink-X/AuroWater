import { NextResponse } from 'next/server';
import { createSupabaseAnonClient, isSupabaseConfigured } from '@/lib/db/supabase';
import { rowsToSettingsPayload } from '@/lib/api/settings-map';
import { getSupabaseServiceRoleKey } from '@/lib/env/supabase-service-role';
import { createServiceClient } from '@/utils/supabase/server';
import { successResponse } from '@/lib/utils/helpers';

const CACHE_HEADER = { 'Cache-Control': 'public, max-age=60' };

/** Public settings — all key-value rows, no auth. */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(successResponse({}), { status: 200, headers: CACHE_HEADER });
  }

  type SettingsRow = { key: string; value: string };
  let rows: SettingsRow[] | null = null;

  const serviceKey = getSupabaseServiceRoleKey();
  if (serviceKey) {
    try {
      const sb = createServiceClient();
      const { data, error } = await sb.from('settings').select('key, value');
      if (!error && data) {
        rows = data as SettingsRow[];
      }
    } catch {
      rows = null;
    }
  }

  if (!rows) {
    const sb = createSupabaseAnonClient();
    const { data, error } = await sb.from('settings').select('key, value');
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 502, headers: CACHE_HEADER }
      );
    }
    rows = (data ?? []) as SettingsRow[];
  }

  const payload = rowsToSettingsPayload(rows);
  return NextResponse.json(successResponse(payload), { status: 200, headers: CACHE_HEADER });
}
