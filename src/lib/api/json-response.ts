import { NextResponse } from 'next/server';

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data, message: 'Success' }, { status });
}

/** Optional `code` is used by clients (e.g. DB_NOT_READY for Supabase migrations). */
export function jsonErr(message: string, status = 400, code?: string): NextResponse {
  const body: { error: string; details?: { code: string } } = {
    error: message,
  };
  if (code) body.details = { code };
  return NextResponse.json(body, { status });
}
