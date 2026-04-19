import { NextRequest, NextResponse } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { createSupabaseAnonClient, isSupabaseConfigured } from '@/lib/db/supabase';

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return jsonErr('Contact form is temporarily unavailable', 503);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

  if (!name || !email || !message) {
    return jsonErr('name, email, and message are required', 400);
  }

  const sb = createSupabaseAnonClient();
  const { error } = await sb.from('contact_submissions').insert({
    name,
    email,
    message,
    phone: phone || null,
  });

  if (error) {
    return jsonErr(error.message, 500);
  }

  return jsonOk({ received: true as const }, 201);
}
