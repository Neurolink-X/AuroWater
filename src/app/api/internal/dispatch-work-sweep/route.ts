import { NextRequest } from 'next/server';
import { runDispatchWorkQueue } from '@/lib/dispatch-work-queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  // Existing Supabase pg_cron job posts the same secret used by the technician
  // sweep. An absent secret must fail CLOSED.
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== 'Bearer ' + secret) {
    return Response.json({ ok: false, error: 'Unauthorized' }, {
      status: 401,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  try {
    const data = await runDispatchWorkQueue(32, 22_000);
    const healthy = data.failed === 0 && data.completionErrors === 0;
    return Response.json({ ok: healthy, ...data }, {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json({ ok: false, error: 'Dispatch queue worker unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
