import { jsonOk } from '@/lib/api/json-response';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase.auth.signOut();

    /*
     * Logout is idempotent.
     *
     * If the session is already expired or missing, the user
     * should still be considered logged out.
     */
    if (error) {
      console.error(
        '[auth/logout] Supabase signOut failed:',
        error.message,
      );
    }

    return jsonOk({
      ok: true as const,
    });
  } catch (error) {
    /*
     * Never expose internal authentication/server errors
     * to the client.
     *
     * Logout remains successful from the client's perspective.
     */
    console.error(
      '[auth/logout] unexpected error:',
      error instanceof Error ? error.message : 'Unknown error',
    );

    return jsonOk({
      ok: true as const,
    });
  }
}









// import { jsonErr, jsonOk } from '@/lib/api/json-response';
// import { createServerSupabaseClient } from '@/lib/supabase/server';

// export async function POST() {
//   try {
//     const supabase =
//       await createServerSupabaseClient();

//     const { error } =
//       await supabase.auth.signOut();

//     /*
//      * Even if Supabase reports that the
//      * session is already invalid/expired,
//      * logout should remain idempotent.
//      */
//     if (error) {
//       console.error(
//         '[auth/logout]',
//         error.message,
//       );
//     }

//     return jsonOk({
//       ok: true as const,
//     });
//   } catch (error) {
//     console.error(
//       '[auth/logout] unexpected error:',
//       error,
//     );

//     /*
//      * Logout is intentionally idempotent.
//      * The client should consider itself logged out
//      * even when the server session is already gone.
//      */
//     return jsonOk({
//       ok: true as const,
//     });
//   }
// }
