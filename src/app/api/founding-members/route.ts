import { NextRequest, NextResponse } from 'next/server';

import {
  createSupabaseAnonClient,
  isSupabaseConfigured,
} from '@/lib/db/supabase';

import {
  errorResponse,
  successResponse,
} from '@/lib/utils/helpers';

export const runtime = 'nodejs';

const MAX_NAME_LENGTH = 100;
const MIN_PHONE_LENGTH = 10;
const MAX_PHONE_LENGTH = 15;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
};

function jsonSuccess(
  data: unknown,
  status = 200,
) {
  return NextResponse.json(
    successResponse(data),
    {
      status,
      headers: NO_STORE_HEADERS,
    },
  );
}

function jsonMessage(
  data: unknown,
  message: string,
  status = 200,
) {
  return NextResponse.json(
    successResponse(data, message),
    {
      status,
      headers: NO_STORE_HEADERS,
    },
  );
}

function jsonError(
  message: string,
  status: number,
) {
  return NextResponse.json(
    errorResponse(message),
    {
      status,
      headers: NO_STORE_HEADERS,
    },
  );
}

/**
 * Normalize an Indian/international phone value into digits only.
 *
 * Examples:
 * +91 98765 43210 → 919876543210
 * 98765-43210     → 9876543210
 *
 * We intentionally do not silently add +91 because this endpoint
 * accepts international-length numbers as well.
 */
function normalizePhone(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\D/g, '');
}

/**
 * Normalize and validate a person's name.
 */
function normalizeName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * GET /api/founding-members
 *
 * Public count endpoint.
 *
 * Used by the landing page to show the current founding-member
 * count without exposing member records.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return jsonSuccess({ count: 0 });
  }

  try {
    const supabase = createSupabaseAnonClient();

    const { count, error } = await supabase
      .from('founding_members')
      .select('id', {
        count: 'exact',
        head: true,
      });

    if (error) {
      console.error(
        '[founding-members] count query failed:',
        error,
      );

      // Keep the public marketing page resilient.
      return jsonSuccess({ count: 0 });
    }

    return jsonSuccess({
      count: count ?? 0,
    });
  } catch (error) {
    console.error(
      '[founding-members] count endpoint failed:',
      error,
    );

    return jsonSuccess({ count: 0 });
  }
}

/**
 * POST /api/founding-members
 *
 * Public founding-member registration.
 *
 * Security model:
 * - No authentication required.
 * - Only minimal data is accepted.
 * - Never return database internals.
 * - Duplicate registrations are harmless.
 * - Database uniqueness should provide the final race-condition
 *   protection.
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return jsonMessage(
      null,
      'Thanks! We will be in touch.',
    );
  }

  try {
    // ------------------------------------------------------------
    // 1. Validate content type
    // ------------------------------------------------------------
    const contentType =
      req.headers.get('content-type')?.toLowerCase() ?? '';

    if (!contentType.includes('application/json')) {
      return jsonError(
        'Request must use application/json',
        415,
      );
    }

    // ------------------------------------------------------------
    // 2. Parse request body safely
    // ------------------------------------------------------------
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return jsonError(
        'Invalid request body',
        400,
      );
    }

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body)
    ) {
      return jsonError(
        'Invalid request body',
        400,
      );
    }

    const payload = body as Record<string, unknown>;

    // ------------------------------------------------------------
    // 3. Normalize fields
    // ------------------------------------------------------------
    const name = normalizeName(payload.name);
    const normalizedPhone = normalizePhone(payload.phone);

    // ------------------------------------------------------------
    // 4. Validate name
    // ------------------------------------------------------------
    if (!name) {
      return jsonError(
        'Name is required',
        400,
      );
    }

    if (name.length < 2) {
      return jsonError(
        'Enter a valid name',
        400,
      );
    }

    if (name.length > MAX_NAME_LENGTH) {
      return jsonError(
        `Name must be ${MAX_NAME_LENGTH} characters or fewer`,
        400,
      );
    }

    // Reject control characters and obviously malformed input.
    if (/[\u0000-\u001F\u007F]/.test(name)) {
      return jsonError(
        'Enter a valid name',
        400,
      );
    }

    // ------------------------------------------------------------
    // 5. Validate phone
    // ------------------------------------------------------------
    if (!normalizedPhone) {
      return jsonError(
        'Phone number is required',
        400,
      );
    }

    if (
      normalizedPhone.length < MIN_PHONE_LENGTH ||
      normalizedPhone.length > MAX_PHONE_LENGTH
    ) {
      return jsonError(
        'Enter a valid phone number',
        400,
      );
    }

    // ------------------------------------------------------------
    // 6. Create anonymous Supabase client
    // ------------------------------------------------------------
    const supabase = createSupabaseAnonClient();

    // ------------------------------------------------------------
    // 7. Check for existing registration
    //
    // This improves UX, but database uniqueness MUST still exist
    // because two requests can arrive simultaneously.
    // ------------------------------------------------------------
    const {
      data: existing,
      error: existingError,
    } = await supabase
      .from('founding_members')
      .select('id')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (existingError) {
      console.error(
        '[founding-members] duplicate check failed:',
        existingError,
      );

      return jsonError(
        'Unable to process your request right now',
        503,
      );
    }

    if (existing) {
      return jsonMessage(
        null,
        'Already registered',
      );
    }

    // ------------------------------------------------------------
    // 8. Insert registration
    // ------------------------------------------------------------
    const { error: insertError } = await supabase
      .from('founding_members')
      .insert({
        name,
        phone: normalizedPhone,
      });

    if (insertError) {
      /*
       * A unique constraint may reject a concurrent duplicate.
       *
       * We intentionally do not expose the raw database error.
       */
      const errorCode =
        typeof insertError === 'object' &&
        insertError !== null &&
        'code' in insertError
          ? String(
              (insertError as { code?: unknown }).code ?? '',
            )
          : '';

      if (errorCode === '23505') {
        return jsonMessage(
          null,
          'Already registered',
        );
      }

      console.error(
        '[founding-members] insert failed:',
        insertError,
      );

      return jsonError(
        'Unable to complete registration right now',
        503,
      );
    }

    // ------------------------------------------------------------
    // 9. Success
    // ------------------------------------------------------------
    return jsonMessage(
      null,
      'Registered as founding member',
      201,
    );
  } catch (error) {
    console.error(
      '[founding-members] unexpected POST error:',
      error,
    );

    return jsonError(
      'Unable to complete registration right now',
      500,
    );
  }
}
