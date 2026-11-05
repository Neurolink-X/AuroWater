import { NextRequest } from 'next/server';
import { z } from 'zod';
import {PARTNER_ROLE_POLICY,registrationRoleMatchesSkills} from '@/lib/partner-onboarding-policy';
import { createServiceClient } from '@/utils/supabase/server';
import { consumeRateLimit } from '@/lib/api/rate-limit';

import {
  jsonErr,
  jsonOk,
} from '@/lib/api/json-response';
import {
  requireSupabaseAuth,
} from '@/lib/api/supabase-request';

const PHONE_REGEX = /^\d{10}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/i;

const baseSchema = z.object({
  type: z.enum([
    'supplier',
    'technician',
  ]),

  full_name: z
    .string()
    .trim()
    .min(2)
    .max(120),

  phone: z
    .string()
    .trim()
    .regex(
      PHONE_REGEX,
      'Phone number must be exactly 10 digits',
    ),

  city: z
    .string()
    .trim()
    .min(2)
    .max(100),
});

const supplierSchema =
  baseSchema.extend({
    type: z.literal('supplier'),

    vehicle_type: z.enum([
      'Cycle',
      'Bike',
      'Auto',
      'Mini-truck',
    ]),

    cans_capacity: z
      .number()
      .int()
      .min(1)
      .max(5000),
    business_name:z.string().trim().min(2).max(100),
    business_address:z.string().trim().min(8).max(300),
    pincode:z.string().regex(/^\d{6}$/),
    base_lat:z.number().min(-90).max(90).refine(v=>v!==0),
    base_lng:z.number().min(-180).max(180).refine(v=>v!==0),

    upi_id: z
      .string()
      .trim()
      .min(3)
      .max(100),

    bank_account: z
      .string()
      .trim()
      .max(30)
      .optional(),

    role:z.enum(['can','tanker']).optional(),
    ifsc: z
      .string()
      .trim()
      .regex(
        IFSC_REGEX,
        'Invalid IFSC code',
      )
      .optional(),
  });

const technicianSchema =
  baseSchema.extend({
    type: z.literal('technician'),

    skills: z
      .array(
        z.enum([
          'Plumbing',
          'RO Install',
          'Boring',
          'Maintenance',
        ]),
      )
      .min(1)
      .max(4),

    experience_years: z
      .number()
      .int()
      .min(0)
      .max(60),
    role:z.enum(['plumber','borewell','tank','ro']),
    working_area:z.string().trim().min(3).max(150),
    working_pincode:z.string().regex(/^\d{6}$/),
    requested_radius_km:z.number().int().min(1).max(50),
  });

const applicationSchema =
  z.discriminatedUnion('type', [
    supplierSchema,
    technicianSchema,
  ]);

