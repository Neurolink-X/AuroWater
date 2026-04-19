import { NextResponse } from 'next/server';

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true as const, data }, { status });
}

/** Optional `code` is used by clients (e.g. DB_NOT_READY for Supabase migrations). */
export function jsonErr(message: string, status = 400, code?: string): NextResponse {
  const body: { success: false; error: string; code?: string } = {
    success: false as const,
    error: message,
  };
  if (code) body.code = code;
  return NextResponse.json(body, { status });
}
