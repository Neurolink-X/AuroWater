import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

/**
 * GET  payout history for the signed-in supplier (their own payouts only).
 *
 * Query params (all optional)
 *   limit   page size, 1–100, default 20
 *   offset  rows to skip, 0–10000, default 0
 *
 * Response 200: array of
 *   { id, amount, method, status, requested_at, paid_at, destination }
 *   - status: 'paid' once paid_at is set, otherwise the status stored with the request (default 'pending')
 *   - destination: MASKED (ab•••@bank or ••••1234). Full UPI/bank details never leave the server.
 *
 * Other responses: 400 bad paging · 403 not a supplier · 500 failure (logged, never leaked)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_OFFSET = 10_000;

/** `notes` holds JSON like {"status":"pending", ...details}. Never throws. */
function parseNotes(notes: unknown): Record<string, unknown> {
  if (notes && typeof notes === 'object') return notes as Record<string, unknown>;
  if (typeof notes !== 'string') return {};
  try {
    const v = JSON.parse(notes) as unknown;
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const maskUpi = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v : '';
  const [name = '', bank = ''] = s.split('@');
  return name ? `${name.slice(0, 2)}${'•'.repeat(Math.max(name.length - 2, 2))}@${bank}` : null;
};
const maskAccount = (v: unknown): string | null =>
  typeof v === 'string' && v.length >= 4 ? `••••${v.slice(-4)}` : null;

/** Parses an optional integer query param; returns null when present but invalid. */
function intParam(raw: string | null, fallback: number, min: number, max: number): number | null {
  if (raw === null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

export async function GET(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (!requireRole(auth.ctx, 'supplier')) return jsonErr('Forbidden', 403);

  const params = new URL(req.url).searchParams;
  const limit = intParam(params.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = intParam(params.get('offset'), 0, 0, MAX_OFFSET);
  if (limit === null) return jsonErr(`limit must be a whole number from 1 to ${MAX_LIMIT}.`, 400);
  if (offset === null) return jsonErr(`offset must be a whole number from 0 to ${MAX_OFFSET}.`, 400);

  try {
    const { data, error } = await auth.ctx.supabase
      .from('payouts')
      .select('*')
      .eq('supplier_id', auth.ctx.profile.id)
      // Open requests (paid_at is null) first, then newest paid. `id` breaks ties so pages never overlap or skip rows.
      .order('paid_at', { ascending: false, nullsFirst: true })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[supplier/earnings/history] list failed', error.message);
      return jsonErr('Could not load your payout history. Please try again.', 500);
    }

    return jsonOk(
      ((data ?? []) as Record<string, unknown>[]).map((r) => {
        const notes = parseNotes(r.notes);
        return {
          id: r.id,
          amount: r.amount,
          method: r.method,
          status: r.paid_at ? 'paid' : String(notes.status ?? 'pending'),
          requested_at: r.created_at ?? null,
          paid_at: r.paid_at ?? null,
          destination: r.method === 'upi' ? maskUpi(notes.upi_id ?? r.reference) : maskAccount(notes.bank_account),
        };
      }),
    );
  } catch (err) {
    console.error('[supplier/earnings/history] unexpected failure', err instanceof Error ? err.message : err);
    return jsonErr('Could not load your payout history. Please try again.', 500);
  }
}
