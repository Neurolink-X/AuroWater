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
        const role = searchParams.get('role');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');

        let query_str = 'SELECT * FROM users WHERE 1=1';
        const params: any[] = [];

        if (role) {
          query_str += ` AND role = $${params.length + 1}`;
          params.push(role);
        }

        query_str += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit);
        params.push(offset);

        const users = await query(query_str, params);

        return NextResponse.json(successResponse(users), { status: 200 });
      } catch (error: any) {
        console.error('Get users error:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch users'), {
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
        const { user_id, is_active, full_name, avatar_url } = await req.json();

        if (!user_id) {
          return NextResponse.json(errorResponse('user_id is required'), { status: 400 });
        }

        const updatedUser = await queryOne(
          `UPDATE users 
           SET is_active = COALESCE($1, is_active),
               full_name = COALESCE($2, full_name),
               avatar_url = COALESCE($3, avatar_url),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4
           RETURNING *`,
          [is_active !== undefined ? is_active : null, full_name || null, avatar_url || null, user_id]
        );

        if (!updatedUser) {
          return NextResponse.json(errorResponse('User not found'), { status: 404 });
        }

        return NextResponse.json(
          successResponse(updatedUser, 'User updated successfully'),
          { status: 200 }
        );
      } catch (error: any) {
        console.error('Update user error:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to update user'), {
          status: 500,
        });
      }
    },
    'ADMIN'
  );
}
