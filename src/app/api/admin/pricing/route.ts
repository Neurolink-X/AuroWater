import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import {
  requireAdmin,
  requireSupabaseAuth,
} from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';

const PRICING_KEY = 'pricing_rules';

const ruleSchema = z.object({
  id: z.string().uuid().optional(),

  service_type_id: z
    .number()
    .int()
    .positive(),

  zone_id: z
    .string()
    .uuid()
    .nullable()
    .optional(),

  base_price: z
    .number()
    .finite()
    .nonnegative(),

  distance_multiplier: z
    .number()
    .finite()
    .nonnegative()
    .default(1),

  tax_percentage: z
    .number()
    .finite()
    .min(0)
    .max(100)
    .default(0),

  min_order_value: z
    .number()
    .finite()
    .nonnegative()
    .default(0),

  emergency_charge: z
    .number()
    .finite()
    .nonnegative()
    .default(0),
});

type PricingRule = z.infer<typeof ruleSchema> & {
  id: string;
};

type PricingRuleWithNames = PricingRule & {
  service_name: string | null;
  zone_name: string | null;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function normaliseRule(
  input: z.infer<typeof ruleSchema>,
): PricingRule {
  return {
    id: input.id ?? crypto.randomUUID(),

    service_type_id: input.service_type_id,

    zone_id: input.zone_id ?? null,

    base_price: input.base_price,

    distance_multiplier:
      input.distance_multiplier ?? 1,

    tax_percentage:
      input.tax_percentage ?? 0,

    min_order_value:
      input.min_order_value ?? 0,

    emergency_charge:
      input.emergency_charge ?? 0,
  };
}

function validateNoDuplicateRule(
  rules: PricingRule[],
  candidate: PricingRule,
  ignoreId?: string,
): string | null {
  const duplicate = rules.find(
    (rule) =>
      rule.id !== ignoreId &&
      rule.service_type_id ===
        candidate.service_type_id &&
      (rule.zone_id ?? null) ===
        (candidate.zone_id ?? null),
  );

  if (duplicate) {
    return (
      'A pricing rule already exists for this service and zone.'
    );
  }

  return null;
}

async function loadRules(
  sb: ReturnType<
    typeof import('@/lib/db/supabase').createSupabaseUserClient
  >,
): Promise<PricingRule[]> {
  const { data, error } = await sb
    .from('settings')
    .select('value')
    .eq('key', PRICING_KEY)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(
      String(data.value),
    );

    if (!Array.isArray(parsed)) {
      return [];
    }

    const rules: PricingRule[] = [];

    for (const item of parsed) {
      const result = ruleSchema.safeParse(item);

      if (!result.success) {
        continue;
      }

      rules.push(
        normaliseRule(result.data),
      );
    }

    return rules;
  } catch {
    throw new Error(
      'Pricing configuration is corrupted or invalid.',
    );
  }
}

async function saveRules(
  rules: PricingRule[],
): Promise<void> {
  const admin = createServiceClient();

  const { error } = await admin
    .from('settings')
    .upsert(
      {
        key: PRICING_KEY,
        value: JSON.stringify(rules),
        updated_at:
          new Date().toISOString(),
      },
      {
        onConflict: 'key',
      },
    );

  if (error) {
    throw new Error(error.message);
  }
}

async function validateReferences(
  sb: ReturnType<
    typeof import('@/lib/db/supabase').createSupabaseUserClient
  >,
  rule: PricingRule,
): Promise<string | null> {
  /*
   * Validate service type.
   */
  const {
    data: serviceType,
    error: serviceError,
  } = await sb
    .from('service_types')
    .select('id')
    .eq('id', rule.service_type_id)
    .maybeSingle();

  if (serviceError) {
    throw new Error(
      serviceError.message,
    );
  }

  if (!serviceType) {
    return 'Service type not found.';
  }

  /*
   * Validate zone when supplied.
   *
   * null means the rule applies to all zones.
   */
  if (rule.zone_id) {
    const {
      data: zone,
      error: zoneError,
    } = await sb
      .from('service_zones')
      .select('id')
      .eq('id', rule.zone_id)
      .maybeSingle();

    if (zoneError) {
      throw new Error(
        zoneError.message,
      );
    }

    if (!zone) {
      return 'Service zone not found.';
    }
  }

  return null;
}

