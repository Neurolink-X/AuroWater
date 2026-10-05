import { NextRequest } from 'next/server';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireRole, requireSupabaseAuth } from '@/lib/api/supabase-request';

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

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string')
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);

  if (!auth.ok) return auth.response;

  if (!requireRole(auth.ctx, 'customer')) {
    return jsonErr('Forbidden', 403);
  }

  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr('Invalid JSON body', 400);
  }

  const order_id =
    typeof body.order_id === 'string' ? body.order_id.trim() : '';

  const rating = Number(body.rating);

  const comment =
    typeof body.comment === 'string'
      ? body.comment.trim()
      : typeof body.text === 'string'
        ? body.text.trim()
        : null;

  const tags = isStringArray(body.tags)
    ? body.tags.slice(0, 10)
    : [];

  const issue_category =
    typeof body.issue_category === 'string'
      ? body.issue_category
      : null;

  const issue_description =
    typeof body.issue_description === 'string'
      ? body.issue_description.trim()
      : null;

  const severity =
    typeof body.severity === 'string'
      ? body.severity.toUpperCase()
      : null;

  if (
    !order_id ||
    !Number.isFinite(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return jsonErr(
      'order_id and rating (1–5) are required',
      400
    );
  }

  if (!Number.isInteger(rating)) {
    return jsonErr('Rating must be a whole number from 1 to 5', 400);
  }

  if (
    issue_category &&
    !ISSUE_CATEGORIES.includes(
      issue_category as (typeof ISSUE_CATEGORIES)[number]
    )
  ) {
    return jsonErr('Invalid issue category', 400);
  }

  if (
    severity &&
    !SEVERITIES.includes(
      severity as (typeof SEVERITIES)[number]
    )
  ) {
    return jsonErr('Invalid severity', 400);
  }

  const invalidTags = tags.filter(
    (tag) =>
      !POSITIVE_TAGS.includes(
        tag as (typeof POSITIVE_TAGS)[number]
      ) &&
      !NEGATIVE_TAGS.includes(
        tag as (typeof NEGATIVE_TAGS)[number]
      )
  );

  if (invalidTags.length > 0) {
    return jsonErr('Invalid feedback option', 400);
  }

  // ---------------------------------------------------------
  // Verify order
  // ---------------------------------------------------------

  const { data: ord, error: orderError } = await auth.ctx.supabase
    .from('orders')
    .select(
      'id, status, customer_id, supplier_id, technician_id'
    )
    .eq('id', order_id)
    .maybeSingle();

  if (orderError || !ord) {
    return jsonErr('Order not found', 404);
  }

  if (ord.customer_id !== auth.ctx.profile.id) {
    return jsonErr('Forbidden', 403);
  }

  if (ord.status !== 'COMPLETED') {
    return jsonErr(
      'You can only review completed orders',
      400
    );
  }

  // ---------------------------------------------------------
  // Prevent duplicate review
  // ---------------------------------------------------------

  const { data: existingReview } = await auth.ctx.supabase
    .from('reviews')
    .select('id')
    .eq('order_id', order_id)
    .maybeSingle();

  if (existingReview) {
    return jsonErr(
      'Feedback has already been submitted for this order',
      409
    );
  }

  // ---------------------------------------------------------
  // Insert review
  // ---------------------------------------------------------

  const reviewPayload = {
    order_id,
    customer_id: auth.ctx.profile.id,
    rating,
    comment: comment || null,

    // These columns are added by the migration below.
    feedback_tags: tags,
    issue_category:
      issue_category ||
      (rating <= 2 ? 'other' : null),
    issue_description: issue_description || null,
    severity:
      severity ||
      (rating <= 2 ? 'MEDIUM' : 'LOW'),
  };

  const { data: inserted, error } = await auth.ctx.supabase
    .from('reviews')
    .insert(reviewPayload)
    .select('id, rating, created_at')
    .single();

  if (error) {
    console.error('[customer/reviews] insert failed', error);

    return jsonErr(
      'Unable to save feedback right now',
      500
    );
  }

  // ---------------------------------------------------------
  // Mirror rating onto order
  // ---------------------------------------------------------

  const { error: orderUpdateError } =
    await auth.ctx.supabase
      .from('orders')
      .update({
        has_review: true,
        rating,
      })
      .eq('id', order_id);

  if (orderUpdateError) {
    console.error(
      '[customer/reviews] order update failed',
      orderUpdateError
    );
  }

  // ---------------------------------------------------------
  // Create quality case for serious complaints
  // ---------------------------------------------------------

  const shouldCreateCase =
    rating <= 2 ||
    Boolean(issue_category) ||
    Boolean(issue_description);

  let qualityCaseId: string | null = null;

  if (shouldCreateCase) {
    const calculatedSeverity =
      severity ||
      (rating === 1 ? 'CRITICAL' : rating === 2 ? 'HIGH' : 'MEDIUM');

    const { data: qualityCase, error: caseError } =
      await auth.ctx.supabase
        .from('service_quality_cases')
        .insert({
          order_id,
          review_id: inserted.id,
          customer_id: auth.ctx.profile.id,
          supplier_id: ord.supplier_id,
          technician_id: ord.technician_id,
          category:
            issue_category || 'service_quality',
          severity: calculatedSeverity,
          status: 'OPEN',
        })
        .select('id')
        .single();

    if (caseError) {
      console.error(
        '[customer/reviews] quality case creation failed',
        caseError
      );
    } else {
      qualityCaseId = qualityCase?.id ?? null;
    }
  }

  return jsonOk(
    {
      id: inserted.id,
      rating: inserted.rating,
      created_at: inserted.created_at,
      quality_case_id: qualityCaseId,
    },
    201
  );
}
