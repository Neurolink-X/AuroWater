import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/connection';
import { withAuth } from '@/lib/auth/middleware';
import { errorResponse, successResponse } from '@/lib/utils/helpers';

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const services = await query(
        'SELECT * FROM service_types ORDER BY created_at ASC'
      );
      return NextResponse.json(successResponse(services), { status: 200 });
    } catch (error: any) {
      return NextResponse.json(errorResponse(error.message || 'Failed to fetch services'), { status: 500 });
    }
  }, 'ADMIN');
}

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const { name, description, base_price, is_active = true } = await req.json();
      if (!name || base_price === undefined) {
        return NextResponse.json(errorResponse('name and base_price are required'), { status: 400 });
      }
      const service = await queryOne(
        `INSERT INTO service_types (name, description, base_price, is_active)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [name, description || null, base_price, is_active]
      );
      return NextResponse.json(successResponse(service, 'Service created'), { status: 201 });
    } catch (error: any) {
      return NextResponse.json(errorResponse(error.message || 'Failed to create service'), { status: 500 });
    }
  }, 'ADMIN');
}

export async function PUT(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const { id, name, description, base_price, is_active } = await req.json();
      if (!id) {
        return NextResponse.json(errorResponse('id is required'), { status: 400 });
      }
      const updated = await queryOne(
        `UPDATE service_types
         SET name = COALESCE($2, name),
             description = COALESCE($3, description),
             base_price = COALESCE($4, base_price),
             is_active = COALESCE($5, is_active),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id, name || null, description || null, base_price || null, is_active]
      );
      if (!updated) {
        return NextResponse.json(errorResponse('Service not found'), { status: 404 });
      }
      return NextResponse.json(successResponse(updated, 'Service updated'), { status: 200 });
    } catch (error: any) {
      return NextResponse.json(errorResponse(error.message || 'Failed to update service'), { status: 500 });
    }
  }, 'ADMIN');
}

export async function DELETE(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');
      if (!id) return NextResponse.json(errorResponse('id is required'), { status: 400 });
      await query('DELETE FROM service_types WHERE id = $1', [id]);
      return NextResponse.json(successResponse(null, 'Service deleted'), { status: 200 });
    } catch (error: any) {
      return NextResponse.json(errorResponse(error.message || 'Failed to delete service'), { status: 500 });
    }
  }, 'ADMIN');
}

