import { NextRequest, NextResponse } from 'next/server';
import { queryOne, transaction } from '@/lib/db/connection';
import { withAuth } from '@/lib/auth/middleware';
import { errorResponse, successResponse } from '@/lib/utils/helpers';
import { validateTimeSlot } from '@/lib/validation/time-slot';
import { calculatePrice } from '@/lib/pricing/engine';
import type { Address, Order } from '@/types';

export async function POST(req: NextRequest) {
  return withAuth(req, async (req, user) => {
    try {
      const body = await req.json();
      const {
        address_id,
        service_type_id,
        service_details,
        quantity = 500,
        emergency = false,
        start_time,
        end_time,
        date,
        time_slot,
        scheduled_time,
      } = body;

      if (!address_id || !service_type_id) {
        return NextResponse.json(
          errorResponse('address_id and service_type_id are required'),
          { status: 400 }
        );
      }

      const slotResult = validateTimeSlot({
        start_time: start_time ?? body.startTime,
        end_time: end_time ?? body.endTime,
        date: date ?? body.date,
        time_slot,
        scheduled_time,
      });

      if (!slotResult.valid) {
        return NextResponse.json(
          { success: false, error: 'Invalid time slot', errors: slotResult.errors },
          { status: 400 }
        );
      }

      const address = await queryOne<Address>(
        'SELECT * FROM addresses WHERE id = $1 AND user_id = $2',
        [address_id, user.id]
      );

      if (!address) {
        return NextResponse.json(errorResponse('Address not found'), { status: 404 });
      }

      const serviceType = await queryOne<{ id: number }>(
        'SELECT id FROM service_types WHERE id = $1 AND is_active = true',
        [service_type_id]
      );

      if (!serviceType) {
        return NextResponse.json(errorResponse('Service type not found'), { status: 404 });
      }

      const qty = typeof quantity === 'number' ? quantity : (service_details?.quantity ?? 500);
      const pricing = await calculatePrice({
        service_type_id,
        zone_id: undefined,
        quantity: qty,
        customer_lat: address.lat ?? 28.7041,
        customer_lng: address.lng ?? 77.1025,
        is_emergency: !!emergency,
      });

      const order = await transaction(async (client) => {
        const details = service_details ?? (body.serviceTypeName === 'WATER_SUPPLY' ? { quantity: qty, unit: 'liters' } : null);
        const insert = await client.query<Order>(
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
            details ? JSON.stringify(details) : null,
            pricing.base_price,
            pricing.distance_factor,
            pricing.subtotal,
            pricing.tax_amount,
            pricing.emergency_charge,
            pricing.total_amount,
            slotResult.time_slot,
            slotResult.scheduled_time,
          ]
        );

        const newOrder = insert.rows[0];

        await client.query(
          `INSERT INTO order_status_history (order_id, status, updated_by, notes)
           VALUES ($1, 'PENDING', $2, 'Order created')`,
          [newOrder.id, user.id]
        );

        await client.query(
          `INSERT INTO notifications (user_id, title, message, type, related_id)
           VALUES ($1, 'Order Placed', 'Your order has been placed successfully.', 'ORDER', $2)`,
          [user.id, newOrder.id]
        );

        return newOrder;
      });

      return NextResponse.json(
        successResponse(order, 'Order created successfully'),
        { status: 201 }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create order';
      return NextResponse.json(errorResponse(message), { status: 500 });
    }
  }, 'CUSTOMER');
}
