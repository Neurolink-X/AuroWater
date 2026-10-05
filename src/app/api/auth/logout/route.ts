import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase =
      await createServerSupabaseClient();

    const { error } =
      await supabase.auth.signOut();

    /*
     * Even if Supabase reports that the
     * session is already invalid/expired,
     * logout should remain idempotent.
     */
    if (error) {
      console.error(
        '[auth/logout]',
        error.message,
      );
    }

    return jsonOk({
      ok: true as const,
    });
  } catch (error) {
    console.error(
      '[auth/logout] unexpected error:',
      error,
    );

    /*
     * Logout is intentionally idempotent.
     * The client should consider itself logged out
     * even when the server session is already gone.
     */
    return jsonOk({
      ok: true as const,
    });
  }
}
