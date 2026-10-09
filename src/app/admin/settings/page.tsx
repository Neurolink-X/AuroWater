'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { toast } from 'sonner';
import {
  adminSettingsGet,
  adminSettingsPut,
} from '@/lib/api-client';
import { safeRemove } from '@/lib/storage';

/**
 * Keys validated by PUT /api/admin/settings.
 *
 * IMPORTANT:
 * Keep these synchronized with the server SETTINGS_SCHEMA.
 */
const MANAGED_KEYS = [
  'default_can_price',
  'chilled_can_price',
  'subscription_can_price',
  'bulk_can_price',
  'bulk_threshold',
  'market_can_price',
  'convenience_fee',
  'min_can_price',
  'max_can_price',
  'platform_fee',
  'plumber_booking_fee',
  'supplier_commission',
  'bulk_commission',
  'service_radius_km',
  'max_cans_per_order',
  'emergency_surcharge',
  'support_phone',
  'support_email',
  'whatsapp_number',
  'maintenance_mode',
  'auto_assign_orders',
] as const;

type ManagedKey = (typeof MANAGED_KEYS)[number];

type Values = Record<ManagedKey, string>;

const LABELS: Record<ManagedKey, string> = {
  default_can_price: 'Normal RO can price (₹20 target)',
  chilled_can_price: 'Chilled RO can price (₹25 target)',
  subscription_can_price: 'Recurring can price',
  bulk_can_price: 'Bulk can price',
  bulk_threshold: 'Bulk price threshold',
  market_can_price: 'Illustrative reference price (not verified market average)',
  convenience_fee: 'Order handling fee',
  min_can_price: 'Minimum can price',
  max_can_price: 'Maximum can price',
  platform_fee: 'Platform fee',
  plumber_booking_fee: 'Plumber booking fee',
  supplier_commission: 'Supplier commission',
  bulk_commission: 'Bulk commission',
  service_radius_km: 'Service radius',
  max_cans_per_order: 'Maximum cans per order',
  emergency_surcharge: 'Emergency surcharge',
  support_phone: 'Support phone',
  support_email: 'Support email',
  whatsapp_number: 'WhatsApp number',
  maintenance_mode: 'Maintenance mode',
  auto_assign_orders: 'Auto-assign orders',
};

const DESCRIPTIONS: Record<ManagedKey, string> = {
  default_can_price:
    'Customer price per 20L Normal RO can. The water-can order API applies no separate convenience fee.',
  chilled_can_price:
    'Customer price per 20L Chilled RO can. Chilled water is selected as a separate one-time booking option.',
  subscription_can_price:
    'Per-can rate for recurring deliveries. Each delivery is paid separately; no automatic debit.',
  bulk_can_price:
    'Per-can rate for orders that meet the bulk threshold.',
  bulk_threshold:
    'Minimum can quantity required to apply the bulk rate.',
  market_can_price:
    'Manually configured comparison reference for illustrative savings only. Research comparable local prices before setting it; do not present it as a verified market average or MRP.',
  convenience_fee:
    'Flat fee for eligible non-water-can bookings. The water-can order API currently applies no separate convenience fee.',
  min_can_price:
    'Lowest allowed water-can price.',
  max_can_price:
    'Highest allowed water-can price.',
  platform_fee:
    'Platform fee added to eligible orders.',
  plumber_booking_fee:
    'Base booking fee for plumber services.',
  supplier_commission:
    'Standard supplier commission percentage.',
  bulk_commission:
    'Commission percentage used for bulk orders.',
  service_radius_km:
    'Maximum service radius used by applicable services.',
  max_cans_per_order:
    'Maximum number of cans allowed in one order.',
  emergency_surcharge:
    'Additional charge for emergency bookings.',
  support_phone:
    'Customer support phone number.',
  support_email:
    'Primary customer support email address.',
  whatsapp_number:
    'WhatsApp number used for customer communication.',
  maintenance_mode:
    'Temporarily disable normal customer operations.',
  auto_assign_orders:
    'Automatically assign eligible orders to available suppliers/technicians.',
};

