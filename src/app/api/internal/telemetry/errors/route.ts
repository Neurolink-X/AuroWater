import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/utils/supabase/server';
import { consumeRateLimit } from '@/lib/api/rate-limit';
import { validatePlatformEvent } from '@/lib/observability/platform-errors';
import { recordPlatformError } from '@/lib/observability/platform-errors.server';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  const origin = new URL(req.url).origin;
  if (req.headers.get('origin') !== origin || (req.headers.get('sec-fetch-site') && req.headers.get('sec-fetch-site') !== 'same-origin')) return new NextResponse(null, {status:403});
  if (Number(req.headers.get('content-length') ?? 0) > 1024) return new NextResponse(null, {status:413});
  let event;
  try { const raw = await req.text(); if (raw.length > 1024) return new NextResponse(null,{status:413}); event = validatePlatformEvent(JSON.parse(raw)); } catch { return new NextResponse(null,{status:400}); }
  if (!event || event.source !== 'browser') return new NextResponse(null,{status:400});
  try {
    const ip = req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rate = await consumeRateLimit(createServiceClient(), 'platform-errors', ip, 15, 60);
    if (!rate.allowed) return new NextResponse(null,{status:rate.unavailable?503:429});
    const stored = await recordPlatformError(event);
    return new NextResponse(null,{status:stored?204:503,headers:{'Cache-Control':'no-store'}});
  } catch { return new NextResponse(null,{status:503}); }
}
