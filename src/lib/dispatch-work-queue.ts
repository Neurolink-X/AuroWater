import 'server-only';
import { createServiceClient } from '@/utils/supabase/server';
import { dispatchOrder, dispatchTechnicianJob } from '@/lib/dispatch';

type QueueClaim = {
  order_id: string;
  lane: 'water' | 'specialist';
  claim_token: string;
  attempt_count: number;
};

type WorkResult = {
  claimed: number;
  assigned: number;
  delayed: number;
  failed: number;
  completionErrors: number;
  durationMs: number;
};

/**
 * Backlog worker, not a replacement for the synchronous booking response.
 *
 * DB claim is a short transaction with a GLOBAL concurrency budget;
 * no HTTP request or supplier scoring occurs while holding SQL locks.
 * All assignment safety remains in existing stock/job RPCs.
 */
export async function runDispatchWorkQueue(
  maxItems = 8,
  budgetMs = 22_000,
): Promise<WorkResult> {
  const start = Date.now();
  const db = createServiceClient();

  const { data, error } = await db.rpc('claim_dispatch_work', {
    p_limit: Math.max(1, Math.min(8, maxItems)),
    p_lease_seconds: 90,
  });
  if (error) throw new Error('Dispatch queue claim failed: ' + error.code);

  const rows = (data ?? []) as QueueClaim[];
  let assigned = 0;
  let delayed = 0;
  let failed = 0;
  let completionErrors = 0;

  async function processOne(job: QueueClaim) {
    let outcome = 'error';
    try {
      // A leased item can become completed/cancelled before this call.
      // dispatchOrder/dispatchTechnicianJob recheck the authoritative order
      // and their atomic acceptance/stock guards resolve concurrency races.
      const result = job.lane === 'water'
        ? await dispatchOrder(job.order_id)
        : await dispatchTechnicianJob(job.order_id);
      const recipientId = 'supplierId' in result ? result.supplierId : result.technicianId;
      if (recipientId) {
        assigned += 1;
        outcome = 'assigned';
      } else {
        outcome = typeof result.reason === 'string'
          ? result.reason.slice(0, 64) : 'not_assigned';
        delayed += 1;
      }
    } catch (cause) {
      failed += 1;
      console.error('[dispatch-queue] worker failed', {
        code: cause instanceof Error ? cause.name : 'UNKNOWN',
      });
    } finally {
      // The token prevents a worker whose lease expired from overwriting a
      // newer worker's result. Unfinished jobs are retried after lease expiry.
      const { data: finished, error: finishError } = await db.rpc(
        'finish_dispatch_work', {
          p_order_id: job.order_id,
          p_claim_token: job.claim_token,
          p_result_code: outcome,
        },
      );
      if (finishError || finished !== true) {
        completionErrors += 1;
        console.error('[dispatch-queue] ack rejected', {
          code: finishError?.code ?? 'LEASE_EXPIRED',
        });
      }
    }
  }

  // Each function has its own small concurrency cap; the RPC also enforces a
  // GLOBAL cap across all Vercel function instances to protect Supabase.
  for (let i = 0; i < rows.length; i += 3) {
    if (Date.now() - start > budgetMs - 1500) break;
    await Promise.allSettled(rows.slice(i, i + 3).map(processOne));
  }
  return {
    claimed: rows.length,
    assigned,
    delayed,
    failed,
    completionErrors,
    durationMs: Date.now() - start,
  };
}
