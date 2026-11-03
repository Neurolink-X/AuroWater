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
  maxItems = 32,
  budgetMs = 22_000,
): Promise<WorkResult> {
  const start = Date.now();
  const db = createServiceClient();
  const cap = Math.max(1, Math.min(32, maxItems));
  let claimed = 0;
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
      try {
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
      } catch {
        completionErrors += 1;
        // Safe failure: the visibility lease expires and another worker
        // rechecks canonical order state. No speculative state mutation.
        console.error('[dispatch-queue] ack transport unavailable');
      }
    }
  }

  // Claim ONLY a batch that we can immediately process. No unstarted jobs
  // are left on a 90-second lease when the function reaches its time budget.
  // This opportunistically drains up to 32 items per serverless invocation,
  // and remains limited to three concurrent dispatch requests per instance.
  while (claimed < cap && Date.now() - start < budgetMs - 9_000) {
    const { data, error } = await db.rpc('claim_dispatch_work', {
      p_limit: Math.min(3, cap - claimed),
      p_lease_seconds: 90,
    });
    if (error) throw new Error('Dispatch queue claim failed: ' + error.code);
    const jobs = (data ?? []) as QueueClaim[];
    if (!jobs.length) break;
    claimed += jobs.length;
    const completed = await Promise.allSettled(jobs.map(processOne));
    for (const result of completed) {
      if (result.status === 'rejected') {
        failed += 1;
        console.error('[dispatch-queue] unhandled job promise rejected');
      }
    }
  }
  return {
    claimed,
    assigned,
    delayed,
    failed,
    completionErrors,
    durationMs: Date.now() - start,
  };
}