async function enrichRules(
  sb: ReturnType<
    typeof import('@/lib/db/supabase').createSupabaseUserClient
  >,
  rules: PricingRule[],
): Promise<PricingRuleWithNames[]> {
  const serviceIds = [
    ...new Set(
      rules.map(
        (rule) =>
          rule.service_type_id,
      ),
    ),
  ];

  const zoneIds = [
    ...new Set(
      rules
        .map((rule) => rule.zone_id)
        .filter(
          (
            id,
          ): id is string =>
            Boolean(id),
        ),
    ),
  ];

  const [
    servicesResult,
    zonesResult,
  ] = await Promise.all([
    serviceIds.length
      ? sb
          .from('service_types')
          .select('id, name')
          .in('id', serviceIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    zoneIds.length
      ? sb
          .from('service_zones')
          .select('id, name')
          .in('id', zoneIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  if (servicesResult.error) {
    throw new Error(
      servicesResult.error.message,
    );
  }

  if (zonesResult.error) {
    throw new Error(
      zonesResult.error.message,
    );
  }

  const serviceNames = new Map(
    (servicesResult.data ?? []).map(
      (item) => [
        Number(item.id),
        String(item.name),
      ],
    ),
  );

  const zoneNames = new Map(
    (zonesResult.data ?? []).map(
      (item) => [
        String(item.id),
        String(item.name),
      ],
    ),
  );

  return rules.map((rule) => ({
    ...rule,

    service_name:
      serviceNames.get(
        rule.service_type_id,
      ) ?? null,

    zone_name: rule.zone_id
      ? zoneNames.get(
          rule.zone_id,
        ) ?? null
      : 'All zones',
  }));
}

async function parseJsonBody(
  req: NextRequest,
): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
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

  try {
    const rules = await loadRules(
      auth.ctx.supabase,
    );

    const enriched =
      await enrichRules(
        auth.ctx.supabase,
        rules,
      );

    return jsonOk(enriched);
  } catch (error: unknown) {
    return jsonErr(
      error instanceof Error
        ? error.message
        : 'Failed to load pricing rules',
      502,
    );
  }
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

  const raw =
    await parseJsonBody(req);

  if (raw === null) {
    return jsonErr(
      'Invalid JSON body',
      400,
    );
  }

  const parsed =
    ruleSchema.safeParse(raw);

  if (!parsed.success) {
    return jsonErr(
      parsed.error.issues[0]
        ?.message ??
        'Invalid pricing rule',
      422,
    );
  }

  try {
    const rule =
      normaliseRule(
        parsed.data,
      );

    /*
     * Validate referenced service
     * and zone before saving.
     */
    const referenceError =
      await validateReferences(
        auth.ctx.supabase,
        rule,
      );

    if (referenceError) {
      return jsonErr(
        referenceError,
        422,
      );
    }

    const rules =
      await loadRules(
        auth.ctx.supabase,
      );

    /*
     * Prevent two rules for the
     * same service + zone.
     */
    const duplicateError =
      validateNoDuplicateRule(
        rules,
        rule,
      );

    if (duplicateError) {
      return jsonErr(
        duplicateError,
        409,
      );
    }

    rules.unshift(rule);

    await saveRules(rules);

    const [enriched] =
      await enrichRules(
        auth.ctx.supabase,
        [rule],
      );

    return jsonOk(
      enriched ?? rule,
      201,
    );
  } catch (error: unknown) {
    return jsonErr(
      error instanceof Error
        ? error.message
        : 'Failed to create pricing rule',
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

  const raw =
    await parseJsonBody(req);

  if (raw === null) {
    return jsonErr(
      'Invalid JSON body',
      400,
    );
  }

  const parsed =
    ruleSchema.safeParse(raw);

  if (!parsed.success) {
    return jsonErr(
      parsed.error.issues[0]
        ?.message ??
        'Invalid pricing rule',
      422,
    );
  }

  if (!parsed.data.id) {
    return jsonErr(
      'id is required',
      400,
    );
  }

  try {
    const updatedRule =
      normaliseRule(
        parsed.data,
      );

    /*
     * Validate referenced service
     * and zone before updating.
     */
    const referenceError =
      await validateReferences(
        auth.ctx.supabase,
        updatedRule,
      );

    if (referenceError) {
      return jsonErr(
        referenceError,
        422,
      );
    }

    const rules =
      await loadRules(
        auth.ctx.supabase,
      );

    const index =
      rules.findIndex(
        (rule) =>
          rule.id ===
          updatedRule.id,
      );

    if (index < 0) {
      return jsonErr(
        'Pricing rule not found',
        404,
      );
    }

    /*
     * Prevent duplicate service +
     * zone combinations.
     */
    const duplicateError =
      validateNoDuplicateRule(
        rules,
        updatedRule,
        updatedRule.id,
      );

    if (duplicateError) {
      return jsonErr(
        duplicateError,
        409,
      );
    }

    rules[index] =
      updatedRule;

    await saveRules(rules);

    const [enriched] =
      await enrichRules(
        auth.ctx.supabase,
        [updatedRule],
      );

    return jsonOk(
      enriched ?? updatedRule,
    );
  } catch (error: unknown) {
    return jsonErr(
      error instanceof Error
        ? error.message
        : 'Failed to update pricing rule',
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

  const { searchParams } =
    new URL(req.url);

  const id =
    searchParams
      .get('id')
      ?.trim();

  if (!id) {
    return jsonErr(
      'id is required',
      400,
    );
  }

  /*
   * Validate UUID before touching
   * the settings record.
   */
  const idCheck =
    z.string().uuid().safeParse(id);

  if (!idCheck.success) {
    return jsonErr(
      'Invalid pricing rule id',
      400,
    );
  }

  try {
    const rules =
      await loadRules(
        auth.ctx.supabase,
      );

    const index =
      rules.findIndex(
        (rule) =>
          rule.id === id,
      );

    if (index < 0) {
      return jsonErr(
        'Pricing rule not found',
        404,
      );
    }

    const [deleted] =
      rules.splice(
        index,
        1,
      );

    await saveRules(rules);

    return jsonOk({
      deleted: true,
      rule: deleted,
    });
  } catch (error: unknown) {
    return jsonErr(
      error instanceof Error
        ? error.message
        : 'Failed to delete pricing rule',
      502,
    );
  }
}
