import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseClient } from '@/lib/supabase/client';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Singleton browser client — do not create one per render. */
export const createClient = () => {
  try {
    return getSupabaseClient();
  } catch {
    return createBrowserClient(url, key);
  }
};
