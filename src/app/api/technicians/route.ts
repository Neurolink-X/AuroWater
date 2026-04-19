import { NextResponse } from 'next/server';
import { createSupabaseAnonClient, isSupabaseConfigured } from '@/lib/db/supabase';
import { successResponse } from '@/lib/utils/helpers';

/** Public list of active technicians — lightweight social proof for booking. */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(successResponse([]), { status: 200 });
  }

  try {
    const sb = createSupabaseAnonClient();
    const { data, error } = await sb
      .from('profiles')
      .select('id, full_name, avatar_url, role, is_active')
      .eq('role', 'technician')
      .eq('is_active', true);

    if (error) {
      return NextResponse.json(successResponse([]), { status: 200 });
    }

    const list = (data ?? []).map((row) => ({
      id: row.id,
      name: row.full_name,
      avatar_url: row.avatar_url,
      rating: null as number | null,
      services: [] as string[],
    }));

    return NextResponse.json(successResponse(list), { status: 200 });
  } catch {
    return NextResponse.json(successResponse([]), { status: 200 });
  }
}
