import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  jsonErr,
  jsonOk,
} from '@/lib/api/json-response';
import {
  requireAdmin,
  requireSupabaseAuth,
} from '@/lib/api/supabase-request';

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_UNIT_LENGTH = 80;
const MAX_KEY_LENGTH = 80;
const MAX_SORT_ORDER = 1_000_000;

/* -------------------------------------------------------------------------- */
/* Schemas                                                                    */
/* -------------------------------------------------------------------------- */

const createSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(MAX_KEY_LENGTH)
    .regex(
      /^[a-z0-9_]+$/,
      'Key may contain only lowercase letters, numbers, and underscores',
    )
    .optional(),

  name: z
    .string()
    .trim()
    .min(1)
    .max(MAX_NAME_LENGTH),

  description: z
    .string()
    .trim()
    .max(MAX_DESCRIPTION_LENGTH)
    .optional(),

  base_price: z
    .number()
    .finite()
    .nonnegative(),

  unit: z
    .string()
    .trim()
    .min(1)
    .max(MAX_UNIT_LENGTH)
    .optional(),

  is_active: z
    .boolean()
    .optional(),

  sort_order: z
    .number()
    .int()
    .min(0)
    .max(MAX_SORT_ORDER)
    .optional(),
});

const updateSchema = z.object({
  id: z
    .number()
    .int()
    .positive(),

  key: z
    .string()
    .trim()
    .min(1)
    .max(MAX_KEY_LENGTH)
    .regex(
      /^[a-z0-9_]+$/,
      'Key may contain only lowercase letters, numbers, and underscores',
    )
    .optional(),

  name: z
    .string()
    .trim()
    .min(1)
    .max(MAX_NAME_LENGTH)
    .optional(),

  description: z
    .string()
    .trim()
    .max(MAX_DESCRIPTION_LENGTH)
    .nullable()
    .optional(),

  base_price: z
    .number()
    .finite()
    .nonnegative()
    .optional(),

  unit: z
    .string()
    .trim()
    .min(1)
    .max(MAX_UNIT_LENGTH)
    .optional(),

  is_active: z
    .boolean()
    .optional(),

  sort_order: z
    .number()
    .int()
    .min(0)
    .max(MAX_SORT_ORDER)
    .optional(),
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function generateKey(name: string): string {
  const key = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  return key.slice(0, MAX_KEY_LENGTH);
}

function parseId(raw: string | null): number | null {
  if (!raw?.trim()) {
    return null;
  }

  const id = Number(raw);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
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

  const { data, error } =
    await auth.ctx.supabase
      .from('service_types')
      .select('*')
      .order(
        'sort_order',
        {
          ascending: true,
        },
      )
      .order(
        'name',
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

  return jsonOk(
    data ?? [],
  );
}

/* -------------------------------------------------------------------------- */
/* POST                                                                       */
/* -------------------------------------------------------------------------- */

export async function POST(
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
    createSchema.safeParse(raw);

  if (!parsed.success) {
    return jsonErr(
      parsed.error.issues[0]
        ?.message ??
        'Invalid payload',
      422,
    );
  }

  const name =
    parsed.data.name.trim();

  const key =
    parsed.data.key ??
    generateKey(name);

  if (!key) {
    return jsonErr(
      'Unable to generate a valid service key',
      422,
    );
  }

  try {
    /*
     * Check duplicate key before insert.
     */
    const {
      data: existingKey,
      error: keyCheckError,
    } = await auth.ctx.supabase
      .from('service_types')
      .select('id')
      .eq('key', key)
      .maybeSingle();

    if (keyCheckError) {
      return jsonErr(
        keyCheckError.message,
        502,
      );
    }

    if (existingKey) {
      return jsonErr(
        'A service with this key already exists',
        409,
      );
    }

    /*
     * Check duplicate name.
     */
    const {
      data: existingName,
      error: nameCheckError,
    } = await auth.ctx.supabase
      .from('service_types')
      .select('id')
      .ilike('name', name)
      .maybeSingle();

    if (nameCheckError) {
      return jsonErr(
        nameCheckError.message,
        502,
      );
    }

    if (existingName) {
      return jsonErr(
        'A service with this name already exists',
        409,
      );
    }

    const { data, error } =
      await auth.ctx.supabase
        .from('service_types')
        .insert({
          key,
          name,

          description:
            parsed.data.description?.trim() ??
            null,

          base_price:
            parsed.data.base_price,

          unit:
            parsed.data.unit?.trim() ??
            'per visit',

          is_active:
            parsed.data.is_active ??
            true,

          sort_order:
            parsed.data.sort_order ??
            0,
        })
        .select('*')
        .single();

    if (error) {
      /*
       * Database unique constraints can still
       * catch a race condition between the
       * duplicate check and insert.
       */
      if (
        error.code === '23505'
      ) {
        return jsonErr(
          'A service with this key already exists',
          409,
        );
      }

      return jsonErr(
        error.message,
        502,
      );
    }

    return jsonOk(
      data,
      201,
    );
  } catch (error: unknown) {
    return jsonErr(
      error instanceof Error
        ? error.message
        : 'Failed to create service',
      502,
    );
  }
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
    updateSchema.safeParse(raw);

  if (!parsed.success) {
    return jsonErr(
      parsed.error.issues[0]
        ?.message ??
        'Invalid payload',
      422,
    );
  }

  const {
    id,
    ...fields
  } = parsed.data;

  if (
    Object.keys(fields).length === 0
  ) {
    return jsonErr(
      'No fields to update',
      400,
    );
  }

  try {
    /*
     * Check service exists first.
     */
    const {
      data: existing,
      error: existingError,
    } = await auth.ctx.supabase
      .from('service_types')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (existingError) {
      return jsonErr(
        existingError.message,
        502,
      );
    }

    if (!existing) {
      return jsonErr(
        'Service not found',
        404,
      );
    }

    /*
     * Check duplicate key if key changes.
     */
    if (fields.key) {
      const {
        data: duplicateKey,
        error: keyError,
      } = await auth.ctx.supabase
        .from('service_types')
        .select('id')
        .eq('key', fields.key)
        .neq('id', id)
        .maybeSingle();

      if (keyError) {
        return jsonErr(
          keyError.message,
          502,
        );
      }

      if (duplicateKey) {
        return jsonErr(
          'A service with this key already exists',
          409,
        );
      }
    }

    /*
     * Check duplicate name if name changes.
     */
    if (fields.name) {
      const {
        data: duplicateName,
        error: nameError,
      } = await auth.ctx.supabase
        .from('service_types')
        .select('id')
        .ilike(
          'name',
          fields.name,
        )
        .neq('id', id)
        .maybeSingle();

      if (nameError) {
        return jsonErr(
          nameError.message,
          502,
        );
      }

      if (duplicateName) {
        return jsonErr(
          'A service with this name already exists',
          409,
        );
      }
    }

    const {
      data,
      error,
    } = await auth.ctx.supabase
      .from('service_types')
      .update(fields)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      if (
        error.code === '23505'
      ) {
        return jsonErr(
          'A service with this key already exists',
          409,
        );
      }

      return jsonErr(
        error.message,
        502,
      );
    }

    if (!data) {
      return jsonErr(
        'Service not found',
        404,
      );
    }

    return jsonOk(
      data,
    );
  } catch (error: unknown) {
    return jsonErr(
      error instanceof Error
        ? error.message
        : 'Failed to update service',
      502,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* DELETE                                                                     */
/* -------------------------------------------------------------------------- */

export async function DELETE(
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

  const id =
    parseId(
      new URL(req.url)
        .searchParams
        .get('id'),
    );

  if (!id) {
    return jsonErr(
      'Valid id is required',
      400,
    );
  }

  try {
    /*
     * Confirm service exists.
     */
    const {
      data: service,
      error: serviceError,
    } = await auth.ctx.supabase
      .from('service_types')
      .select('id, key, name')
      .eq('id', id)
      .maybeSingle();

    if (serviceError) {
      return jsonErr(
        serviceError.message,
        502,
      );
    }

    if (!service) {
      return jsonErr(
        'Service not found',
        404,
      );
    }

    /*
     * Do not physically delete a service that
     * is referenced by pricing rules.
     *
     * Pricing rules are currently stored in
     * settings as JSON, so inspect them safely.
     */
    const {
      data: pricingSettings,
      error: pricingError,
    } = await auth.ctx.supabase
      .from('settings')
      .select('value')
      .eq('key', 'pricing_rules')
      .maybeSingle();

    if (pricingError) {
      return jsonErr(
        pricingError.message,
        502,
      );
    }

    if (pricingSettings?.value) {
      try {
        const pricingRules =
          JSON.parse(
            String(
              pricingSettings.value,
            ),
          ) as unknown;

        if (
          Array.isArray(
            pricingRules,
          )
        ) {
          const referenced =
            pricingRules.some(
              (rule) =>
                rule &&
                typeof rule ===
                  'object' &&
                Number(
                  (
                    rule as Record<
                      string,
                      unknown
                    >
                  )
                    .service_type_id,
                ) === id,
            );

          if (referenced) {
            return jsonErr(
              'This service is used by pricing rules. Deactivate it instead of deleting it.',
              409,
            );
          }
        }
      } catch {
        /*
         * Do not block service deletion solely
         * because pricing configuration is malformed.
         *
         * The pricing API will report the configuration
         * problem separately.
         */
      }
    }

    /*
     * Prefer soft deletion for production.
     *
     * Existing orders/history should continue
     * referring to the service.
     */
    const {
      data,
      error,
    } = await auth.ctx.supabase
      .from('service_types')
      .update({
        is_active: false,
      })
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      return jsonErr(
        error.message,
        502,
      );
    }

    if (!data) {
      return jsonErr(
        'Service not found',
        404,
      );
    }

    return jsonOk({
      deleted: false,
      deactivated: true,
      service: data,
    });
  } catch (error: unknown) {
    return jsonErr(
      error instanceof Error
        ? error.message
        : 'Failed to deactivate service',
      502,
    );
  }
}
