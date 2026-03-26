import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/connection';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { errorResponse, successResponse, validatePincode } from '@/lib/utils/helpers';
import { Address } from '@/types';

export async function GET(req: NextRequest) {
  try {
    // Ensure table exists so API never hard-fails on first run.
    await query(`CREATE TABLE IF NOT EXISTS addresses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      house_no TEXT NOT NULL,
      area TEXT NOT NULL,
      landmark TEXT,
      city TEXT NOT NULL,
      pincode VARCHAR(10) NOT NULL,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      address_type VARCHAR(30) DEFAULT 'HOME',
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`);

    const token = getTokenFromRequest(req);
    const user = token ? verifyToken(token) : null;
    if (!user?.id) {
      return NextResponse.json(successResponse([]), { status: 200 });
    }

    const addresses = await query<Address>(
      'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
      [user.id]
    );

    return NextResponse.json(successResponse(addresses), { status: 200 });
  } catch (error: any) {
    return NextResponse.json(errorResponse(error.message || 'Failed to fetch addresses'), {
      status: 500,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    const user = token ? verifyToken(token) : null;
    if (!user?.id) {
      return NextResponse.json(errorResponse('Unauthorized'), { status: 401 });
    }

    const { house_no, area, landmark, city, pincode, lat, lng, address_type, is_default } =
      await req.json();

    if (!house_no || !area || !city || !pincode) {
      return NextResponse.json(
        errorResponse('house_no, area, city, and pincode are required'),
        { status: 400 }
      );
    }
    if (!validatePincode(pincode)) {
      return NextResponse.json(errorResponse('Invalid pincode'), { status: 400 });
    }

    if (is_default) {
      await query('UPDATE addresses SET is_default = false WHERE user_id = $1', [user.id]);
    }

    const address = await queryOne<Address>(
      `INSERT INTO addresses (user_id, house_no, area, landmark, city, pincode, lat, lng, address_type, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        user.id,
        house_no,
        area,
        landmark || null,
        city,
        pincode,
        lat || null,
        lng || null,
        address_type || 'HOME',
        is_default || false,
      ]
    );

    return NextResponse.json(successResponse(address, 'Address added successfully'), {
      status: 201,
    });
  } catch (error: any) {
    return NextResponse.json(errorResponse(error.message || 'Failed to add address'), {
      status: 500,
    });
  }
}

export async function PUT(req: NextRequest) {
  return NextResponse.json(errorResponse('Address update not available in this flow'), { status: 405 });
}

export async function DELETE(req: NextRequest) {
  return NextResponse.json(errorResponse('Address delete not available in this flow'), { status: 405 });
}
