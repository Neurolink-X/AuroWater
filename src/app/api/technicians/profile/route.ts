import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/connection';
import { withAuth } from '@/lib/auth/middleware';
import { errorResponse, successResponse } from '@/lib/utils/helpers';
import { Technician } from '@/types';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req, user) => {
    try {
      const technician = await queryOne<Technician>(
        'SELECT * FROM technicians WHERE user_id = $1',
        [user.id]
      );

      if (!technician) {
        return NextResponse.json(errorResponse('Technician profile not found'), { status: 404 });
      }

      return NextResponse.json(successResponse(technician), { status: 200 });
    } catch (error: any) {
      console.error('Get technician profile error:', error);
      return NextResponse.json(
        errorResponse(error.message || 'Failed to fetch profile'),
        { status: 500 }
      );
    }
  }, 'TECHNICIAN');
}

export async function PUT(req: NextRequest) {
  return withAuth(req, async (req, user) => {
    try {
      const {
        specialization,
        license_number,
        experience_years,
        current_zone_id,
        current_lat,
        current_lng,
        is_available,
      } = await req.json();

      const technician = await queryOne<Technician>(
        `UPDATE technicians 
         SET specialization = COALESCE($1, specialization),
             license_number = COALESCE($2, license_number),
             experience_years = COALESCE($3, experience_years),
             current_zone_id = COALESCE($4, current_zone_id),
             current_lat = COALESCE($5, current_lat),
             current_lng = COALESCE($6, current_lng),
             is_available = COALESCE($7, is_available),
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $8
         RETURNING *`,
        [
          specialization || null,
          license_number || null,
          experience_years || null,
          current_zone_id || null,
          current_lat || null,
          current_lng || null,
          is_available !== undefined ? is_available : null,
          user.id,
        ]
      );

      return NextResponse.json(
        successResponse(technician, 'Profile updated successfully'),
        { status: 200 }
      );
    } catch (error: any) {
      console.error('Update technician profile error:', error);
      return NextResponse.json(
        errorResponse(error.message || 'Failed to update profile'),
        { status: 500 }
      );
    }
  }, 'TECHNICIAN');
}
