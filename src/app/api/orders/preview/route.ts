import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db/connection';
import { withAuth } from '@/lib/auth/middleware';
import { errorResponse, successResponse } from '@/lib/utils/helpers';
import { validateTimeSlot } from '@/lib/validation/time-slot';
import { calculatePrice } from '@/lib/pricing/engine';
import type { Address } from '@/types';

export async function POST(req: NextRequest) {
  return withAuth(req, async (req, user) => {
    try {
      const body = await req.json();
      const {
        address_id,
        service_type_id,
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

      const pricing = await calculatePrice({
        service_type_id,
        zone_id: undefined,
        quantity: typeof quantity === 'number' ? quantity : 500,
        customer_lat: address.lat ?? 28.7041,
        customer_lng: address.lng ?? 77.1025,
        is_emergency: !!emergency,
      });

      const breakdown = {
        base_price: pricing.base_price,
        distance_factor: pricing.distance_factor,
        distance_charge: pricing.distance_charge ?? 0,
        tax_percentage: pricing.tax_percentage ?? 0,
        subtotal: pricing.subtotal,
        tax_amount: pricing.tax_amount,
        emergency_charge: pricing.emergency_charge,
        total_amount: pricing.total_amount,
      };

      return NextResponse.json(
        {
          success: true,
          data: { breakdown, time_slot: slotResult.time_slot, scheduled_time: slotResult.scheduled_time },
          breakdown,
          time_slot: slotResult.time_slot,
          scheduled_time: slotResult.scheduled_time,
        },
        { status: 200 }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Preview failed';
      return NextResponse.json(errorResponse(message), { status: 500 });
    }
  }, 'CUSTOMER');
}