const CURRENCY_KEYS: ReadonlySet<ManagedKey> = new Set([
  'default_can_price',
  'chilled_can_price',
  'subscription_can_price',
  'bulk_can_price',
  'market_can_price',
  'convenience_fee',
  'min_can_price',
  'max_can_price',
  'platform_fee',
  'plumber_booking_fee',
  'emergency_surcharge',
]);

const PERCENTAGE_KEYS: ReadonlySet<ManagedKey> = new Set([
  'supplier_commission',
  'bulk_commission',
]);

const INTEGER_KEYS: ReadonlySet<ManagedKey> = new Set([
  'bulk_threshold',
  'max_cans_per_order',
]);

const DECIMAL_KEYS: ReadonlySet<ManagedKey> = new Set([
  'service_radius_km',
]);

const BOOLEAN_KEYS: ReadonlySet<ManagedKey> = new Set([
  'maintenance_mode',
  'auto_assign_orders',
]);

const CONTACT_KEYS: ReadonlySet<ManagedKey> = new Set([
  'support_phone',
  'support_email',
  'whatsapp_number',
]);

const DEFAULT_VALUES: Values = {
  default_can_price: '',
  chilled_can_price: '25',
  subscription_can_price: '',
  bulk_can_price: '',
  bulk_threshold: '',
  market_can_price: '',
  convenience_fee: '',
  min_can_price: '',
  max_can_price: '',
  platform_fee: '',
  plumber_booking_fee: '',
  supplier_commission: '',
  bulk_commission: '',
  service_radius_km: '',
  max_cans_per_order: '',
  emergency_surcharge: '',
  support_phone: '',
  support_email: '',
  whatsapp_number: '',
  maintenance_mode: 'false',
  auto_assign_orders: 'false',
};

function isBooleanKey(key: ManagedKey): boolean {
  return BOOLEAN_KEYS.has(key);
}

function isNumericKey(key: ManagedKey): boolean {
  return (
    CURRENCY_KEYS.has(key) ||
    PERCENTAGE_KEYS.has(key) ||
    INTEGER_KEYS.has(key) ||
    DECIMAL_KEYS.has(key)
  );
}

function getInputType(key: ManagedKey): string {
  if (key === 'support_email') return 'email';

  if (
    key === 'support_phone' ||
    key === 'whatsapp_number'
  ) {
    return 'tel';
  }

  if (isNumericKey(key)) return 'number';

  return 'text';
}

function getStep(key: ManagedKey): string | undefined {
  if (INTEGER_KEYS.has(key)) return '1';
  if (DECIMAL_KEYS.has(key)) return '0.1';

  if (
    CURRENCY_KEYS.has(key) ||
    PERCENTAGE_KEYS.has(key)
  ) {
    return '0.01';
  }

  return undefined;
}

function getPrefix(key: ManagedKey): string {
  return CURRENCY_KEYS.has(key) ? '₹' : '';
}

function getSuffix(key: ManagedKey): string {
  if (PERCENTAGE_KEYS.has(key)) return '%';
  if (key === 'service_radius_km') return 'km';
  if (key === 'max_cans_per_order') return 'cans';

  return '';
}

function normaliseValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return String(value);
}

