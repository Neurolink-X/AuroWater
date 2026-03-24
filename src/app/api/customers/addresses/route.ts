import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/connection';
import { withAuth } from '@/lib/auth/middleware';
import { errorResponse, successResponse, validatePincode } from '@/lib/utils/helpers';
import { Address } from '@/types';

export async function GET(req: NextRequest) {
  return withAuth(req, async (req, user) => {
    try {
      const addresses = await query<Address>(
        'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
        [user.id]
      );

      return NextResponse.json(successResponse(addresses), { status: 200 });
    } catch (error: any) {
      console.error('Get addresses error:', error);
      return NextResponse.json(errorResponse(error.message || 'Failed to fetch addresses'), {
        status: 500,
      });
    }
  }, 'CUSTOMER');
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (req, user) => {
    try {
      const { house_no, area, landmark, city, pincode, lat, lng, address_type, is_default } =
        await req.json();

      // Validation
      if (!house_no || !area || !city || !pincode) {
        return NextResponse.json(
          errorResponse('house_no, area, city, and pincode are required'),
          { status: 400 }
        );
      }

      if (!validatePincode(pincode)) {
        return NextResponse.json(errorResponse('Invalid pincode'), { status: 400 });
      }

      // If marking as default, remove default from other addresses
      if (is_default) {
        await query('UPDATE addresses SET is_default = false WHERE user_id = $1', [user.id]);
      }

      const address = await queryOne<Address>(
        `INSERT INTO addresses (user_id, house_no, area, landmark, city, pincode, lat, lng, address_type, is_default)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [user.id, house_no, area, landmark || null, city, pincode, lat || null, lng || null, address_type || 'HOME', is_default || false]
      );

      return NextResponse.json(
        successResponse(address, 'Address added successfully'),
        { status: 201 }
      );
    } catch (error: any) {
      console.error('Add address error:', error);
      return NextResponse.json(errorResponse(error.message || 'Failed to add address'), {
        status: 500,
      });
    }
  }, 'CUSTOMER');
}

export async function PUT(req: NextRequest) {
  return withAuth(req, async (req, user) => {
    try {
      const { id, house_no, area, landmark, city, pincode, lat, lng, address_type, is_default } =
        await req.json();

      if (!id) {
        return NextResponse.json(errorResponse('Address ID is required'), { status: 400 });
      }

      if (!validatePincode(pincode)) {
        return NextResponse.json(errorResponse('Invalid pincode'), { status: 400 });
      }

      // Verify ownership
      const addressRecord = await queryOne(
        'SELECT id FROM addresses WHERE id = $1 AND user_id = $2',
        [id, user.id]
      );

      if (!addressRecord) {
        return NextResponse.json(errorResponse('Address not found'), { status: 404 });
      }

      if (is_default) {
        await query('UPDATE addresses SET is_default = false WHERE user_id = $1', [user.id]);
      }

      const updatedAddress = await queryOne<Address>(
        `UPDATE addresses 
         SET house_no = $2, area = $3, landmark = $4, city = $5, pincode = $6, lat = $7, lng = $8, address_type = $9, is_default = $10, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $11
         RETURNING *`,
        [id, house_no, area, landmark || null, city, pincode, lat || null, lng || null, address_type || 'HOME', is_default || false, user.id]
      );

      return NextResponse.json(
        successResponse(updatedAddress, 'Address updated successfully'),
        { status: 200 }
      );
    } catch (error: any) {
      console.error('Update address error:', error);
      return NextResponse.json(errorResponse(error.message || 'Failed to update address'), {
        status: 500,
      });
    }
  }, 'CUSTOMER');
}

export async function DELETE(req: NextRequest) {
  return withAuth(req, async (req, user) => {
    try {
      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');

      if (!id) {
        return NextResponse.json(errorResponse('Address ID is required'), { status: 400 });
      }

      const addressRecord = await queryOne(
        'SELECT id FROM addresses WHERE id = $1 AND user_id = $2',
        [id, user.id]
      );

      if (!addressRecord) {
        return NextResponse.json(errorResponse('Address not found'), { status: 404 });
      }

      await query('DELETE FROM addresses WHERE id = $1 AND user_id = $2', [id, user.id]);

      return NextResponse.json(successResponse(null, 'Address deleted successfully'), {
        status: 200,
      });
    } catch (error: any) {
      console.error('Delete address error:', error);
      return NextResponse.json(errorResponse(error.message || 'Failed to delete address'), {
        status: 500,
      });
    }
  }, 'CUSTOMER');
}
