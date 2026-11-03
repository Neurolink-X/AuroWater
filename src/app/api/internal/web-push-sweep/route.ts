import { NextRequest } from 'next/server';
import { processDueWebPush } from '@/lib/web-push-worker';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.get('authorization') !== `Bearer ${expected}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, {
      status: 401, headers: { 'Cache-Control': 'no-store' },
    });
  }
  try {
    const result = await processDueWebPush(8);
    return Response.json({ ok: true, ...result }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json({ ok: false, error: 'Push delivery sweep failed' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
