import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/connection';
import { withAuth } from '@/lib/auth/middleware';
import { errorResponse, successResponse } from '@/lib/utils/helpers';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  return withAuth(req, async (req, user) => {
    try {
      const orderId = resolvedParams.id;

      // Get order with status history
      const order = await queryOne(
        `SELECT o.*, st.name as service_name, a.house_no, a.area, a.city
         FROM orders o
         LEFT JOIN service_types st ON o.service_type_id = st.id
         LEFT JOIN addresses a ON o.address_id = a.id
         WHERE o.id = $1 AND o.customer_id = $2`,
        [orderId, user.id]
      );

      if (!order) {
        return NextResponse.json(errorResponse('Order not found'), { status: 404 });
      }

      // Get status history
      const history = await query(
        `SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY created_at ASC`,
        [orderId]
      );

      // Get assigned job if exists
      const job = await queryOne(
        `SELECT j.*, u.full_name as technician_name, u.phone as technician_phone
         FROM jobs j
         LEFT JOIN users u ON j.technician_id = u.id
         WHERE j.order_id = $1`,
        [orderId]
      );

      return NextResponse.json(
        successResponse({
          order,
          history,
          job,
        }),
        { status: 200 }
      );
    } catch (error: any) {
      console.error('Get order error:', error);
      return NextResponse.json(errorResponse(error.message || 'Failed to fetch order'), {
        status: 500,
      });
    }
  }, 'CUSTOMER');
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  return withAuth(req, async (req, user) => {
    try {
      const orderId = resolvedParams.id;
      const { action, notes } = await req.json();

      // Verify order belongs to customer
      const order = await queryOne(
        'SELECT id, status FROM orders WHERE id = $1 AND customer_id = $2',
        [orderId, user.id]
      );

      if (!order) {
        return NextResponse.json(errorResponse('Order not found'), { status: 404 });
      }

      let new_status = order.status;

      if (action === 'cancel') {
        if (!['PENDING', 'ASSIGNED'].includes(order.status)) {
          return NextResponse.json(
            errorResponse('Cannot cancel order in current status'),
            { status: 400 }
          );
        }
        new_status = 'CANCELLED';
      }

      if (new_status !== order.status) {
        await query(
          `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [new_status, orderId]
        );

        await query(
          `INSERT INTO order_status_history (order_id, status, updated_by, notes)
           VALUES ($1, $2, $3, $4)`,
          [orderId, new_status, user.id, notes || null]
        );
      }

      const updatedOrder = await queryOne('SELECT * FROM orders WHERE id = $1', [orderId]);

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
  }, 'CUSTOMER');
}
