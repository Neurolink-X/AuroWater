import { NextResponse } from 'next/server';
import { rowsToSettingsPayload } from '@/lib/api/settings-map';
import { createSupabaseAnonClient, isSupabaseConfigured } from '@/lib/db/supabase';
import { successResponse } from '@/lib/utils/helpers';

/** Public settings — flat key-value merged client-side via mergeSettings(). */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(successResponse({}), { status: 200 });
  }

  try {
    const sb = createSupabaseAnonClient();
    const { data, error } = await sb.from('settings').select('key, value');
    if (error) {
      return NextResponse.json(successResponse({}), { status: 200 });
    }
    const payload = rowsToSettingsPayload(data ?? []);
    return NextResponse.json(successResponse(payload), { status: 200 });
  } catch {
    return NextResponse.json(successResponse({}), { status: 200 });
  }
}
