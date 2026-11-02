import { NextRequest } from 'next/server';
import { PUT as updateCanonicalSupplierOrder } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Compatibility entrypoint for older supplier clients.
 * Both routes MUST share the canonical atomic completion flow; previous code
 * directly updated orders/payment_status and bypassed the financial ledger.
 * The canonical route checks supplier ownership, transition, verified payment
 * evidence and calls complete_supplier_order_atomic transactionally.
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return updateCanonicalSupplierOrder(req, ctx);
}
