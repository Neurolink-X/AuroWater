import { NextResponse } from 'next/server';
import { createSupabaseAnonClient, isSupabaseConfigured } from '@/lib/db/supabase';
import { successResponse } from '@/lib/utils/helpers';

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(successResponse([]), { status: 200 });
  }

  try {
    const sb = createSupabaseAnonClient();
    const { data, error } = await sb
      .from('service_types')
      .select('id, key, name, description, base_price, unit, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      return NextResponse.json(successResponse([]), { status: 200 });
    }

    return NextResponse.json(successResponse(data ?? []), { status: 200 });
  } catch {
    return NextResponse.json(successResponse([]), { status: 200 });
  }
}
