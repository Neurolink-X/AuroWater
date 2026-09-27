import { getSupabaseClient } from '@/lib/supabase/client';

/** Singleton browser client — do not create one per render. */
export const createClient = () => getSupabaseClient();
