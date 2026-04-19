import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { createSupabaseAnonClient, isSupabaseConfigured } from '@/lib/db/supabase';

/** Resend signup confirmation email (rate-limited by Supabase). */
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return jsonErr('Supabase is not configured on the server', 503, 'MISCONFIG_ENV');
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonErr('Valid email is required', 400);
  }

  const sb = createSupabaseAnonClient();
  const { error } = await sb.auth.resend({ type: 'signup', email });

  if (error) {
    return jsonErr(error.message || 'Could not resend email', 400);
  }

  return jsonOk({ sent: true as const });
}
