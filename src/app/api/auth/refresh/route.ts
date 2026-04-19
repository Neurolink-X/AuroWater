import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { createSupabaseAnonClient, isSupabaseConfigured } from '@/lib/db/supabase';

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return jsonErr('Supabase is not configured on the server', 503);
  }

  let body: { refresh_token?: string };
  try {
    body = (await req.json()) as { refresh_token?: string };
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const refresh_token = typeof body.refresh_token === 'string' ? body.refresh_token : '';
  if (!refresh_token) {
    return jsonErr('refresh_token is required', 400);
  }

  const sb = createSupabaseAnonClient();
  const { data, error } = await sb.auth.refreshSession({ refresh_token });

  if (error || !data.session?.access_token) {
    return jsonErr(error?.message ?? 'Refresh failed', 401);
  }

  return jsonOk({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at ?? null,
  });
}
