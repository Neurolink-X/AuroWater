import { NextRequest } from 'next/server';
import { z } from 'zod';

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

  /*
   * Do not trust the phone/name currently
   * stored in the profile. Update them from
   * the validated application payload.
   */
  const {
    error: profileError,
  } = await supabase
    .from('profiles')
    .update({
      full_name:
        body.full_name,
      phone:
        body.phone,
    })
    .eq(
      'id',
      userId,
    );

  if (profileError) {
    return jsonErr(
      'Could not update applicant profile',
      502,
    );
  }

  /*
   * Store the validated payload.
   * Server-side validation above means the
   * application payload is controlled data.
   */
  const {
    data: application,
    error:
      applicationError,
  } = await supabase
    .from('applications')
    .insert({
      user_id: userId,
      type: body.type,
      payload: body,
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

