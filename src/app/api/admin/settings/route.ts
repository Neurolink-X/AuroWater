import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { jsonErr } from '@/lib/api/json-response';
import { rowsToSettingsPayload } from '@/lib/api/settings-map';
import {
  requireAdmin,
  requireSupabaseAuth,
} from '@/lib/api/supabase-request';

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const MAX_KEYS_PER_REQUEST = 50;
const MAX_KEY_LENGTH = 100;

const SETTINGS_KEY_PATTERN =
  /^[a-z][a-z0-9_]*$/;

type SettingType =
  | 'number'
  | 'string'
  | 'boolean';

interface SettingMeta {
  type: SettingType;
  label: string;
  min?: number;
  max?: number;
  maxLength?: number;
  pattern?: RegExp;
}

/**
 * These are the only settings that the Admin Control Center
 * is allowed to modify through this endpoint.
 *
 * Do not add arbitrary keys here without deciding:
 * - business meaning
 * - allowed range
 * - frontend usage
 * - production impact
 */
export const SETTINGS_SCHEMA: Record<
  string,
  SettingMeta
> = {
  platform_fee: {
    type: 'number',
    min: 0,
    max: 100,
    label: 'Platform fee (₹)',
  },

  default_can_price: {
    type: 'number',
    min: 1,
    max: 500,
    label: 'Default can price (₹)',
  },

  chilled_can_price: {
    type: 'number',
    min: 1,
    max: 500,
    label: 'Chilled 20L can price (₹)',
  },

  subscription_can_price: {
    type: 'number',
    min: 1,
    max: 500,
    label: 'Recurring can price (₹)',
  },

  bulk_can_price: {
    type: 'number',
    min: 1,
    max: 500,
    label: 'Bulk can price (₹)',
  },

  bulk_threshold: {
    type: 'number',
    min: 2,
    max: 200,
    label: 'Bulk price threshold (cans)',
  },

  market_can_price: {
    type: 'number',
    min: 1,
    max: 1000,
    label: 'Reference market price (₹)',
  },

  convenience_fee: {
    type: 'number',
    min: 0,
    max: 500,
    label: 'Order handling fee (₹)',
  },

  min_can_price: {
    type: 'number',
    min: 1,
    max: 500,
    label: 'Minimum can price (₹)',
  },

  max_can_price: {
    type: 'number',
    min: 1,
    max: 1000,
    label: 'Maximum can price (₹)',
  },

  plumber_booking_fee: {
    type: 'number',
    min: 0,
    max: 5000,
    label: 'Plumber booking fee (₹)',
  },

  supplier_commission: {
    type: 'number',
    min: 0,
    max: 50,
    label: 'Supplier commission (%)',
  },

  bulk_commission: {
    type: 'number',
    min: 0,
    max: 50,
    label: 'Bulk commission (%)',
  },

  service_radius_km: {
    type: 'number',
    min: 1,
    max: 100,
    label: 'Service radius (km)',
  },

  max_cans_per_order: {
    type: 'number',
    min: 1,
    max: 500,
    label: 'Maximum cans per order',
  },

  emergency_surcharge: {
    type: 'number',
    min: 0,
    max: 500,
    label: 'Emergency surcharge (₹)',
  },

  support_phone: {
    type: 'string',
    maxLength: 10,
    pattern: /^\d{10}$/,
    label: 'Support phone',
  },

  support_email: {
    type: 'string',
    maxLength: 254,
    pattern:
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    label: 'Support email',
  },

  whatsapp_number: {
    type: 'string',
    maxLength: 10,
    pattern: /^\d{10}$/,
    label: 'WhatsApp number',
  },

  maintenance_mode: {
    type: 'boolean',
    label: 'Maintenance mode',
  },

  auto_assign_orders: {
    type: 'boolean',
    label: 'Auto-assign orders',
  },
};

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type ValidSetting = {
  ok: true;
  value: string;
};

type InvalidSetting = {
  ok: false;
  error: string;
};

type SettingResult =
  | ValidSetting
  | InvalidSetting;

type SettingRow = {
  key: string;
  value: string;
  updated_at: string;
};

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

