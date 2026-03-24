import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';
import { errorResponse, successResponse } from '@/lib/utils/helpers';

// Public services endpoint (no auth) for browsing + booking wizard.
export async function GET(_req: NextRequest) {
  try {
    const services = await query(
      'SELECT * FROM service_types WHERE is_active = true ORDER BY created_at ASC'
    );
    return NextResponse.json(successResponse(services), { status: 200 });
  } catch (error: any) {
    console.error('Get services error:', error);
    // Marketing site must never hard-fail. If DB isn't ready (or table missing),
    // return an empty list with a readable message.
    const msg = error?.message || 'Failed to fetch services';
    return NextResponse.json(
      successResponse([], msg),
      { status: 200 }
    );
  }
}

