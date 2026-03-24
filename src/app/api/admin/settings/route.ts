import { NextRequest, NextResponse } from 'next/server';
import { queryOne, transaction } from '@/lib/db/connection';
import { withAuth } from '@/lib/auth/middleware';
import { errorResponse, successResponse } from '@/lib/utils/helpers';

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const row = await queryOne(
        'SELECT * FROM app_settings ORDER BY updated_at DESC LIMIT 1'
      );
      return NextResponse.json(successResponse(row || null), { status: 200 });
    } catch (error: any) {
      return NextResponse.json(errorResponse(error.message || 'Failed to fetch settings'), { status: 500 });
    }
  }, 'ADMIN');
}

export async function PUT(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const {
        support_email,
        secondary_email,
        phone_primary,
        phone_secondary,
        office_address,
        working_hours,
      } = await req.json();

      const saved = await transaction(async (client) => {
        // Keep a single latest row; update if exists, else insert.
        const existing = await client.query('SELECT id FROM app_settings ORDER BY updated_at DESC LIMIT 1');
        if (existing.rows.length > 0) {
          const id = existing.rows[0].id;
          const res = await client.query(
            `UPDATE app_settings
             SET support_email = COALESCE($1, support_email),
                 secondary_email = COALESCE($2, secondary_email),
                 phone_primary = COALESCE($3, phone_primary),
                 phone_secondary = COALESCE($4, phone_secondary),
                 office_address = COALESCE($5, office_address),
                 working_hours = COALESCE($6, working_hours),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $7
             RETURNING *`,
            [
              support_email || null,
              secondary_email || null,
              phone_primary || null,
              phone_secondary || null,
              office_address || null,
              working_hours || null,
              id,
            ]
          );
          return res.rows[0];
        }

        const res = await client.query(
          `INSERT INTO app_settings (support_email, secondary_email, phone_primary, phone_secondary, office_address, working_hours)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            support_email || null,
            secondary_email || null,
            phone_primary || null,
            phone_secondary || null,
            office_address || null,
            working_hours || null,
          ]
        );
        return res.rows[0];
      });

      return NextResponse.json(successResponse(saved, 'Settings saved'), { status: 200 });
    } catch (error: any) {
      return NextResponse.json(errorResponse(error.message || 'Failed to save settings'), { status: 500 });
    }
  }, 'ADMIN');
}

