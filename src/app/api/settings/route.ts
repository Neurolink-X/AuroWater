import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query } from '@/lib/db/connection';
import { errorResponse, successResponse } from '@/lib/utils/helpers';

// Public settings for Contact/About pages.
export async function GET(_req: NextRequest) {
  try {
    let row = await queryOne(
      'SELECT support_email, secondary_email, phone_primary, phone_secondary, office_address, working_hours FROM app_settings ORDER BY updated_at DESC LIMIT 1'
    );

    if (!row) {
      // Seed with default contact values if nothing exists yet.
      await query(
        `INSERT INTO app_settings (support_email, secondary_email, phone_primary, office_address, working_hours)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'support.aurotap@gmail.com',
          null,
          '9889305803',
          'Auro Water / AuroTap',
          '09:00–21:00 IST',
        ]
      );
      row = await queryOne(
        'SELECT support_email, secondary_email, phone_primary, phone_secondary, office_address, working_hours FROM app_settings ORDER BY updated_at DESC LIMIT 1'
      );
    }

    return NextResponse.json(successResponse(row || null), { status: 200 });
  } catch (error: any) {
    return NextResponse.json(errorResponse(error.message || 'Failed to fetch settings'), { status: 500 });
  }
}

