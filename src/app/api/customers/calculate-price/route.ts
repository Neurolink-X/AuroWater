import { NextRequest, NextResponse } from 'next/server';
import { calculatePrice } from '@/lib/pricing/engine';
import { errorResponse, successResponse } from '@/lib/utils/helpers';

export async function POST(req: NextRequest) {
  try {
    const {
      service_type_id,
      zone_id,
      quantity,
      customer_lat,
      customer_lng,
      zone_base_lat,
      zone_base_lng,
      is_emergency,
    } = await req.json();

    if (!service_type_id || customer_lat === undefined || customer_lng === undefined) {
      return NextResponse.json(
        errorResponse('service_type_id, customer_lat, and customer_lng are required'),
        { status: 400 }
      );
    }

    const pricing = await calculatePrice({
      service_type_id,
      zone_id,
      quantity,
      customer_lat,
      customer_lng,
      zone_base_lat,
      zone_base_lng,
      is_emergency,
    });

    return NextResponse.json(successResponse(pricing), { status: 200 });
  } catch (error: any) {
    console.error('Pricing calculation error:', error);
    return NextResponse.json(errorResponse(error.message || 'Pricing calculation failed'), {
      status: 500,
    });
  }
}
