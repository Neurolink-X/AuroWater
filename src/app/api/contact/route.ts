import { NextRequest } from 'next/server';

import {
  jsonErr,
  jsonOk,
} from '@/lib/api/json-response';

import {
  createSupabaseAnonClient,
  isSupabaseConfigured,
} from '@/lib/db/supabase';

import {
  checkRateLimit,
} from '@/lib/rate-limit';

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function getClientIp(
  req: NextRequest,
): string {
  const forwarded =
    req.headers.get(
      'x-forwarded-for',
    );

  if (forwarded) {
    return (
      forwarded
        .split(',')[0]
        ?.trim() || 'unknown'
    );
  }

  return (
    req.headers.get(
      'x-real-ip',
    ) ?? 'unknown'
  );
}

function text(
  value: unknown,
  maxLength: number,
): string {
  return typeof value ===
    'string'
    ? value.trim().slice(0, maxLength)
    : '';
}

export async function POST(
  req: NextRequest,
) {
  /*
   * Public endpoint protection.
   */
  const ip =
    getClientIp(req);

  const rateCheck =
    checkRateLimit(
      `contact:${ip}`,
    );

  if (!rateCheck.allowed) {
    return jsonErr(
      `Too many requests — please wait ${rateCheck.retryAfter} seconds`,
      429,
      'RATE_LIMITED',
    );
  }

  if (!isSupabaseConfigured()) {
    return jsonErr(
      'Contact form is temporarily unavailable',
      503,
      'MISCONFIG_ENV',
    );
  }

  let body: Record<
    string,
    unknown
  >;

  try {
    body =
      (await req.json()) as Record<
        string,
        unknown
      >;
  } catch {
    return jsonErr(
      'Invalid JSON body',
      400,
    );
  }

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return jsonErr(
      'Invalid JSON body',
      400,
    );
  }

  const name =
    text(
      body.name,
      100,
    );

  const email =
    text(
      body.email,
      254,
    ).toLowerCase();

  const message =
    text(
      body.message,
      5000,
    );

  const phone =
    text(
      body.phone,
      20,
    );

  /*
   * Required fields.
   */
  if (!name) {
    return jsonErr(
      'Name is required',
      400,
    );
  }

  if (
    name.length < 2
  ) {
    return jsonErr(
      'Name must contain at least 2 characters',
      422,
    );
  }

  if (!email) {
    return jsonErr(
      'Email is required',
      400,
    );
  }

  if (
    !EMAIL_PATTERN.test(email)
  ) {
    return jsonErr(
      'Enter a valid email address',
      422,
    );
  }

  if (!message) {
    return jsonErr(
      'Message is required',
      400,
    );
  }

  if (
    message.length < 10
  ) {
    return jsonErr(
      'Message must contain at least 10 characters',
      422,
    );
  }

  /*
   * Optional phone.
   *
   * We don't require it because a contact
   * enquiry should not depend on phone number.
   */
  if (
    phone &&
    !/^[0-9+\-()\s]{7,20}$/.test(
      phone,
    )
  ) {
    return jsonErr(
      'Enter a valid phone number',
      422,
    );
  }

  const supabase =
    createSupabaseAnonClient();

  const {
    error,
  } = await supabase
    .from(
      'contact_submissions',
    )
    .insert({
      name,
      email,
      message,
      phone:
        phone || null,
    });

  if (error) {
    console.error(
      '[contact] submission failed:',
      error,
    );

    /*
     * Don't expose the database error
     * to a public client.
     */
    return jsonErr(
      'We could not submit your message. Please try again.',
      500,
      'CONTACT_SUBMISSION_FAILED',
    );
  }

  return jsonOk(
    {
      received: true as const,
      message:
        'Thank you. Your message has been received.',
    },
    201,
  );
}