export async function POST(
  req: NextRequest,
) {
  const auth =
    await requireSupabaseAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  const userId =
    String(
      auth.ctx.profile.id,
    );

  let raw: unknown;

  try {
    raw = await req.json();
  } catch {
    return jsonErr(
      'Invalid JSON body',
      400,
    );
  }

  const parsed =
    applicationSchema.safeParse(
      raw,
    );

  if (!parsed.success) {
    return jsonErr(
      parsed.error.issues[0]?.message ??
        'Invalid application',
      422,
    );
  }

  const body =
    parsed.data;

  // The platform currently has one operational role per profile.
  // Fail before storing an application that an admin could never approve.
  if (body.type === 'technician' && !['customer', 'technician'].includes(auth.ctx.profile.role)) {
    return jsonErr('This login is already assigned to another professional role. Contact support before adding technician services.', 409, 'ROLE_CONFLICT');
  }
  if (body.type === 'supplier' && !['customer', 'supplier'].includes(auth.ctx.profile.role)) {
    return jsonErr('This login is assigned to a different role. Contact support about professional account access.', 409, 'ROLE_CONFLICT');
  }

  // A contact number supplied in a form is not proof of phone ownership.
  // Only Supabase Auth phone confirmation may be trusted as phone verification.
  const authPhone = (auth.ctx.user.phone ?? '').replace(/[^0-9]/g, '').slice(-10);
  const verifiedPhone = Boolean(auth.ctx.user.phone_confirmed_at && authPhone.length === 10);
  if (verifiedPhone && body.phone !== authPhone) {
    return jsonErr('Use the mobile number verified on this login, or contact support to change it.', 422, 'PHONE_MISMATCH');
  }

  if (body.type === 'technician') {
    const policy = PARTNER_ROLE_POLICY[body.role];
    if (!registrationRoleMatchesSkills(body.role,body.skills) || body.requested_radius_km > policy.maxRadiusKm) {
      return jsonErr('Selected role, qualifications and working radius do not match',422);
    }
  }

  const limiter = await consumeRateLimit(createServiceClient(), 'partner-application', userId, 8, 86400);
  if (limiter.unavailable) return jsonErr('Application protection is temporarily unavailable. Please retry.', 503, 'RATE_LIMIT_UNAVAILABLE');
  if (!limiter.allowed) {
    const response = jsonErr('Too many application attempts. Try again tomorrow or contact support.', 429, 'RATE_LIMITED');
    response.headers.set('Retry-After', String(Math.max(1, limiter.retryAfter)));
    return response;
  }

  const supabase =
    auth.ctx.supabase;

  /*
   * Prevent users from submitting a new
   * application while they already have a
   * pending application of the same type.
   */
  const {
    data: existingApplication,
    error:
      existingApplicationError,
  } = await supabase
    .from('applications')
    .select(
      'id, type, status, created_at',
    )
    .eq(
      'user_id',
      userId,
    )
    .eq(
      'type',
      body.type,
    )
    .in(
      'status',
      [
        'pending',
        'pending_approval',
      ],
    )
    .order(
      'created_at',
      {
        ascending: false,
      },
    )
    .limit(1)
    .maybeSingle();

  if (
    existingApplicationError
  ) {
    return jsonErr(
      existingApplicationError.message,
      502,
    );
  }

  if (
    existingApplication
  ) {
    return jsonErr(
      `You already have a pending ${body.type} application`,
      409,
    );
  }

  // Do not overwrite a trusted account phone from an unverified contact form.
  // Contact information is stored in the application for explicit admin review.

  /*
   * Store the validated payload.
   * Server-side validation above means the
   * application payload is controlled data.
   */
  const {
    data: application,
    error:
      applicationError,
  } = await createServiceClient()
    .from('applications')
    .insert({
      user_id: userId,
      type: body.type,
      payload: { ...body, contact_phone_verified: verifiedPhone },
      status: 'pending',
    })
    .select('*')
    .single();

  if (applicationError) {
    /*
     * Unique constraint / concurrent duplicate
     * protection should be surfaced as conflict.
     */
    if (
      applicationError.code ===
      '23505'
    ) {
      return jsonErr(
        `You already have a ${body.type} application`,
        409,
      );
    }

    console.error(
      '[applications] create failed:',
      applicationError,
    );

    return jsonErr(
      'Could not submit application',
      502,
    );
  }

  // A verified submission is authoritative even if optional profile sync fails.
  try {
    const { error: profileNameError } = await supabase.from('profiles')
      .update({ full_name: body.full_name }).eq('id', userId);
    if (profileNameError) console.error('[applications] optional profile name sync failed', profileNameError.code);
  } catch { /* application receipt remains valid */ }

  // The applicant owns the application. A small admin team is notified in-app
  // only after a confirmed write; failed notifications never undo the application.
  try {
    const db = createServiceClient();
    const { data: admins } = await db.from('profiles').select('id')
      .eq('role', 'admin').eq('is_active', true).limit(20);
    if (admins?.length) {
      const { error: noticeError } = await db.from('notifications').upsert(
        admins.map((admin) => ({
          user_id: admin.id,
          type: 'system',
          title: 'New ' + body.type + ' application',
          message: 'A new partner is awaiting application and document review.',
          data: { application_id: application.id, url: '/admin/technician-capabilities' },
          dedup_key: 'partner_' + application.id + '_new_' + admin.id,
          is_read: false,
        })), { onConflict: 'dedup_key', ignoreDuplicates: true },
      );
      if (noticeError) console.error('[applications] admin notification unavailable', noticeError.code);
    }
  } catch (e) {
    console.error('[applications] admin notification failed', e instanceof Error ? e.message : 'unknown');
  }
  return jsonOk(
    application,
    201,
  );
}









// import { NextRequest } from 'next/server';
// import { z } from 'zod';

// import { jsonErr, jsonOk } from '@/lib/api/json-response';
// import { requireSupabaseAuth } from '@/lib/api/supabase-request';

// const baseSchema = z.object({
//   type: z.enum(['supplier', 'technician']),
//   full_name: z.string().min(2),
//   phone: z.string().regex(/^\d{10}$/),
//   city: z.string().min(2),
// });

// const supplierSchema = baseSchema.extend({
//   type: z.literal('supplier'),
//   vehicle_type: z.enum(['Cycle', 'Bike', 'Auto', 'Mini-truck']),
//   cans_capacity: z.number().int().min(1).max(5000),
//   upi_id: z.string().min(3),
//   bank_account: z.string().optional(),
//   ifsc: z.string().optional(),
// });

// const technicianSchema = baseSchema.extend({
//   type: z.literal('technician'),
//   skills: z.array(z.enum(['Plumbing', 'RO Install', 'Boring', 'Maintenance'])).min(1),
//   experience_years: z.number().int().min(0).max(60),
// });

// const appSchema = z.union([supplierSchema, technicianSchema]);

// export async function POST(req: NextRequest) {
//   const auth = await requireSupabaseAuth(req);
//   if (!auth.ok) return auth.response;

//   let raw: unknown;
//   try {
//     raw = (await req.json()) as unknown;
//   } catch {
//     return jsonErr('Invalid JSON body', 400);
//   }

//   const parsed = appSchema.safeParse(raw);
//   if (!parsed.success) {
//     return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid application', 422);
//   }

//   const body = parsed.data;

//   // Update applicant profile basics (best-effort).
//   await auth.ctx.supabase
//     .from('profiles')
//     .update({ full_name: body.full_name, phone: body.phone })
//     .eq('id', auth.ctx.profile.id);

//   const { data: application, error } = await auth.ctx.supabase
//     .from('applications')
//     .insert({
//       user_id: auth.ctx.profile.id,
//       type: body.type,
//       payload: body,
//       status: 'pending',
//     })
//     .select('*')
//     .single();

//   if (error) return jsonErr(error.message, 502);
//   return jsonOk(application, 201);
// }

