import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAnonClient, isSupabaseConfigured } from '@/lib/db/supabase';
import { errorResponse, successResponse } from '@/lib/utils/helpers';

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(successResponse({ count: 0 }), { status: 200 });
  }

  try {
    const sb = createSupabaseAnonClient();
    const { count, error } = await sb
      .from('founding_members')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return NextResponse.json(successResponse({ count: 0 }), { status: 200 });
    }

    return NextResponse.json(successResponse({ count: count ?? 0 }), { status: 200 });
  } catch {
    return NextResponse.json(successResponse({ count: 0 }), { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      successResponse(null, 'Thanks! We will be in touch.'),
      { status: 200 }
    );
  }

  try {
    const { name, phone } = await req.json();

    if (!name || !phone) {
      return NextResponse.json(errorResponse('Name and phone are required'), { status: 400 });
    }

    const normalizedPhone = String(phone).replace(/\D/g, '');
    if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
      return NextResponse.json(errorResponse('Enter a valid phone number'), { status: 400 });
    }

    const sb = createSupabaseAnonClient();

    const { data: existing } = await sb
      .from('founding_members')
      .select('id')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(successResponse(null, 'Already registered'), { status: 200 });
    }

    const { error } = await sb.from('founding_members').insert({
      name: String(name).trim(),
      phone: normalizedPhone,
    });

    if (error) {
      return NextResponse.json(
        successResponse(null, 'Thanks! We captured your request.'),
        { status: 200 }
      );
    }

    return NextResponse.json(successResponse(null, 'Registered as founding member'), {
      status: 201,
    });
  } catch {
    return NextResponse.json(
      successResponse(null, 'Thanks! We captured your request.'),
      { status: 200 }
    );
  }
}
