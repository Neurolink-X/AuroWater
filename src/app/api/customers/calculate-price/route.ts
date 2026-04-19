import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { ok: false, error: 'Deprecated. Use /api/customer/* or /api/admin/orders/*.' },
    { status: 410 }
  );
}