function validateValues(values: Values): string | null {
  const minPrice = values.min_can_price.trim();
  const maxPrice = values.max_can_price.trim();
  const defaultPrice = values.default_can_price.trim();

  if (minPrice !== '') {
    const value = Number(minPrice);

    if (!Number.isFinite(value) || value < 0) {
      return 'Minimum can price must be a valid non-negative number.';
    }
  }

  if (maxPrice !== '') {
    const value = Number(maxPrice);

    if (!Number.isFinite(value) || value < 0) {
      return 'Maximum can price must be a valid non-negative number.';
    }
  }

  if (defaultPrice !== '') {
    const value = Number(defaultPrice);

    if (!Number.isFinite(value) || value < 0) {
      return 'Default can price must be a valid non-negative number.';
    }
  }

  if (
    minPrice !== '' &&
    maxPrice !== '' &&
    Number(minPrice) > Number(maxPrice)
  ) {
    return 'Minimum can price cannot be greater than maximum can price.';
  }

  if (
    defaultPrice !== '' &&
    minPrice !== '' &&
    Number(defaultPrice) < Number(minPrice)
  ) {
    return 'Default can price cannot be below the minimum price.';
  }

  if (
    defaultPrice !== '' &&
    maxPrice !== '' &&
    Number(defaultPrice) > Number(maxPrice)
  ) {
    return 'Default can price cannot be above the maximum price.';
  }

  for (const key of PERCENTAGE_KEYS) {
    const raw = values[key]?.trim() ?? '';

    if (raw === '') continue;

    const value = Number(raw);

    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return `${LABELS[key]} must be between 0 and 100%.`;
    }
  }

  for (const key of INTEGER_KEYS) {
    const raw = values[key]?.trim() ?? '';

    if (raw === '') continue;

    const value = Number(raw);

    if (
      !Number.isInteger(value) ||
      value < 1
    ) {
      return `${LABELS[key]} must be a positive whole number.`;
    }
  }

  for (const key of DECIMAL_KEYS) {
    const raw = values[key]?.trim() ?? '';

    if (raw === '') continue;

    const value = Number(raw);

    if (!Number.isFinite(value) || value <= 0) {
      return `${LABELS[key]} must be greater than 0.`;
    }
  }

  for (const key of CURRENCY_KEYS) {
    const raw = values[key]?.trim() ?? '';

    if (raw === '') continue;

    const value = Number(raw);

    if (!Number.isFinite(value) || value < 0) {
      return `${LABELS[key]} must be a valid non-negative amount.`;
    }
  }

  if (
    values.support_email.trim() !== '' &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      values.support_email.trim()
    )
  ) {
    return 'Please enter a valid support email address.';
  }

  for (const key of [
    'support_phone',
    'whatsapp_number',
  ] as const) {
    const raw = values[key]
      .replace(/\D/g, '')
      .trim();

    if (raw !== '' && raw.length !== 10) {
      return `${LABELS[key]} must contain exactly 10 digits.`;
    }
  }

  return null;
}

function buildRequestBody(
  values: Values
): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  for (const key of MANAGED_KEYS) {
    const raw = values[key]?.trim() ?? '';

    if (isBooleanKey(key)) {
      body[key] =
        raw === 'true' ||
        raw === '1';

      continue;
    }

    /*
     * Empty values are omitted so existing server-side
     * settings are not accidentally overwritten.
     */
    if (raw === '') {
      continue;
    }

    if (isNumericKey(key)) {
      body[key] = Number(raw);
      continue;
    }

    if (
      key === 'support_phone' ||
      key === 'whatsapp_number'
    ) {
      body[key] = raw.replace(/\D/g, '');
      continue;
    }

    body[key] = raw;
  }

  return body;
}

function groupKeys() {
  return {
    pricing: [
      'default_can_price',
      'min_can_price',
      'max_can_price',
      'platform_fee',
      'plumber_booking_fee',
      'emergency_surcharge',
    ] as ManagedKey[],

    commissions: [
      'supplier_commission',
      'bulk_commission',
    ] as ManagedKey[],

    operations: [
      'service_radius_km',
      'max_cans_per_order',
      'auto_assign_orders',
      'maintenance_mode',
    ] as ManagedKey[],

    support: [
      'support_phone',
      'support_email',
      'whatsapp_number',
    ] as ManagedKey[],
  };
}

