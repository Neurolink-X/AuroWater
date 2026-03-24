import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/connection';
import { withAuth } from '@/lib/auth/middleware';
import { errorResponse, successResponse } from '@/lib/utils/helpers';

export async function GET(req: NextRequest) {
  return withAuth(
    req,
    async (req, user) => {
      try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');

        let query_str =
          `SELECT o.*, u.full_name as customer_name, u.phone as customer_phone,
                  st.name as service_name, t.user_id as technician_id
           FROM orders o
           LEFT JOIN users u ON o.customer_id = u.id
           LEFT JOIN service_types st ON o.service_type_id = st.id
           LEFT JOIN technicians t ON o.technician_id = t.id
           WHERE 1=1`;
        const params: any[] = [];

        if (status) {
          query_str += ` AND o.status = $${params.length + 1}`;
          params.push(status);
        }

        query_str += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit);
        params.push(offset);

        const orders = await query(query_str, params);

        return NextResponse.json(successResponse(orders), { status: 200 });
      } catch (error: any) {
        console.error('Get orders error:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch orders'), {
          status: 500,
        });
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
        const { order_id, technician_id, action, notes } = await req.json();

        if (!order_id) {
          return NextResponse.json(errorResponse('order_id is required'), { status: 400 });
        }

        if (action === 'assign' && !technician_id) {
          return NextResponse.json(errorResponse('technician_id is required for assign'), {
            status: 400,
          });
        }

        const order = await queryOne('SELECT * FROM orders WHERE id = $1', [order_id]);

        if (!order) {
          return NextResponse.json(errorResponse('Order not found'), { status: 404 });
        }

        if (action === 'assign') {
          // Assign technician
          const technician = await queryOne(
            'SELECT id FROM technicians WHERE id = $1',
            [technician_id]
          );

          if (!technician) {
            return NextResponse.json(errorResponse('Technician not found'), { status: 404 });
          }

          // Update order
          await query(
            'UPDATE orders SET technician_id = $1, status = \'ASSIGNED\', updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [technician_id, order_id]
          );

          // Create job
          await query(
            `INSERT INTO jobs (order_id, technician_id, status)
             VALUES ($1, $2, 'PENDING')
             ON CONFLICT DO NOTHING`,
            [order_id, technician_id]
          );

          // Create notification for technician
          const techUser = await queryOne('SELECT user_id FROM technicians WHERE id = $1', [
            technician_id,
          ]);

          if (techUser) {
            await query(
              `INSERT INTO notifications (user_id, title, message, type, related_id)
               VALUES ($1, 'New Job Assigned', 'You have been assigned a new job', 'JOB', $2)`,
              [techUser.user_id, order_id]
            );
          }
        }

        const updatedOrder = await queryOne('SELECT * FROM orders WHERE id = $1', [order_id]);

        return NextResponse.json(
          successResponse(updatedOrder, 'Order updated successfully'),
          { status: 200 }
        );
      } catch (error: any) {
        console.error('Update order error:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to update order'), {
          status: 500,
        });
      }
    },
    'ADMIN'
  );
}
