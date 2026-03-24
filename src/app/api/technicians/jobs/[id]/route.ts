import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db/connection';
import { withAuth } from '@/lib/auth/middleware';
import { errorResponse, successResponse } from '@/lib/utils/helpers';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (_, user) => {
    try {
      const { id } = await params;
      const jobId = parseInt(id, 10);
      if (!Number.isFinite(jobId)) {
        return NextResponse.json(errorResponse('Invalid job ID'), { status: 400 });
      }

      const technician = await queryOne(
        'SELECT id FROM technicians WHERE user_id = $1',
        [user.id]
      );
      if (!technician) {
        return NextResponse.json(errorResponse('Technician profile not found'), { status: 404 });
      }

      const job = await queryOne(
        `SELECT j.*, o.id as order_id, o.total_amount, o.time_slot, o.scheduled_time, o.service_details,
                st.name as service_name, a.house_no, a.area, a.city, a.landmark, a.lat, a.lng,
                cu.full_name as customer_name, cu.phone as customer_phone
         FROM jobs j
         JOIN orders o ON j.order_id = o.id
         JOIN service_types st ON o.service_type_id = st.id
         JOIN addresses a ON o.address_id = a.id
         JOIN users cu ON o.customer_id = cu.id
         WHERE j.id = $1 AND j.technician_id = $2`,
        [jobId, technician.id]
      );

      if (!job) {
        return NextResponse.json(errorResponse('Job not found'), { status: 404 });
      }

      return NextResponse.json(successResponse(job), { status: 200 });
    } catch (error: unknown) {
      console.error('Get job error:', error);
      return NextResponse.json(
        errorResponse(error instanceof Error ? error.message : 'Failed to fetch job'),
        { status: 500 }
      );
    }
  }, 'TECHNICIAN');
}
