/**
 * AuroTap Customer Profile API
 *
 * GET    /api/customer/profile
 * PUT    /api/customer/profile
 * PATCH  /api/customer/profile
 *
 * Responsibilities:
 * - Authenticate with the Supabase access token.
 * - Enforce the customer role server-side.
 * - Read profile data without a second RLS-sensitive query.
 * - Update only the authenticated customer's profile.
 * - Merge supported settings instead of overwriting unrelated preferences.
 * - Validate and limit request size.
 * - Apply a lightweight per-user write rate limit.
 * - Never expose internal database errors to the browser.
 * - Return cache-disabled responses because profile data is private.
 *
 * Important:
 * - `createServiceClient()` is used only AFTER authentication/role checks.
 * - The authenticated user's profile ID is always used for writes.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';

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

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const PROFILE_COLUMNS =
  'id, full_name, city, phone, created_at, settings';

const MAX_BODY_BYTES = 8 * 1024;
const MAX_SETTINGS_BYTES = 4 * 1024;

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

const NAME_RE =
  /^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u;

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

const nameSchema = z
  .string()
  .transform(collapseWhitespace)
  .pipe(
    z
      .string()
      .min(
        2,
        'Name must be at least 2 characters'
      )
      .max(
        80,
        'Name must be 80 characters or fewer'
      )
      .regex(
        NAME_RE,
        "Name can only contain letters, spaces and . ' -"
      )
  );

const citySchema = z
  .string()
  .transform(collapseWhitespace)
  .pipe(
    z
      .string()
      .min(
        2,
        'City must be at least 2 characters'
      )
      .max(
        60,
        'City must be 60 characters or fewer'
      )
  );

const notificationSchema = z.object({
  whatsapp: z.boolean().optional(),
  sms: z.boolean().optional(),
  email: z.boolean().optional(),
  push: z.boolean().optional(),
});

const settingsSchema = z.object({
  notifications:
    notificationSchema.optional(),

  language:
    z.enum(['en', 'hi']).optional(),

  default_payment:
    z.enum([
      'cash',
      'upi',
      'online',
    ]).optional(),

  marketing_opt_in:
    z.boolean().optional(),

  default_address_id:
    z
      .string()
      .min(1)
      .max(64)
      .nullable()
      .optional(),
});

const bodySchema = z
  .object({
    full_name:
      nameSchema.optional(),

    city:
      citySchema.optional(),

    settings:
      settingsSchema.optional(),
  })
  .strict();

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type Plain =
  Record<string, unknown>;



/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function isPlain(
  value: unknown
): value is Plain {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function mergeSettings(
  existing: unknown,
  incoming: Plain
): Plain {
  const base =
    isPlain(existing)
      ? existing
      : {};

  const merged: Plain = {
    ...base,
    ...incoming,
  };

  if (
    isPlain(base.notifications) &&
    isPlain(incoming.notifications)
  ) {
    merged.notifications = {
      ...base.notifications,
      ...incoming.notifications,
    };
  }

  return merged;
}

function noStore<T extends Response>(
  response: T
): T {
  response.headers.set(
    'Cache-Control',
    'private, no-store, max-age=0'
  );

  response.headers.set(
    'Pragma',
    'no-cache'
  );

  return response;
}

function withMeta(
  row: Plain | null
) {
  if (!row) {
    return null;
  }

  const checks: Array<
    [string, boolean]
  > = [
    [
      'full_name',
      typeof row.full_name === 'string' &&
        row.full_name.trim().length >= 2,
    ],
    [
      'city',
      typeof row.city === 'string' &&
        row.city.trim().length >= 2,
    ],
    [
      'phone',
      typeof row.phone === 'string' &&
        row.phone.trim().length > 0,
    ],
  ];

  const missing =
    checks
      .filter(
        ([, valid]) => !valid
      )
      .map(([field]) => field);

  const profile_completion =
    Math.round(
      ((checks.length - missing.length) /
        checks.length) *
        100
    );

  return {
    ...row,
    profile_completion,
    missing,
  };
}

/* -------------------------------------------------------------------------- */
/* Rate limiting                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Best-effort per-instance limiter.
 *
 * This protects the endpoint from accidental rapid writes.
 * For multi-instance production scaling, replace with Redis/Upstash.
 */

const requestHits =
  new Map<string, number[]>();

function isRateLimited(
  userId: string
): boolean {
  const now = Date.now();

  const recent =
    (
      requestHits.get(userId) ?? []
    ).filter(
      (timestamp) =>
        now - timestamp <
        RATE_WINDOW_MS
    );

  if (
    recent.length >=
    RATE_LIMIT
  ) {
    requestHits.set(
      userId,
      recent
    );

    return true;
  }

  recent.push(now);

  requestHits.set(
    userId,
    recent
  );

  if (
    requestHits.size > 5000
  ) {
    for (
      const [
        key,
        timestamps,
      ] of requestHits
    ) {
      if (
        timestamps.every(
          (timestamp) =>
            now - timestamp >=
            RATE_WINDOW_MS
        )
      ) {
        requestHits.delete(key);
      }
    }
  }

  return false;
}

