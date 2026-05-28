import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      return jsonErr(error.message, 400);
    }
    return jsonOk({ ok: true as const });
  } catch {
    return jsonOk({ ok: true as const });
  }
}
