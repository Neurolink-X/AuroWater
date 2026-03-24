import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/connection';
import { errorResponse, successResponse } from '@/lib/utils/helpers';

export async function GET(req: NextRequest) {
  try {
    const services = await query(
      'SELECT * FROM service_types WHERE is_active = true ORDER BY created_at ASC'
    );

    return NextResponse.json(successResponse(services), { status: 200 });
  } catch (error: any) {
    console.error('Get services error:', error);
    return NextResponse.json(errorResponse(error.message || 'Failed to fetch services'), {
      status: 500,
    });
  }
}
