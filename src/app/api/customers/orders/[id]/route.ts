import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { ok: false, error: 'Deprecated. Use /api/customer/* or /api/admin/orders/*.' },
    { status: 410 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { ok: false, error: 'Deprecated. Use /api/customer/* or /api/admin/orders/*.' },
    { status: 410 }
  );
}
