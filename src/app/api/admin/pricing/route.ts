import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/connection';
import { withAuth } from '@/lib/auth/middleware';
import { errorResponse, successResponse } from '@/lib/utils/helpers';

export async function GET(req: NextRequest) {
  return withAuth(
    req,
    async (req, user) => {
      try {
        const rules = await query(
          `SELECT pr.*, st.name as service_name, z.name as zone_name
           FROM pricing_rules pr
           LEFT JOIN service_types st ON pr.service_type_id = st.id
           LEFT JOIN zones z ON pr.zone_id = z.id
           ORDER BY pr.created_at DESC`
        );

        return NextResponse.json(successResponse(rules), { status: 200 });
      } catch (error: any) {
        console.error('Get pricing rules error:', error);
        return NextResponse.json(
          errorResponse(error.message || 'Failed to fetch pricing rules'),
          { status: 500 }
        );
      }
    },
    'ADMIN'
  );
}

export async function POST(req: NextRequest) {
  return withAuth(
    req,
    async (req, user) => {
      try {
        const {
          service_type_id,
          zone_id,
          base_price,
          distance_multiplier,
          tax_percentage,
          min_order_value,
          emergency_charge,
        } = await req.json();

        if (!service_type_id || base_price === undefined) {
          return NextResponse.json(
            errorResponse('service_type_id and base_price are required'),
            { status: 400 }
          );
        }

        const rule = await queryOne(
          `INSERT INTO pricing_rules (service_type_id, zone_id, base_price, distance_multiplier, tax_percentage, min_order_value, emergency_charge)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            service_type_id,
            zone_id || null,
            base_price,
            distance_multiplier || 1.0,
            tax_percentage || 0,
            min_order_value || 0,
            emergency_charge || 0,
          ]
        );

        return NextResponse.json(successResponse(rule, 'Pricing rule created'), { status: 201 });
      } catch (error: any) {
        console.error('Create pricing rule error:', error);
        return NextResponse.json(
          errorResponse(error.message || 'Failed to create pricing rule'),
          { status: 500 }
        );
      }
    },
    'ADMIN'
  );
}

export async function PUT(req: NextRequest) {
  return withAuth(
    req,
    async (req, user) => {
      try {
        const {
          id,
          base_price,
          distance_multiplier,
          tax_percentage,
          min_order_value,
          emergency_charge,
        } = await req.json();

        if (!id) {
          return NextResponse.json(errorResponse('id is required'), { status: 400 });
        }

        const rule = await queryOne(
          `UPDATE pricing_rules 
           SET base_price = COALESCE($1, base_price),
               distance_multiplier = COALESCE($2, distance_multiplier),
               tax_percentage = COALESCE($3, tax_percentage),
               min_order_value = COALESCE($4, min_order_value),
               emergency_charge = COALESCE($5, emergency_charge),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $6
           RETURNING *`,
          [base_price || null, distance_multiplier || null, tax_percentage || null, min_order_value || null, emergency_charge || null, id]
        );

        if (!rule) {
          return NextResponse.json(errorResponse('Pricing rule not found'), { status: 404 });
        }

        return NextResponse.json(
          successResponse(rule, 'Pricing rule updated'),
          { status: 200 }
        );
      } catch (error: any) {
        console.error('Update pricing rule error:', error);
        return NextResponse.json(
          errorResponse(error.message || 'Failed to update pricing rule'),
          { status: 500 }
        );
      }
    },
    'ADMIN'
  );
}
