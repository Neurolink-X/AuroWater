import { jsonOk } from '@/lib/api/json-response';

/** Client clears tokens; this endpoint exists for symmetry and future server-side revoke. */
export async function POST() {
  return jsonOk({ ok: true as const });
}
