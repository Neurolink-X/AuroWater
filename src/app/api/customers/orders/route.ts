import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, transaction } from '@/lib/db/connection';
import { withAuth } from '@/lib/auth/middleware';
import { errorResponse, successResponse } from '@/lib/utils/helpers';
import { Order, Address } from '@/types';
import { calculatePrice } from '@/lib/pricing/engine';

export async function POST(req: NextRequest) {
  return withAuth(req, async (req, user) => {
    try {
      const {
        address_id,
        service_type_id,
        service_details,
        time_slot,
        scheduled_time,
        is_emergency,
      } = await req.json();

      if (!address_id || !service_type_id) {
        return NextResponse.json(
          errorResponse('address_id and service_type_id are required'),
          { status: 400 }
        );
      }

      // Verify address belongs to customer
      const address = await queryOne<Address>(
        'SELECT * FROM addresses WHERE id = $1 AND user_id = $2',
        [address_id, user.id]
      );

      if (!address) {
        return NextResponse.json(errorResponse('Address not found'), { status: 404 });
      }

      // Get service type
      const serviceType = await queryOne(
        'SELECT id, base_price FROM service_types WHERE id = $1 AND is_active = true',
        [service_type_id]
      );

      if (!serviceType) {
        return NextResponse.json(errorResponse('Service type not found'), { status: 404 });
      }

      // Calculate pricing
      const pricing = await calculatePrice({
        service_type_id,
        zone_id: undefined,
        quantity: service_details?.quantity || 500,
        customer_lat: address.lat || 28.7041,
        customer_lng: address.lng || 77.1025,
        is_emergency,
      });

      // Create order in transaction
      const order = await transaction(async (client) => {
        const newOrder = await client.query<Order>(
          `INSERT INTO orders (
            customer_id, address_id, service_type_id, service_details,
            base_price, distance_factor, subtotal, tax_amount, emergency_charge, total_amount,
            time_slot, scheduled_time, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PENDING')
          RETURNING *`,
          [
            user.id,
            address_id,
            service_type_id,
            service_details ? JSON.stringify(service_details) : null,
            pricing.base_price,
            pricing.distance_factor,
            pricing.subtotal,
            pricing.tax_amount,
            pricing.emergency_charge,
            pricing.total_amount,
            time_slot || null,
            scheduled_time || null,
          ]
        );

        // Create initial status history
        await client.query(
          `INSERT INTO order_status_history (order_id, status, updated_by, notes)
           VALUES ($1, 'PENDING', $2, 'Order created')`,
          [newOrder.rows[0].id, user.id]
        );

        // Create notification
        await client.query(
          `INSERT INTO notifications (user_id, title, message, type, related_id)
           VALUES ($1, 'Order Placed', 'Your water order has been placed', 'ORDER', $2)`,
          [user.id, newOrder.rows[0].id]
        );

        return newOrder.rows[0];
      });

      return NextResponse.json(
        successResponse(
          {
            ...order,
            pricing,
          },
          'Order created successfully'
        ),
        { status: 201 }
      );
    } catch (error: any) {
      console.error('Create order error:', error);
      return NextResponse.json(errorResponse(error.message || 'Failed to create order'), {
        status: 500,
      });
    }
  }, 'CUSTOMER');
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (req, user) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get('status');
      const limit = parseInt(searchParams.get('limit') || '10');
      const offset = parseInt(searchParams.get('offset') || '0');

      let query_str = 'SELECT o.*, st.name as service_name FROM orders o LEFT JOIN service_types st ON o.service_type_id = st.id WHERE o.customer_id = $1';
      const params: any[] = [user.id];

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
  }, 'CUSTOMER');
}
