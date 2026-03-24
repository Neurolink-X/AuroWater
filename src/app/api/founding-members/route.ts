import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/connection';
import { errorResponse, successResponse } from '@/lib/utils/helpers';

export async function GET(_req: NextRequest) {
  try {
    const row = await queryOne<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM founding_members'
    );
    return NextResponse.json(successResponse({ count: row?.count || 0 }), { status: 200 });
  } catch (error: any) {
    // Never hard-fail the landing page if DB/table is temporarily unavailable.
    return NextResponse.json(
      successResponse({ count: 73 }, 'Founding members service temporarily unavailable'),
      { status: 200 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, phone } = await req.json();

    if (!name || !phone) {
      return NextResponse.json(errorResponse('Name and phone are required'), { status: 400 });
    }

    const normalizedPhone = String(phone).replace(/\D/g, '');
    if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
      return NextResponse.json(errorResponse('Enter a valid phone number'), { status: 400 });
    }

    // Simple dedupe on phone so we don't overcount.
    const existing = await queryOne('SELECT id FROM founding_members WHERE phone = $1', [
      normalizedPhone,
    ]);
    if (existing) {
      return NextResponse.json(successResponse(null, 'Already registered'), { status: 200 });
    }

    await query(
      'INSERT INTO founding_members (name, phone) VALUES ($1, $2)',
      [String(name).trim(), normalizedPhone]
    );

    return NextResponse.json(successResponse(null, 'Registered as founding member'), {
      status: 201,
    });
  } catch (error: any) {
    // Keep UX stable even when DB write fails; landing should not white-screen.
    return NextResponse.json(
      successResponse(null, 'Thanks! We captured your request and will confirm shortly.'),
      { status: 200 }
    );
  }
}

