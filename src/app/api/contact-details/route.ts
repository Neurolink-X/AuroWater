import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const revalidate = 60;

const allowed = ['support_phone', 'support_email', 'whatsapp_number'] as const;
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: 'Contact settings unavailable' }, { status: 503 });
  try {
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.from('settings').select('key,value').in('key', [...allowed]);
    if (error) throw error;
    const values: Record<string, string> = {};
    for (const row of data ?? []) {
      const value = typeof row.value === 'string' ? row.value : String(row.value ?? '');
      if (row.key === 'support_email' && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value)) values.support_email = value;
      if ((row.key === 'support_phone' || row.key === 'whatsapp_number') && /^\\d{10}$/.test(value)) values[row.key] = value;
    }
    return NextResponse.json(values, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch {
    return NextResponse.json({ error: 'Contact settings temporarily unavailable' }, { status: 503 });
  }
}