/* -------------------------------------------------------------------------- */
/* GET                                                                        */
/* -------------------------------------------------------------------------- */

export async function GET(
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

  /**
   * `requireSupabaseAuth()` has already:
   *
   * 1. validated the Supabase token
   * 2. identified the user
   * 3. loaded the profile
   *
   * Do not query the profile again with the
   * user-scoped Supabase client.
   *
   * That second query was the source of the
   * unnecessary 502 path in the old implementation.
   */

  const profile =
    auth.ctx.profile as typeof auth.ctx.profile & {
      settings?: unknown;
    };

  const data = {
    id: profile.id,
    full_name: profile.full_name,
    city: profile.city,
    phone: profile.phone,
    created_at: profile.created_at,
    settings:
      profile.settings ?? null,
  };

  return noStore(
    jsonOk(
      withMeta(
        data as Plain
      )
    )
  );
}

/* -------------------------------------------------------------------------- */
/* UPDATE                                                                     */
/* -------------------------------------------------------------------------- */

async function update(
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

  const userId =
    auth.ctx.profile.id;

  /**
   * Authentication and role validation
   * are already complete before using
   * the service-role client.
   */
  const admin =
    createServiceClient();

  if (
    isRateLimited(userId)
  ) {
    return jsonErr(
      'Too many updates. Please wait a minute and try again.',
      429
    );
  }

  /* ----------------------------- Body size ----------------------------- */

  const declaredLength =
    Number(
      req.headers.get(
        'content-length'
      ) ?? 0
    );

  if (
    Number.isFinite(
      declaredLength
    ) &&
    declaredLength >
      MAX_BODY_BYTES
  ) {
    return jsonErr(
      'Request too large',
      413
    );
  }

  /* ------------------------------ JSON -------------------------------- */

  let raw: unknown;

  try {
    const bodyText =
      await req.text();

    const byteLength =
      new TextEncoder().encode(
        bodyText
      ).byteLength;

    if (
      byteLength >
      MAX_BODY_BYTES
    ) {
      return jsonErr(
        'Request too large',
        413
      );
    }

    raw =
      JSON.parse(
        bodyText
      ) as unknown;
  } catch {
    return jsonErr(
      'Invalid JSON body',
      400
    );
  }

  /* ---------------------------- Validation ----------------------------- */

  const parsed =
    bodySchema.safeParse(
      raw
    );

  if (!parsed.success) {
    const issue =
      parsed.error.issues[0];

    const field =
      issue?.path?.length
        ? `${issue.path.join('.')}: `
        : '';

    return jsonErr(
      `${field}${issue?.message ?? 'Invalid payload'}`,
      422
    );
  }

  /* ----------------------------- Patch -------------------------------- */

  const patch: Plain = {};

  if (
    parsed.data.full_name !==
    undefined
  ) {
    patch.full_name =
      parsed.data.full_name;
  }

  if (
    parsed.data.city !==
    undefined
  ) {
    patch.city =
      parsed.data.city;
  }

  /* ----------------------------- Settings ----------------------------- */

  if (
    parsed.data.settings !==
    undefined
  ) {
    /**
     * Read current settings with the
     * server-side client so unrelated
     * preferences are not accidentally lost.
     */
    const {
      data: current,
      error: readError,
    } = await admin
      .from('profiles')
      .select('settings')
      .eq(
        'id',
        userId
      )
      .maybeSingle();

    if (readError) {
      console.error(
        '[customer/profile] settings read failed:',
        readError.message
      );

      return jsonErr(
        'Could not save your preferences. Please try again.',
        500
      );
    }

    const merged =
      mergeSettings(
        (
          current as
            Plain | null
        )?.settings,
        parsed.data
          .settings as Plain
      );

    if (
      JSON.stringify(
        merged
      ).length >
      MAX_SETTINGS_BYTES
    ) {
      return jsonErr(
        'Settings are too large',
        413
      );
    }

    patch.settings =
      merged;
  }

  /* -------------------------- Empty update ---------------------------- */

  if (
    Object.keys(patch)
      .length === 0
  ) {
    return jsonErr(
      'Nothing to update',
      400
    );
  }

  /* ----------------------------- UPDATE ------------------------------- */

  const {
    data,
    error,
  } = await admin
    .from('profiles')
    .update(patch)
    .eq(
      'id',
      userId
    )
    .select(
      PROFILE_COLUMNS
    )
    .single();

  if (error) {
    console.error(
      '[customer/profile] update failed:',
      error.message
    );

    return jsonErr(
      'Could not save your profile. Please try again.',
      500
    );
  }

  return noStore(
    jsonOk(
      withMeta(
        data as Plain
      )
    )
  );
}

/* -------------------------------------------------------------------------- */
/* HTTP methods                                                               */
/* -------------------------------------------------------------------------- */

export const PUT =
  update;

export const PATCH =
  update;
