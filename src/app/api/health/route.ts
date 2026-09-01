import { createSupabaseServer } from '@/lib/supabase/server';

export async function GET() {
  const ts = new Date().toISOString();
  try {
    const supabase = createSupabaseServer();
    const { error } = await supabase.from('profiles').select('id').limit(1);
    if (error) throw error;

    return Response.json({ status: 'ok', db: 'ok', env: process.env.NODE_ENV, ts });
  } catch (e: unknown) {
    return Response.json(
      { status: 'degraded', db: 'error', detail: String(e), ts },
      { status: 503 }
    );
  }
}