function validateSetting(
  key: string,
  raw: unknown,
): SettingResult {
  const meta =
    SETTINGS_SCHEMA[key];

  /*
   * Unknown keys are intentionally rejected.
   *
   * This prevents accidental configuration
   * pollution through the Admin API.
   */
  if (!meta) {
    return {
      ok: false,
      error: 'Unknown setting key',
    };
  }

  switch (meta.type) {
    case 'number': {
      if (
        typeof raw !== 'number' ||
        !Number.isFinite(raw)
      ) {
        return {
          ok: false,
          error: `${meta.label} must be a valid number`,
        };
      }

      if (
        meta.min !== undefined &&
        raw < meta.min
      ) {
        return {
          ok: false,
          error: `${meta.label} must be at least ${meta.min}`,
        };
      }

      if (
        meta.max !== undefined &&
        raw > meta.max
      ) {
        return {
          ok: false,
          error: `${meta.label} must be at most ${meta.max}`,
        };
      }

      if (key === 'bulk_threshold' && !Number.isInteger(raw)) {
        return {
          ok: false,
          error: 'Bulk price threshold must be a whole number of cans',
        };
      }

      return {
        ok: true,
        value: String(raw),
      };
    }

    case 'boolean': {
      /*
       * Do NOT accept:
       * "true"
       * "false"
       * 1
       * 0
       *
       * The API contract is JSON boolean.
       */
      if (typeof raw !== 'boolean') {
        return {
          ok: false,
          error: `${meta.label} must be true or false`,
        };
      }

      return {
        ok: true,
        value: raw
          ? 'true'
          : 'false',
      };
    }

    case 'string': {
      if (typeof raw !== 'string') {
        return {
          ok: false,
          error: `${meta.label} must be a string`,
        };
      }

      const value = raw.trim();

      if (!value) {
        return {
          ok: false,
          error: `${meta.label} cannot be empty`,
        };
      }

      if (
        meta.maxLength !== undefined &&
        value.length >
          meta.maxLength
      ) {
        return {
          ok: false,
          error: `${meta.label} is too long`,
        };
      }

      if (
        meta.pattern &&
        !meta.pattern.test(value)
      ) {
        return {
          ok: false,
          error: `${meta.label} has an invalid format`,
        };
      }

      return {
        ok: true,
        value,
      };
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Cross-setting business validation                                          */
/* -------------------------------------------------------------------------- */

function validateBusinessRules(
  values: Map<string, string>,
): InvalidSetting | null {
  const minCanPrice =
    values.has('min_can_price')
      ? Number(
          values.get(
            'min_can_price',
          ),
        )
      : null;

  const defaultCanPrice =
    values.has(
      'default_can_price',
    )
      ? Number(
          values.get(
            'default_can_price',
          ),
        )
      : null;

  const maxCanPrice =
    values.has('max_can_price')
      ? Number(
          values.get(
            'max_can_price',
          ),
        )
      : null;

  if (
    minCanPrice !== null &&
    defaultCanPrice !== null &&
    defaultCanPrice <
      minCanPrice
  ) {
    return {
      ok: false,
      error:
        'Default can price cannot be lower than minimum can price',
    };
  }

  if (
    defaultCanPrice !== null &&
    maxCanPrice !== null &&
    defaultCanPrice >
      maxCanPrice
  ) {
    return {
      ok: false,
      error:
        'Default can price cannot be higher than maximum can price',
    };
  }

  if (
    minCanPrice !== null &&
    maxCanPrice !== null &&
    minCanPrice >
      maxCanPrice
  ) {
    return {
      ok: false,
      error:
        'Minimum can price cannot be higher than maximum can price',
    };
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* ETag                                                                       */
/* -------------------------------------------------------------------------- */

function createEtag(
  payload: unknown,
): string {
  return `"${createHash('sha256')
    .update(
      JSON.stringify(payload),
    )
    .digest('hex')
    .slice(0, 24)}"`;
}

/* -------------------------------------------------------------------------- */
/* Audit log                                                                  */
/* -------------------------------------------------------------------------- */

async function writeAuditLog(
  sb: SupabaseClient,
  adminId: string,
  changes: Array<{
    key: string;
    old_value: string | null;
    new_value: string;
  }>,
): Promise<void> {
  if (!changes.length) {
    return;
  }

  const { error } =
    await sb
      .from('audit_logs')
      .insert(
        changes.map(
          (change) => ({
            actor_id: adminId,
            action:
              'settings.update',
            entity: 'settings',
            entity_id:
              change.key,
            meta: {
              old:
                change.old_value,
              new:
                change.new_value,
            },
          }),
        ),
      );

  if (error) {
    /*
     * Settings have already been saved.
     * Do not report the operation as failed
     * only because the audit write failed.
     *
     * Keep the failure visible to server logs.
     */
    console.error(
      '[admin/settings] audit log failed:',
      error.message,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* JSON body                                                                  */
/* -------------------------------------------------------------------------- */

async function readJsonBody(
  req: NextRequest,
): Promise<
  | {
      ok: true;
      body: Record<
        string,
        unknown
      >;
    }
  | {
      ok: false;
    }
> {
  try {
    const body =
      (await req.json()) as unknown;

    if (
      !body ||
      typeof body !==
        'object' ||
      Array.isArray(body)
    ) {
      return {
        ok: false,
      };
    }

    return {
      ok: true,
      body:
        body as Record<
          string,
          unknown
        >,
    };
  } catch {
    return {
      ok: false,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* GET                                                                        */
/* -------------------------------------------------------------------------- */

export async function GET(
  req: NextRequest,
) {
  const auth =
    await requireSupabaseAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  if (!requireAdmin(auth.ctx)) {
    return jsonErr(
      'Forbidden',
      403,
    );
  }

  const {
    data,
    error,
  } = await auth.ctx.supabase
    .from('settings')
    .select(
      'key, value, updated_at',
    )
    .order(
      'key',
      {
        ascending: true,
      },
    );

  if (error) {
    return jsonErr(
      error.message,
      502,
    );
  }

  const payload =
    rowsToSettingsPayload(
      data ?? [],
    );

  const etag =
    createEtag(payload);

  /*
   * Conditional request.
   *
   * Admin dashboards polling settings
   * can avoid downloading the same payload.
   */
  if (
    req.headers.get(
      'if-none-match',
    ) === etag
  ) {
    return new NextResponse(
      null,
      {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control':
            'private, no-cache',
        },
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      data: payload,
    },
    {
      status: 200,
      headers: {
        ETag: etag,
        'Cache-Control':
          'private, no-cache',
      },
    },
  );
}

/* -------------------------------------------------------------------------- */
/* PUT                                                                        */
/* -------------------------------------------------------------------------- */

export async function PUT(
  req: NextRequest,
) {
  const auth =
    await requireSupabaseAuth(req);

  if (!auth.ok) {
    return auth.response;
  }

  if (!requireAdmin(auth.ctx)) {
    return jsonErr(
      'Forbidden',
      403,
    );
  }

  const parsedBody =
    await readJsonBody(req);

  if (!parsedBody.ok) {
    return jsonErr(
      'Invalid JSON body. Expected an object.',
      400,
    );
  }

  const entries =
    Object.entries(
      parsedBody.body,
    );

  if (!entries.length) {
    return jsonErr(
      'Body must contain at least one setting',
      400,
    );
  }

  if (
    entries.length >
    MAX_KEYS_PER_REQUEST
  ) {
    return jsonErr(
      `Too many settings. Maximum is ${MAX_KEYS_PER_REQUEST}.`,
      400,
    );
  }

  /*
   * Validate setting key names.
   */
  for (const [
    key,
  ] of entries) {
    if (
      key.length >
      MAX_KEY_LENGTH
    ) {
      return jsonErr(
        `Setting key "${key}" is too long`,
        400,
      );
    }

    if (
      !SETTINGS_KEY_PATTERN.test(
        key,
      )
    ) {
      return jsonErr(
        `Invalid setting key "${key}"`,
        400,
      );
    }
  }

  const validRows: SettingRow[] =
    [];

  const invalidKeys: Array<{
    key: string;
    error: string;
  }> = [];

  /*
   * Validate individual settings.
   */
  for (const [
    key,
    raw,
  ] of entries) {
    const result =
      validateSetting(
        key,
        raw,
      );

    if (result.ok) {
      validRows.push({
        key,
        value:
          result.value,
        updated_at:
          new Date().toISOString(),
      });
    } else {
      invalidKeys.push({
        key,
        error:
          result.error,
      });
    }
  }

  /*
   * If every setting is invalid,
   * do not touch the database.
   */
  if (!validRows.length) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'All settings failed validation',
        invalid:
          invalidKeys,
      },
      {
        status: 422,
      },
    );
  }

  const sb =
    auth.ctx.supabase;

  /*
   * Read current values.
   *
   * We need them for:
   * - change detection
   * - audit logging
   * - cross-setting validation
   */
  const {
    data: oldRows,
    error: oldError,
  } = await sb
    .from('settings')
    .select(
      'key, value',
    )
    .in(
      'key',
      validRows.map(
        (row) => row.key,
      ),
    );

  if (oldError) {
    return jsonErr(
      oldError.message,
      502,
    );
  }

  const currentValues =
    new Map<string, string>();

  for (const row of
    oldRows ?? []) {
    currentValues.set(
      String(row.key),
      String(row.value),
    );
  }

  /*
   * Build a complete configuration map:
   *
   * existing values +
   * incoming values.
   *
   * This lets us validate relationships
   * even when the admin changes only one
   * side of a related setting.
   */
  const finalValues =
    new Map(
      currentValues,
    );

  for (const row of
    validRows) {
    finalValues.set(
      row.key,
      row.value,
    );
  }

  /*
   * Cross-setting validation.
   */
  const businessError =
    validateBusinessRules(
      finalValues,
    );

  if (businessError) {
    return NextResponse.json(
      {
        ok: false,
        error:
          businessError.error,
      },
      {
        status: 422,
      },
    );
  }

  /*
   * Only write values that actually changed.
   */
  const changedRows =
    validRows.filter(
      (row) =>
        currentValues.get(
          row.key,
        ) !== row.value,
    );

  /*
   * Nothing changed.
   */
  if (!changedRows.length) {
    const {
      data: latestRows,
      error: latestError,
    } = await sb
      .from('settings')
      .select(
        'key, value, updated_at',
      )
      .order(
        'key',
        {
          ascending: true,
        },
      );

    if (latestError) {
      return jsonErr(
        latestError.message,
        502,
      );
    }

    return NextResponse.json(
      {
        ok: true,

        data:
          rowsToSettingsPayload(
            latestRows ?? [],
          ),

        saved: [],

        unchanged:
          validRows.map(
            (row) => row.key,
          ),

        ...(invalidKeys.length
          ? {
              invalid:
                invalidKeys,
            }
          : {}),
      },
      {
        status: 200,
      },
    );
  }

  /*
   * Save changed settings.
   */
  const {
    error: upsertError,
  } = await sb
    .from('settings')
    .upsert(
      changedRows,
      {
        onConflict: 'key',
      },
    );

  if (upsertError) {
    return jsonErr(
      upsertError.message,
      502,
    );
  }

  /*
   * Audit every actual change.
   */
  await writeAuditLog(
    sb,
    auth.ctx.user?.id ??
      'unknown',
    changedRows.map(
      (row) => ({
        key: row.key,
        old_value:
          currentValues.get(
            row.key,
          ) ?? null,
        new_value:
          row.value,
      }),
    ),
  );

  /*
   * Return the authoritative
   * database state after the update.
   */
  const {
    data: latestRows,
    error: latestError,
  } = await sb
    .from('settings')
    .select(
      'key, value, updated_at',
    )
    .order(
      'key',
      {
        ascending: true,
      },
    );

  if (latestError) {
    return jsonErr(
      latestError.message,
      502,
    );
  }

  return NextResponse.json(
    {
      ok: true,

      data:
        rowsToSettingsPayload(
          latestRows ?? [],
        ),

      saved:
        changedRows.map(
          (row) => row.key,
        ),

      unchanged:
        validRows
          .filter(
            (row) =>
              !changedRows.some(
                (changed) =>
                  changed.key ===
                  row.key,
              ),
          )
          .map(
            (row) => row.key,
          ),

      ...(invalidKeys.length
        ? {
            invalid:
              invalidKeys,
          }
        : {}),
    },
    {
      status: 200,
    },
  );
}
