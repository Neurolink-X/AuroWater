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
      .select('id, key, label:name, description, base_price, is_active, created_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[api/services] Failed to load active service types:', error.message);
      return NextResponse.json(
        { success: false, data: [], error: 'Services are temporarily unavailable. Please try again.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(successResponse(data ?? []), { status: 200 });
  } catch (error) {
    console.error('[api/services] Unexpected service query failure:', error);
    return NextResponse.json(
      { success: false, data: [], error: 'Services are temporarily unavailable. Please try again.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