export default function AdminSettingsPage() {
  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [values, setValues] =
    useState<Values>(DEFAULT_VALUES);

  const [savedValues, setSavedValues] =
    useState<Values>(DEFAULT_VALUES);

  const [error, setError] =
    useState<string | null>(null);

  const groups = useMemo(
    () => groupKeys(),
    []
  );

  const hasChanges = useMemo(
    () =>
      MANAGED_KEYS.some(
        (key) =>
          values[key] !== savedValues[key]
      ),
    [savedValues, values]
  );

  const load = useCallback(
    async () => {
      setLoading(true);
      setError(null);

      try {
        const data =
          await adminSettingsGet();

        const source =
          data as Record<
            string,
            unknown
          >;

        const next: Values = {
          ...DEFAULT_VALUES,
        };

        const read = (
          key: string,
          ...aliases: string[]
        ) => {
          for (
            const candidate of [
              key,
              ...aliases,
            ]
          ) {
            const value =
              source[candidate];

            if (
              value !== undefined &&
              value !== null
            ) {
              return value;
            }
          }

          return undefined;
        };

        for (
          const key of MANAGED_KEYS
        ) {
          let value: unknown;

          if (
            key ===
            'supplier_commission'
          ) {
            value = read(
              'supplier_commission',
              'supplier_commission_rate'
            );
          } else if (
            key === 'support_phone'
          ) {
            value = read(
              'support_phone',
              'phone_primary'
            );
          } else {
            value = read(key);
          }

          next[key] =
            normaliseValue(value);
        }

        setValues(next);
        setSavedValues(next);
      } catch (cause: unknown) {
        const message =
          cause instanceof Error
            ? cause.message
            : 'Failed to load settings.';

        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  const updateValue = (
    key: ManagedKey,
    value: string
  ) => {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));

    setError(null);
  };

  const handleSave = async () => {
    const validationError =
      validateValues(values);

    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const body =
        buildRequestBody(values);

      await adminSettingsPut(body);

      /*
       * Clear client-side public settings cache.
       */
      safeRemove('aw_settings_v3');
      safeRemove('aw_settings_v3_ts');

      /*
       * Treat current values as saved immediately.
       * Then refresh from the server to ensure the
       * actual persisted state is displayed.
       */
      setSavedValues(values);

      toast.success(
        'Settings saved successfully.'
      );

      await load();
    } catch (cause: unknown) {
      const message =
        cause instanceof Error
          ? cause.message
          : 'Failed to save settings.';

      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const renderField = (
    key: ManagedKey
  ) => {
    const booleanField =
      isBooleanKey(key);

    const prefix =
      getPrefix(key);

    const suffix =
      getSuffix(key);

    return (
      <div
        key={key}
        className="space-y-2"
      >
        <label
          htmlFor={`setting-${key}`}
          className="block"
        >
          <span className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-white">
              {LABELS[key]}
            </span>

            {booleanField && (
              <span className="text-[11px] uppercase tracking-wide text-slate-500">
                Toggle
              </span>
            )}
          </span>

          <span className="mt-1 block text-xs leading-5 text-slate-400">
            {DESCRIPTIONS[key]}
          </span>
        </label>

        {booleanField ? (
          <select
            id={`setting-${key}`}
            aria-label={LABELS[key]}
            disabled={saving}
            value={
              values[key] ?? 'false'
            }
            onChange={(event) =>
              updateValue(
                key,
                event.target.value
              )
            }
            className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="false">
              Off
            </option>
            <option value="true">
              On
            </option>
          </select>
        ) : (
          <div className="relative">
            {prefix && (
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                {prefix}
              </span>
            )}

            <input
              id={`setting-${key}`}
              aria-label={LABELS[key]}
              type={getInputType(key)}
              inputMode={
                isNumericKey(key)
                  ? 'decimal'
                  : key ===
                      'support_phone' ||
                    key ===
                      'whatsapp_number'
                  ? 'numeric'
                  : undefined
              }
              step={getStep(key)}
              min={
                PERCENTAGE_KEYS.has(key)
                  ? 0
                  : INTEGER_KEYS.has(key)
                  ? 1
                  : isNumericKey(key)
                  ? 0
                  : undefined
              }
              max={
                PERCENTAGE_KEYS.has(key)
                  ? 100
                  : undefined
              }
              disabled={saving}
              value={
                values[key] ?? ''
              }
              onChange={(event) =>
                updateValue(
                  key,
                  event.target.value
                )
              }
              className={[
                'w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none transition',
                'placeholder:text-slate-600',
                'focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/10',
                'disabled:cursor-not-allowed disabled:opacity-60',
                prefix ? 'pl-8' : '',
                suffix ? 'pr-14' : '',
              ].join(' ')}
            />

            {suffix && (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500">
                {suffix}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSection = (
    title: string,
    description: string,
    keys: ManagedKey[]
  ) => (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-white">
          {title}
        </h2>

        <p className="mt-1 text-xs leading-5 text-slate-400">
          {description}
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {keys.map(renderField)}
      </div>
    </section>
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-sky-300">
            Admin control
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Settings
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            Manage pricing, commissions,
            operations and customer support
            settings for AuroWater.
          </p>
        </div>

        <div
          className={[
            'rounded-full border px-3 py-1.5 text-xs font-medium',
            hasChanges
              ? 'border-amber-400/20 bg-amber-400/10 text-amber-300'
              : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
          ].join(' ')}
        >
          {hasChanges
            ? 'Unsaved changes'
            : 'All changes saved'}
        </div>
      </div>

      {/* Warning */}
      <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.06] p-4">
        <div className="flex gap-3">
          <div className="mt-0.5 text-amber-300">
            ⚠
          </div>

          <div>
            <p className="text-sm font-medium text-amber-200">
              Production settings
            </p>

            <p className="mt-1 text-xs leading-5 text-amber-100/60">
              Changes can affect live pricing,
              order assignment and customer
              operations. Review values before
              saving.
            </p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm text-red-200"
        >
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]"
            />
          ))}
        </div>
      ) : (
        <>
          {renderSection(
            'Pricing',
            'Control customer-facing pricing and service charges.',
            groups.pricing
          )}

          {renderSection(
            'Commissions',
            'Configure supplier and bulk-order commission rates.',
            groups.commissions
          )}

          {renderSection(
            'Operations',
            'Control service coverage, order limits and operational automation.',
            groups.operations
          )}

          {renderSection(
            'Customer support',
            'Configure the contact details customers see when they need help.',
            groups.support
          )}

          {/* Save bar */}
          <div className="sticky bottom-4 z-10 rounded-2xl border border-white/10 bg-slate-950/90 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-white">
                  {hasChanges
                    ? 'You have unsaved changes'
                    : 'Settings are up to date'}
                </p>

                <p className="mt-0.5 text-xs text-slate-500">
                  Public settings cache is cleared
                  after a successful save.
                </p>
              </div>

              <button
                type="button"
                disabled={
                  saving ||
                  !hasChanges
                }
                onClick={() =>
                  void handleSave()
                }
                className="inline-flex min-w-36 items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Saving…
                  </>
                ) : (
                  'Save changes'
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}








// 'use client';

// import React, { useCallback, useEffect, useState } from 'react';
// import { toast } from 'sonner';
// import { adminSettingsGet, adminSettingsPut } from '@/lib/api-client';
// import { safeRemove } from '@/lib/storage';

// /** Keys validated by `PUT /api/admin/settings` (must match server SETTINGS_SCHEMA). */
// const MANAGED_KEYS = [
//   'default_can_price',
//   'min_can_price',
//   'max_can_price',
//   'platform_fee',
//   'plumber_booking_fee',
//   'supplier_commission',
//   'bulk_commission',
//   'service_radius_km',
//   'max_cans_per_order',
//   'emergency_surcharge',
//   'support_phone',
//   'support_email',
//   'whatsapp_number',
//   'maintenance_mode',
//   'auto_assign_orders',
// ] as const;

// type ManagedKey = (typeof MANAGED_KEYS)[number];

// const LABELS: Record<ManagedKey, string> = {
//   default_can_price: 'Default can price (₹)',
//   min_can_price: 'Min can price (₹)',
//   max_can_price: 'Max can price (₹)',
//   platform_fee: 'Platform fee (₹)',
//   plumber_booking_fee: 'Plumber booking fee (₹)',
//   supplier_commission: 'Supplier commission (%)',
//   bulk_commission: 'Bulk commission (%)',
//   service_radius_km: 'Service radius (km)',
//   max_cans_per_order: 'Max cans per order',
//   emergency_surcharge: 'Emergency surcharge (₹)',
//   support_phone: 'Support phone (10 digits)',
//   support_email: 'Support email',
//   whatsapp_number: 'WhatsApp number (10 digits)',
//   maintenance_mode: 'Maintenance mode',
//   auto_assign_orders: 'Auto-assign orders',
// };

// function isBoolKey(k: ManagedKey) {
//   return k === 'maintenance_mode' || k === 'auto_assign_orders';
// }

// export default function AdminSettingsPage() {
//   const [loading, setLoading] = useState(true);
//   const [saving, setSaving] = useState(false);
//   const [values, setValues] = useState<Record<string, string>>({});

//   const load = useCallback(async () => {
//     setLoading(true);
//     try {
//       const data = await adminSettingsGet();
//       const next: Record<string, string> = {};
//       const d = data as Record<string, unknown>;
//       const read = (k: string, ...aliases: string[]) => {
//         for (const key of [k, ...aliases]) {
//           const v = d[key];
//           if (v !== undefined && v !== null) return v;
//         }
//         return undefined;
//       };
//       for (const k of MANAGED_KEYS) {
//         let v: unknown;
//         if (k === 'supplier_commission') {
//           v = read('supplier_commission', 'supplier_commission_rate');
//         } else if (k === 'support_phone') {
//           v = read('support_phone', 'phone_primary');
//         } else if (k === 'whatsapp_number') {
//           v = read('whatsapp_number');
//         } else {
//           v = read(k);
//         }
//         if (v === undefined || v === null) next[k] = '';
//         else if (typeof v === 'boolean') next[k] = v ? 'true' : 'false';
//         else next[k] = String(v);
//       }
//       setValues(next);
//     } catch (e: unknown) {
//       toast.error(e instanceof Error ? e.message : 'Failed to load settings');
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     void load();
//   }, [load]);

//   const handleSave = async () => {
//     setSaving(true);
//     try {
//       const body: Record<string, unknown> = {};
//       for (const k of MANAGED_KEYS) {
//         const raw = values[k]?.trim() ?? '';
//         if (isBoolKey(k)) {
//           body[k] = raw === 'true' || raw === '1';
//           continue;
//         }
//         if (raw === '') continue;
//         if (
//           k.includes('price') ||
//           k.includes('fee') ||
//           k.includes('surcharge') ||
//           k.includes('radius') ||
//           k.includes('max_cans') ||
//           k.includes('commission') ||
//           k === 'platform_fee'
//         ) {
//           body[k] = Number(raw);
//         } else {
//           body[k] = raw;
//         }
//       }
//       await adminSettingsPut(body);
//       safeRemove('aw_settings_v3');
//       safeRemove('aw_settings_v3_ts');
//       toast.success('Settings saved. Public pricing will pick up changes on next cache refresh.');
//       void load();
//     } catch (e: unknown) {
//       toast.error(e instanceof Error ? e.message : 'Save failed');
//     } finally {
//       setSaving(false);
//     }
//   };

//   return (
//     <div className="space-y-6 max-w-3xl">
//       <div>
//         <h1 className="text-2xl font-bold text-white">Settings</h1>
//         <p className="text-sm text-slate-300 mt-1">
//           Updates persist to Supabase <code className="text-sky-300">settings</code> and clear the public settings
//           cache so pricing pages refresh sooner.
//         </p>
//       </div>

//       {loading ? (
//         <p className="text-slate-400">Loading…</p>
//       ) : (
//         <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 space-y-4">
//           {MANAGED_KEYS.map((k) => (
//             <label key={k} className="block">
//               <span className="text-xs text-slate-400 font-medium">{LABELS[k]}</span>
//               {isBoolKey(k) ? (
//                 <select
//                   className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
//                   value={values[k] ?? 'false'}
//                   onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
//                 >
//                   <option value="false">Off</option>
//                   <option value="true">On</option>
//                 </select>
//               ) : (
//                 <input
//                   className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
//                   value={values[k] ?? ''}
//                   onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
//                 />
//               )}
//             </label>
//           ))}

//           <button
//             type="button"
//             disabled={saving}
//             onClick={() => void handleSave()}
//             className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
//           >
//             {saving ? 'Saving…' : 'Save changes'}
//           </button>
//         </div>
//       )}
//     </div>
//   );
// }
