import { createSupabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET() {
  const ts = new Date().toISOString();

  try {
    const supabase = await createSupabaseServer();

    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (error) {
      console.error('[health] database check failed:', error);

      return Response.json(
        {
          status: 'degraded',
          db: 'error',
          env: process.env.NODE_ENV,
          ts,
        },
        { status: 503 },
      );
    }

    return Response.json({
      status: 'ok',
      db: 'ok',
      env: process.env.NODE_ENV,
      ts,
    });
  } catch (error) {
    console.error('[health] health check failed:', error);

    return Response.json(
      {
        status: 'degraded',
        db: 'error',
        env: process.env.NODE_ENV,
        ts,
      },
      { status: 503 },
    );
  }
}
