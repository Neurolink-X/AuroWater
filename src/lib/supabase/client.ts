import { createBrowserClient } from '@supabase/ssr';
import { CANONICAL_SUPABASE_REF } from '@/lib/env';

let client: ReturnType<typeof createBrowserClient> | null = null;

function publicUrl(): string {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
  if (url.includes('nozizhfliljitspkgjix')) {
    url = `https://${CANONICAL_SUPABASE_REF}.supabase.co`;
  }
  return url;
}

export function getSupabaseClient() {
  if (!client) {
    const url = publicUrl();
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or anon/publishable key');
    }
    client = createBrowserClient(url, key);
  }
  return client;
}

export const createClient = getSupabaseClient;
