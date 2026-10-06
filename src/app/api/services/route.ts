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
      .select('id, key, name, description, base_price, is_active, created_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      return NextResponse.json(successResponse([]), { status: 200 });
    }

    const normalized = (data ?? []).map((row) => ({ ...row, label: row.name }));
    return NextResponse.json(successResponse(normalized), { status: 200 });
  } catch {
    return NextResponse.json(successResponse([]), { status: 200 });
  }
}
