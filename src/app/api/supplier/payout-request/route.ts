import { NextResponse } from 'next/server';

/**
 * RETIRED: /api/supplier/payout-request
 * Payout requests now go to POST /api/supplier/payouts, which validates and stores them.
 * Delete this whole folder once nothing calls it.
 */

export const dynamic = 'force-dynamic';

function gone() {
  return NextResponse.json(
    { error: 'This endpoint has moved. Use /api/supplier/payouts.' },
    {
      status: 410,
      headers: {
        'Cache-Control': 'no-store',
        Link: '</api/supplier/payouts>; rel="successor-version"',
      },
    },
  );
}

export const GET = gone;
export const POST = gone;
