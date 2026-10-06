import { NextRequest } from 'next/server';

import {
  jsonErr,
  jsonOk,
} from '@/lib/api/json-response';

import {
  requireRole,
  requireSupabaseAuth,
} from '@/lib/api/supabase-request';

import {
  createServiceClient,
} from '@/utils/supabase/server';

const ISSUE_CATEGORIES = [
  'late_delivery',
  'service_quality',
  'water_quality',
  'staff_behaviour',
  'quantity',
  'packaging',
  'pricing',
  'communication',
  'address_issue',
  'hygiene',
  'other',
] as const;

const POSITIVE_TAGS = [
  'on_time',
  'good_quality',
  'professional_staff',
  'easy_booking',
  'good_value',
  'smooth_service',
] as const;

const NEGATIVE_TAGS = [
  'late_delivery',
  'water_quality',
  'staff_behaviour',
  'quantity',
  'packaging',
  'pricing',
  'communication',
  'address_issue',
  'hygiene',
  'other',
] as const;

const MAX_COMMENT_LENGTH = 1000;
const MAX_TAGS = 10;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isStringArray(
  value: unknown
): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === 'string'
    )
  );
}

function normalizeTags(
  value: unknown
): string[] {
  if (!isStringArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, MAX_TAGS);
}

function calculateSeverity(
  rating: number,
  hasIssue: boolean
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (!hasIssue) {
    return 'LOW';
  }

  if (rating === 1) {
    return 'CRITICAL';
  }

  if (rating === 2) {
    return 'HIGH';
  }

  if (rating === 3) {
    return 'MEDIUM';
  }

  return 'LOW';
}

function isAllowedTagForRating(
  rating: number,
  tag: string
): boolean {
  if (rating >= 4) {
    return POSITIVE_TAGS.includes(
      tag as (typeof POSITIVE_TAGS)[number]
    );
  }

  return NEGATIVE_TAGS.includes(
    tag as (typeof NEGATIVE_TAGS)[number]
  );
}

export async function POST(
  req: NextRequest
) {
  const auth =
    await requireSupabaseAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  if (
    !requireRole(
      auth.ctx,
      'customer'
    )
  ) {
    return jsonErr(
      'Forbidden',
      403
    );
  }

  let body:
    Record<string, unknown>;

  try {
    const rawText =
      await req.text();

    if (
      new TextEncoder()
        .encode(rawText)
        .byteLength > 12 * 1024
    ) {
      return jsonErr(
        'Request too large',
        413
      );
    }

    body =
      JSON.parse(
        rawText
      ) as Record<string, unknown>;
  } catch {
    return jsonErr(
      'Invalid JSON body',
      400
    );
  }

  const order_id =
    typeof body.order_id ===
    'string'
      ? body.order_id.trim()
      : '';

  const rating =
    Number(body.rating);

  const comment =
    typeof body.comment ===
    'string'
      ? body.comment.trim()
      : typeof body.text ===
          'string'
        ? body.text.trim()
        : null;

  const tags =
    normalizeTags(
      body.tags
    );

  const issue_category =
    typeof body.issue_category ===
    'string'
      ? body.issue_category
          .trim()
          .toLowerCase()
      : null;

  const issue_description =
    typeof body.issue_description ===
    'string'
      ? body.issue_description.trim()
      : null;

  if (!order_id) {
    return jsonErr(
      'Order ID is required',
      400
    );
  }

  if (!UUID_RE.test(order_id)) {
    return jsonErr(
      'Invalid order ID',
      400
    );
  }

  if (
    !Number.isFinite(
      rating
    ) ||
    !Number.isInteger(
      rating
    ) ||
    rating < 1 ||
    rating > 5
  ) {
    return jsonErr(
      'Rating must be a whole number from 1 to 5',
      400
    );
  }

  if (
    comment &&
    comment.length >
      MAX_COMMENT_LENGTH
  ) {
    return jsonErr(
      'Feedback must be 1000 characters or fewer',
      400
    );
  }

  if (
    issue_description &&
    issue_description.length >
      MAX_COMMENT_LENGTH
  ) {
    return jsonErr(
      'Issue description must be 1000 characters or fewer',
      400
    );
  }

  if (
    issue_category &&
    !ISSUE_CATEGORIES.includes(
      issue_category as
        (typeof ISSUE_CATEGORIES)[number]
    )
  ) {
    return jsonErr(
      'Invalid issue category',
      400
    );
  }

  const invalidTags =
    tags.filter(
      (tag) =>
        !isAllowedTagForRating(
          rating,
          tag
        )
    );

  if (
    invalidTags.length > 0
  ) {
    return jsonErr(
      'Invalid feedback option',
      400
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Verify order                                                           */
  /* ---------------------------------------------------------------------- */

  const {
    data: order,
    error: orderError,
  } =
    await auth.ctx.supabase
      .from('orders')
      .select(
        `
        id,
        status,
        customer_id,
        supplier_id,
        technician_id
      `
      )
      .eq(
        'id',
        order_id
      )
      .maybeSingle();

  if (
    orderError ||
    !order
  ) {
    return jsonErr(
      'Order not found',
      404
    );
  }

  if (
    order.customer_id !==
    auth.ctx.profile.id
  ) {
    return jsonErr(
      'Forbidden',
      403
    );
  }

  if (
    order.status !==
    'COMPLETED'
  ) {
    return jsonErr(
      'You can only review completed orders',
      400
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Duplicate protection                                                  */
  /* ---------------------------------------------------------------------- */

  const {
    data: existingReview,
  } =
    await auth.ctx.supabase
      .from('reviews')
      .select('id')
      .eq(
        'order_id',
        order_id
      )
      .limit(1)
      .maybeSingle();

  if (
    existingReview
  ) {
    return jsonErr(
      'Feedback has already been submitted for this order',
      409
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Calculate final quality data on server                                 */
  /* ---------------------------------------------------------------------- */

  const finalIssueCategory =
    issue_category ||
    (rating <= 2
      ? 'other'
      : null);

  const hasIssue =
    rating <= 2 ||
    Boolean(
      issue_category
    ) ||
    Boolean(
      issue_description
    );

  const severity =
    calculateSeverity(
      rating,
      hasIssue
    );

  /* ---------------------------------------------------------------------- */
  /* Insert review                                                         */
  /* ---------------------------------------------------------------------- */

  const reviewPayload = {
    order_id,
    customer_id:
      auth.ctx.profile.id,

    rating,

    comment:
      comment || null,

    feedback_tags:
      tags,

    issue_category:
      finalIssueCategory,

    issue_description:
      issue_description ||
      null,

    severity,
  };

  const {
    data: inserted,
    error: reviewError,
  } =
    await auth.ctx.supabase
      .from('reviews')
      .insert(
        reviewPayload
      )
      .select(
        'id, rating, created_at'
      )
      .single();

  if (
    reviewError ||
    !inserted
  ) {
    console.error(
      '[customer/reviews] insert failed',
      reviewError
    );

    return jsonErr(
      'Unable to save feedback right now',
      500
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Mirror rating onto order                                              */
  /* ---------------------------------------------------------------------- */

  const {
    error: orderUpdateError,
  } =
    await auth.ctx.supabase
      .from('orders')
      .update({
        has_review: true,
        rating,
      })
      .eq(
        'id',
        order_id
      );

  if (
    orderUpdateError
  ) {
    console.error(
      '[customer/reviews] order update failed',
      orderUpdateError
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Create service quality case                                           */
  /* ---------------------------------------------------------------------- */

  let qualityCaseId:
    string | null = null;

  if (hasIssue) {
    try {
      const admin =
        createServiceClient();

      const {
        data: qualityCase,
        error: caseError,
      } =
        await admin
          .from(
            'service_quality_cases'
          )
          .insert({
            order_id,
            review_id:
              inserted.id,
            customer_id:
              auth.ctx.profile.id,
            supplier_id:
              order.supplier_id,
            technician_id:
              order.technician_id,
            category:
              finalIssueCategory ||
              'service_quality',
            severity,
            status: 'OPEN',
          })
          .select('id')
          .single();

      if (
        caseError
      ) {
        console.error(
          '[customer/reviews] quality case creation failed',
          caseError
        );
      } else {
        qualityCaseId =
          qualityCase?.id ??
          null;
      }
    } catch (caseError) {
      console.error(
        '[customer/reviews] quality case setup failed',
        caseError
      );
    }
  }

  return jsonOk(
    {
      id:
        inserted.id,

      rating:
        inserted.rating,

      created_at:
        inserted.created_at,

      quality_case_id:
        qualityCaseId,
    },
    201
  );
}
