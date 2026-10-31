'use client';

/**
 * AuroTap admin settings (v2)
 *
 * - Light theme with a tinted page background and white, bordered, shadowed cards so every
 *   section is clearly separated (the old dark glass cards blended into the background).
 * - Single FIELD_META registry drives labels, help text, input type, units, validation and
 *   the diff view, so adding a setting is one entry (plus the server SETTINGS_SCHEMA).
 * - Instant paint from a session cache, then silent revalidation. A background refresh never
 *   overwrites what you are typing.
 * - Memoised fields: typing in one input re-renders only that input.
 * - Live inline validation, error summary with jump-to-field, per-field undo.
 * - "Review and save" step shows exactly what will change (old to new) before anything
 *   touches production. Ctrl/Cmd+S opens it. Leaving with unsaved edits is guarded.
 * - Search across settings, section navigation with scroll tracking, accessible switches.
 */

import React, {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import { adminSettingsGet, adminSettingsPut } from '@/lib/api-client';
import { safeRemove } from '@/lib/storage';

/* ───────────────────────────── Schema ───────────────────────────── */

/**
 * Keys validated by PUT /api/admin/settings.
 * IMPORTANT: keep these synchronised with the server SETTINGS_SCHEMA.
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
type Errors = Partial<Record<ManagedKey, string>>;
type Kind = 'currency' | 'percent' | 'int' | 'decimal' | 'bool' | 'email' | 'phone' | 'text';
type SectionId = 'water' | 'fees' | 'commissions' | 'operations' | 'support';

interface FieldMeta {
  label: string;
  description: string;
  kind: Kind;
  section: SectionId;
  prefix?: string;
  suffix?: string;
}

/**
 * Launch pricing policy carried over from v1. While enabled, the normal, chilled and bulk
 * can prices are pinned to the approved launch prices and recurring is capped at the
 * recurring launch price. Set to false once pricing is fully admin-controlled.
 */
const ENFORCE_LAUNCH_PRICING = true;
const LAUNCH = { normal: 20, chilled: 25, recurringMax: 20, bulk: 20 } as const;
const LOCKED_KEYS: ReadonlySet<ManagedKey> = new Set(
  ENFORCE_LAUNCH_PRICING ? (['default_can_price', 'chilled_can_price', 'subscription_can_price', 'bulk_can_price', 'bulk_threshold', 'convenience_fee', 'emergency_surcharge'] as ManagedKey[]) : [],
);

const FIELD_META: Record<ManagedKey, FieldMeta> = {
  default_can_price: {
    label: 'Normal RO can price',
    description: 'Customer price per 20L Normal RO can. The water-can order API applies no separate convenience fee.',
    kind: 'currency', section: 'water', prefix: '₹',
  },
  chilled_can_price: {
    label: 'Chilled RO can price',
    description: 'Customer price per 20L Chilled RO can. Chilled water is chosen as a separate one-time booking option.',
    kind: 'currency', section: 'water', prefix: '₹',
  },
  subscription_can_price: {
    label: 'Recurring can price',
    description: 'Per-can rate for recurring deliveries. Each delivery is paid separately; there is no automatic debit.',
    kind: 'currency', section: 'water', prefix: '₹',
  },
  bulk_can_price: {
    label: 'Bulk can price',
    description: 'Per-can rate for orders that meet the bulk threshold. It can never be higher than the normal price.',
    kind: 'currency', section: 'water', prefix: '₹',
  },
  bulk_threshold: {
    label: 'Bulk price threshold',
    description: 'Minimum can quantity required to apply the bulk rate.',
    kind: 'int', section: 'water', suffix: 'cans',
  },
  market_can_price: {
    label: 'Reference price for comparisons',
    description:
      'Illustrative comparison price used for savings messages only. Research comparable local prices before setting it, and never present it as a verified market average or MRP.',
    kind: 'currency', section: 'water', prefix: '₹',
  },
  min_can_price: {
    label: 'Minimum can price',
    description: 'Lowest allowed water-can price.',
    kind: 'currency', section: 'water', prefix: '₹',
  },
  max_can_price: {
    label: 'Maximum can price',
    description: 'Highest allowed water-can price.',
    kind: 'currency', section: 'water', prefix: '₹',
  },
  convenience_fee: {
    label: 'Order handling fee',
    description: 'Flat fee for eligible non-water-can bookings. Water-can orders currently have no separate handling fee.',
    kind: 'currency', section: 'fees', prefix: '₹',
  },
  platform_fee: {
    label: 'Platform fee',
    description: 'Platform fee added to eligible orders.',
    kind: 'currency', section: 'fees', prefix: '₹',
  },
  plumber_booking_fee: {
    label: 'Plumber booking fee',
    description: 'Base booking fee for plumber services.',
    kind: 'currency', section: 'fees', prefix: '₹',
  },
  emergency_surcharge: {
    label: 'Emergency surcharge',
    description: 'Additional charge for emergency bookings.',
    kind: 'currency', section: 'fees', prefix: '₹',
  },
  supplier_commission: {
    label: 'Supplier commission',
    description: 'Standard commission percentage taken from supplier orders.',
    kind: 'percent', section: 'commissions', suffix: '%',
  },
  bulk_commission: {
    label: 'Bulk commission',
    description: 'Commission percentage used for bulk orders.',
    kind: 'percent', section: 'commissions', suffix: '%',
  },
  service_radius_km: {
    label: 'Service radius',
    description: 'Maximum service radius used by applicable services.',
    kind: 'decimal', section: 'operations', suffix: 'km',
  },
  max_cans_per_order: {
    label: 'Maximum cans per order',
    description: 'Largest number of cans allowed in one order.',
    kind: 'int', section: 'operations', suffix: 'cans',
  },
  auto_assign_orders: {
    label: 'Auto-assign orders',
    description: 'Automatically assign eligible orders to available suppliers and technicians.',
    kind: 'bool', section: 'operations',
  },
  maintenance_mode: {
    label: 'Maintenance mode',
    description: 'Temporarily pauses normal customer operations. Customers cannot place orders while this is on.',
    kind: 'bool', section: 'operations',
  },
  support_phone: {
    label: 'Support phone',
    description: 'Customer support phone number (10 digits).',
    kind: 'phone', section: 'support',
  },
  support_email: {
    label: 'Support email',
    description: 'Primary customer support email address.',
    kind: 'email', section: 'support',
  },
  whatsapp_number: {
    label: 'WhatsApp number',
    description: 'WhatsApp number used for customer communication (10 digits).',
    kind: 'phone', section: 'support',
  },
};

const SECTIONS: { id: SectionId; title: string; description: string; keys: ManagedKey[] }[] = (
  [
    { id: 'water', title: 'Water can pricing', description: 'Customer prices per can and the limits they must stay within.' },
    { id: 'fees', title: 'Fees and charges', description: 'Extra charges added to eligible orders and bookings.' },
    { id: 'commissions', title: 'Commissions', description: 'Supplier and bulk-order commission rates.' },
    { id: 'operations', title: 'Operations', description: 'Service coverage, order limits and automation.' },
    { id: 'support', title: 'Customer support', description: 'Contact details customers see when they need help.' },
  ] as const
).map((s) => ({ ...s, keys: MANAGED_KEYS.filter((k) => FIELD_META[k].section === s.id) }));

const ORDERED_KEYS: ManagedKey[] = SECTIONS.flatMap((s) => s.keys);

/** Alternative names the API may use when reading settings. */
const READ_ALIASES: Partial<Record<ManagedKey, string[]>> = {
  supplier_commission: ['supplier_commission_rate'],
  support_phone: ['phone_primary'],
};

const EMPTY_VALUES: Values = MANAGED_KEYS.reduce((acc, key) => {
  acc[key] = FIELD_META[key].kind === 'bool' ? 'false' : '';
  return acc;
}, {} as Values);

const CACHE_KEY = 'aurotap:admin-settings:v2';
const CACHE_MAX_AGE_MS = 30 * 60_000;

/* ───────────────────────────── Helpers ───────────────────────────── */

function normaliseValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function parseStored(source: Record<string, unknown>): Values {
  const next: Values = { ...EMPTY_VALUES };
  for (const key of MANAGED_KEYS) {
    for (const candidate of [key, ...(READ_ALIASES[key] ?? [])]) {
      const value = source[candidate];
      if (value !== undefined && value !== null) {
        next[key] = normaliseValue(value);
        break;
      }
    }
  }
  return next;
}

/** What the form shows for a given stored state (applies the launch pricing policy). */
function toDisplay(stored: Values): Values {
  if (!ENFORCE_LAUNCH_PRICING) return { ...stored };
  const next: Values = { ...stored };
  const configured = Number(stored.subscription_can_price);
  const recurring =
    Number.isFinite(configured) && configured > 0 && configured < LAUNCH.normal
      ? Math.min(configured, LAUNCH.recurringMax)
      : LAUNCH.recurringMax;
  next.default_can_price = String(LAUNCH.normal);
  next.chilled_can_price = String(LAUNCH.chilled);
  next.subscription_can_price = String(recurring);
  next.bulk_can_price = String(LAUNCH.bulk);
  return next;
}

function showValue(key: ManagedKey, raw: string): string {
  const meta = FIELD_META[key];
  if (meta.kind === 'bool') return raw === 'true' ? 'On' : 'Off';
  if (raw.trim() === '') return 'Not set';
  return `${meta.prefix ?? ''}${raw}${meta.suffix ? ` ${meta.suffix}` : ''}`;
}

function validate(values: Values): Errors {
  const errors: Errors = {};
  const digits = (s: string) => s.replace(/\D/g, '');

  for (const key of MANAGED_KEYS) {
    const meta = FIELD_META[key];
    const raw = values[key].trim();
    if (raw === '' || meta.kind === 'bool') continue;
    const n = Number(raw);

    switch (meta.kind) {
      case 'currency':
        if (!Number.isFinite(n) || n < 0) errors[key] = 'Enter an amount of ₹0 or more.';
        break;
      case 'percent':
        if (!Number.isFinite(n) || n < 0 || n > 100) errors[key] = 'Enter a percentage between 0 and 100.';
        break;
      case 'int':
        if (!Number.isInteger(n) || n < 1) errors[key] = 'Enter a whole number of 1 or more.';
        break;
      case 'decimal':
        if (!Number.isFinite(n) || n <= 0) errors[key] = 'Enter a number greater than 0.';
        break;
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) errors[key] = 'Enter a valid email address, like help@example.com.';
        break;
      case 'phone':
        if (digits(raw).length !== 10) errors[key] = 'Enter exactly 10 digits.';
        break;
      default:
        break;
    }
  }

  const val = (k: ManagedKey) => (values[k].trim() === '' || errors[k] ? null : Number(values[k]));
  const min = val('min_can_price');
  const max = val('max_can_price');
  const def = val('default_can_price');
  const bulk = val('bulk_can_price');
  const recurring = val('subscription_can_price');

  if (min !== null && max !== null && min > max) {
    errors.min_can_price ??= 'Minimum price can’t be higher than the maximum price.';
  }
  if (def !== null && min !== null && def < min) {
    errors.min_can_price ??= `Minimum price can’t be above the normal price (₹${def}).`;
  }
  if (def !== null && max !== null && def > max) {
    errors.max_can_price ??= `Maximum price can’t be below the normal price (₹${def}).`;
  }
  if (def !== null && bulk !== null && bulk > def) {
    errors.bulk_can_price ??= `Bulk price can’t be higher than the normal price (₹${def}).`;
  }
  if (def !== null && recurring !== null && recurring > def) {
    errors.subscription_can_price ??= `Recurring price can’t be higher than the normal price (₹${def}).`;
  }
  if (ENFORCE_LAUNCH_PRICING && recurring !== null && recurring > LAUNCH.recurringMax) {
    errors.subscription_can_price ??= `Recurring price is capped at ₹${LAUNCH.recurringMax} during launch pricing.`;
  }
  return errors;
}

/**
 * Empty values are omitted so existing server-side settings are never overwritten by accident.
 */
function buildRequestBody(values: Values): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const key of MANAGED_KEYS) {
    const { kind } = FIELD_META[key];
    const raw = values[key]?.trim() ?? '';

    if (kind === 'bool') {
      body[key] = raw === 'true' || raw === '1';
      continue;
    }
    if (raw === '') continue;

    if (kind === 'currency' || kind === 'percent' || kind === 'int' || kind === 'decimal') {
      body[key] = Number(raw);
    } else if (kind === 'phone') {
      body[key] = raw.replace(/\D/g, '');
    } else {
      body[key] = raw;
    }
  }
  return body;
}

function readCache(): Values | null {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; stored: Partial<Values> };
    if (!parsed?.stored || Date.now() - parsed.savedAt > CACHE_MAX_AGE_MS) return null;
    return { ...EMPTY_VALUES, ...parsed.stored };
  } catch {
    return null;
  }
}
function writeCache(stored: Values) {
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), stored }));
  } catch {
    /* optional */
  }
}
function clearCache() {
  try {
    window.sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* optional */
  }
}

/* ───────────────────────────── UI pieces ───────────────────────────── */

const ringFocus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600/40 focus-visible:ring-offset-1';

function Switch({
  checked,
  disabled,
  labelledBy,
  describedBy,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  labelledBy: string;
  describedBy: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${ringFocus} disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'border-cyan-700 bg-cyan-700' : 'border-slate-300 bg-slate-200'
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${
          checked ? 'translate-x-[1.4rem]' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

const Field = memo(function Field({
  k,
  value,
  error,
  dirty,
  disabled,
  onChange,
  onBlur,
  onReset,
}: {
  k: ManagedKey;
  value: string;
  error?: string;
  dirty: boolean;
  disabled: boolean;
  onChange: (key: ManagedKey, value: string) => void;
  onBlur: (key: ManagedKey) => void;
  onReset: (key: ManagedKey) => void;
}) {
  const meta = FIELD_META[k];
  const id = `setting-${k}`;
  const hintId = `${id}-hint`;
  const errId = `${id}-error`;
  const locked = LOCKED_KEYS.has(k);

  const header = (
    <div className="flex flex-wrap items-center gap-2">
      <span id={`${id}-label`} className="text-sm font-semibold text-slate-900">
        {meta.label}
      </span>
      {dirty && (
        <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-800 ring-1 ring-inset ring-cyan-200">
          Edited
        </span>
      )}
      {locked && (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          Launch price
        </span>
      )}
      {dirty && !locked && (
        <button
          type="button"
          onClick={() => onReset(k)}
          disabled={disabled}
          className={`ml-auto rounded text-xs font-semibold text-slate-500 hover:text-slate-900 ${ringFocus}`}
        >
          Undo
        </button>
      )}
    </div>
  );

  if (meta.kind === 'bool') {
    return (
      <div
        className={`flex items-start justify-between gap-4 rounded-xl border p-4 md:col-span-2 ${
          dirty ? 'border-cyan-300 bg-cyan-50/40' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <div className="min-w-0 flex-1 space-y-1">
          {header}
          <p id={hintId} className="text-xs leading-5 text-slate-500">
            {meta.description}
          </p>
        </div>
        <div className="flex items-center gap-2 pt-0.5">
          <span className="w-7 text-right text-xs font-semibold text-slate-600" aria-hidden="true">
            {value === 'true' ? 'On' : 'Off'}
          </span>
          <Switch
            checked={value === 'true'}
            disabled={disabled}
            labelledBy={`${id}-label`}
            describedBy={hintId}
            onChange={(next) => onChange(k, next ? 'true' : 'false')}
          />
        </div>
      </div>
    );
  }

  const numeric = meta.kind === 'currency' || meta.kind === 'percent' || meta.kind === 'int' || meta.kind === 'decimal';
  const type = meta.kind === 'email' ? 'email' : meta.kind === 'phone' ? 'tel' : numeric ? 'number' : 'text';
  const step = meta.kind === 'int' ? '1' : meta.kind === 'decimal' ? '0.1' : meta.kind === 'currency' || meta.kind === 'percent' ? '0.01' : undefined;
  const min = meta.kind === 'int' ? 1 : numeric ? 0 : undefined;
  const max = meta.kind === 'percent' ? 100 : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block space-y-1">
        {header}
      </label>
      <p id={hintId} className="text-xs leading-5 text-slate-500">
        {meta.description}
      </p>
      <div className="relative">
        {meta.prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
            {meta.prefix}
          </span>
        )}
        <input
          id={id}
          type={type}
          inputMode={numeric ? 'decimal' : meta.kind === 'phone' ? 'numeric' : undefined}
          autoComplete={meta.kind === 'email' ? 'email' : meta.kind === 'phone' ? 'tel-national' : 'off'}
          step={step}
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          readOnly={locked}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${hintId} ${errId}` : hintId}
          onChange={(e) => onChange(k, e.target.value)}
          onBlur={() => onBlur(k)}
          onWheel={(e) => numeric && (e.target as HTMLInputElement).blur()}
          className={[
            'block w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors',
            'placeholder:text-slate-400 focus:outline-none focus:ring-2',
            'disabled:cursor-not-allowed disabled:opacity-60',
            meta.prefix ? 'pl-8' : '',
            meta.suffix ? 'pr-14' : '',
            locked
              ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-600'
              : error
                ? 'border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-red-200'
                : dirty
                  ? 'border-cyan-500 bg-cyan-50/30 focus:border-cyan-600 focus:ring-cyan-600/20'
                  : 'border-slate-300 bg-white hover:border-slate-400 focus:border-cyan-600 focus:ring-cyan-600/20',
          ].join(' ')}
        />
        {meta.suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
            {meta.suffix}
          </span>
        )}
      </div>
      {error && (
        <p id={errId} role="alert" className="flex items-start gap-1.5 text-xs font-medium text-red-700">
          <span aria-hidden="true">●</span>
          {error}
        </p>
      )}
    </div>
  );
});

function ReviewDialog({
  changes,
  saving,
  saveError,
  maintenanceTurningOn,
  onCancel,
  onConfirm,
}: {
  changes: { key: ManagedKey; from: string; to: string; cleared: boolean }[];
  saving: boolean;
  saveError: string | null;
  maintenanceTurningOn: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onCancel();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [onCancel, saving]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center">
      <button
        type="button"
        aria-label="Close review"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={() => !saving && onCancel()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            Review changes
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            These settings go live for customers as soon as you save.
          </p>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          {maintenanceTurningOn && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              Maintenance mode will be turned on. Customers won’t be able to place orders until it’s turned off.
            </div>
          )}
          {saveError && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              {saveError}
            </div>
          )}
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {changes.map((c) => (
              <li key={c.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="font-medium text-slate-800">{FIELD_META[c.key].label}</span>
                <span className="tabular-nums text-slate-500">
                  <span className="line-through decoration-slate-300">{c.from}</span>
                  <span aria-hidden="true" className="mx-2 text-slate-300">→</span>
                  <span className="sr-only"> changed to </span>
                  <span className="font-semibold text-slate-900">{c.cleared ? 'Cleared' : c.to}</span>
                </span>
                {c.cleared && (
                  <span className="w-full text-xs text-amber-700">
                    Empty fields aren’t sent, so the server keeps its current value.
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className={`rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 ${ringFocus}`}
          >
            Keep editing
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className={`inline-flex min-w-40 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-60 ${ringFocus}`}
          >
            {saving && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" aria-hidden="true" />
            )}
            {saving ? 'Saving' : `Save ${changes.length} ${changes.length === 1 ? 'change' : 'changes'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading settings">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
          <div className="mt-2 h-3 w-64 animate-pulse rounded bg-slate-100" />
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────────── Page ───────────────────────────── */

export default function AdminSettingsPage() {
  const [values, setValues] = useState<Values>(() => toDisplay(EMPTY_VALUES));
  const [saved, setSaved] = useState<Values>(EMPTY_VALUES);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Partial<Record<ManagedKey, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [query, setQuery] = useState('');
  const [activeSection, setActiveSection] = useState<SectionId>('water');
  const deferredQuery = useDeferredValue(query);

  const mountedRef = useRef(false);
  const readyRef = useRef(false);
  const savingRef = useRef(false);
  const valuesRef = useRef(values);
  const savedRef = useRef(saved);
  valuesRef.current = values;
  savedRef.current = saved;

  const baseline = useMemo(() => toDisplay(saved), [saved]);
  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;

  const errors = useMemo(() => validate(values), [values]);
  const errorKeys = useMemo(() => ORDERED_KEYS.filter((k) => errors[k]), [errors]);

  /** Keys the person has actually edited in this session. */
  const editedKeys = useMemo(() => MANAGED_KEYS.filter((k) => values[k] !== baseline[k]), [values, baseline]);
  /** Keys that differ from what the server has stored (includes pending launch-price alignment). */
  const changedKeys = useMemo(() => MANAGED_KEYS.filter((k) => values[k] !== saved[k]), [values, saved]);
  const editedSet = useMemo(() => new Set<ManagedKey>(editedKeys), [editedKeys]);

  const pendingLaunchKeys = useMemo(
    () => (ENFORCE_LAUNCH_PRICING && ready ? changedKeys.filter((k) => !editedSet.has(k)) : []),
    [changedKeys, editedSet, ready],
  );

  /* ── Loading ── */
  const load = useCallback(async (opts: { silent?: boolean; force?: boolean } = {}) => {
    if (!opts.silent) setLoading(true);
    setLoadError(null);
    try {
      const data = await adminSettingsGet();
      if (!mountedRef.current) return;
      const stored = parseStored((data ?? {}) as Record<string, unknown>);

      const base = toDisplay(savedRef.current);
      const hasEdits = MANAGED_KEYS.some((k) => valuesRef.current[k] !== base[k]);

      savedRef.current = stored;
      setSaved(stored);
      // A background refresh must never clobber what the person is typing.
      if (opts.force || !readyRef.current || !hasEdits) setValues(toDisplay(stored));
      readyRef.current = true;
      setReady(true);
      writeCache(stored);
    } catch (cause: unknown) {
      if (!mountedRef.current) return;
      const message = cause instanceof Error ? cause.message : 'Failed to load settings.';
      setLoadError(message);
      toast.error(message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const cached = readCache();
    if (cached) {
      savedRef.current = cached;
      setSaved(cached);
      setValues(toDisplay(cached));
      readyRef.current = true;
      setReady(true);
      setLoading(false);
    }
    void load({ silent: Boolean(cached) });
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  /* ── Editing ── */
  const handleChange = useCallback((key: ManagedKey, value: string) => {
    setValues((current) => (current[key] === value ? current : { ...current, [key]: value }));
  }, []);

  const handleBlur = useCallback((key: ManagedKey) => {
    setTouched((t) => (t[key] ? t : { ...t, [key]: true }));
  }, []);

  const handleReset = useCallback((key: ManagedKey) => {
    setValues((current) => ({ ...current, [key]: baselineRef.current[key] }));
  }, []);

  const discardAll = useCallback(() => {
    setValues(baselineRef.current);
    setTouched({});
    setSubmitted(false);
    toast.info('Edits discarded');
  }, []);

  /* ── Saving ── */
  const reviewChanges = useMemo(
    () =>
      changedKeys.map((key) => {
        const to = values[key];
        const cleared = FIELD_META[key].kind !== 'bool' && to.trim() === '' && saved[key].trim() !== '';
        return { key, from: showValue(key, saved[key]), to: showValue(key, to), cleared };
      }),
    [changedKeys, values, saved],
  );

  const requestSave = useCallback(() => {
    if (savingRef.current || !readyRef.current) return;
    const currentErrors = validate(valuesRef.current);
    const firstBad = ORDERED_KEYS.find((k) => currentErrors[k]);
    if (firstBad) {
      setSubmitted(true);
      const count = Object.keys(currentErrors).length;
      toast.error(`Fix ${count} ${count === 1 ? 'field' : 'fields'} before saving.`);
      document.getElementById(`setting-${firstBad}`)?.focus();
      return;
    }
    if (!MANAGED_KEYS.some((k) => valuesRef.current[k] !== savedRef.current[k])) return;
    setSaveError(null);
    setReviewOpen(true);
  }, []);

  const confirmSave = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await adminSettingsPut(buildRequestBody(valuesRef.current));

      // Clear client-side public settings caches so customers see the new values.
      safeRemove('aw_settings_v3');
      safeRemove('aw_settings_v3_ts');
      clearCache();

      if (!mountedRef.current) return;
      setReviewOpen(false);
      setTouched({});
      setSubmitted(false);
      setLastSaved(new Date());
      toast.success('Settings saved');
      await load({ silent: true, force: true });
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : 'Failed to save settings.';
      if (mountedRef.current) setSaveError(message);
      toast.error(message);
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }, [load]);

  const closeReview = useCallback(() => setReviewOpen(false), []);

  /* ── Shortcuts and guards ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        requestSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestSave]);

  useEffect(() => {
    if (editedKeys.length === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [editedKeys.length]);

  /* ── Section tracking ── */
  useEffect(() => {
    if (!ready || typeof IntersectionObserver === 'undefined') return;
    const nodes = SECTIONS.map((s) => document.getElementById(`section-${s.id}`)).filter(
      (n): n is HTMLElement => Boolean(n),
    );
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSection(visible[0].target.id.replace('section-', '') as SectionId);
      },
      { rootMargin: '-20% 0px -65% 0px' },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [ready, deferredQuery]);

  const jumpTo = useCallback((id: SectionId) => {
    const el = document.getElementById(`section-${id}`);
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, []);

  /* ── Derived view data ── */
  const visibleSections = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return SECTIONS.map((section) => ({
      ...section,
      keys: q
        ? section.keys.filter((k) => `${FIELD_META[k].label} ${FIELD_META[k].description}`.toLowerCase().includes(q))
        : section.keys,
    })).filter((s) => s.keys.length > 0);
  }, [deferredQuery]);

  const sectionStats = useMemo(() => {
    const stats: Record<string, { edited: number; errors: number }> = {};
    for (const s of SECTIONS) {
      stats[s.id] = {
        edited: s.keys.filter((k) => editedSet.has(k)).length,
        errors: s.keys.filter((k) => errors[k] && (submitted || touched[k])).length,
      };
    }
    return stats;
  }, [editedSet, errors, submitted, touched]);

  const maintenanceOn = values.maintenance_mode === 'true';
  const maintenanceTurningOn = maintenanceOn && saved.maintenance_mode !== 'true';
  const canSave = ready && !saving && changedKeys.length > 0;

  const status =
    editedKeys.length > 0
      ? { tone: 'amber', text: `${editedKeys.length} unsaved ${editedKeys.length === 1 ? 'change' : 'changes'}` }
      : pendingLaunchKeys.length > 0
        ? { tone: 'sky', text: 'Launch prices ready to save' }
        : { tone: 'emerald', text: 'All changes saved' };
  const statusClass =
    status.tone === 'amber'
      ? 'border-amber-300 bg-amber-50 text-amber-900'
      : status.tone === 'sky'
        ? 'border-cyan-300 bg-cyan-50 text-cyan-900'
        : 'border-emerald-300 bg-emerald-50 text-emerald-900';

  /* ───────────────────────────── Render ───────────────────────────── */

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto w-full max-w-6xl space-y-5 px-3 pb-28 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Settings</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Manage pricing, commissions, operations and customer support details for AuroWater.
              </p>
              <div className="mt-3 flex flex-wrap gap-2"><a href="/admin/pricing" className="inline-flex min-h-10 items-center rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-bold text-emerald-900 hover:bg-emerald-100">Manage live prices, fees & city overrides →</a></div>
              <p className="mt-2 text-xs text-slate-600">Water, service prices, convenience and emergency charges are versioned under Pricing. Changes in this legacy settings screen must not overwrite published prices or historical orders.</p>
              <a href="/admin/loyalty" className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-sky-200 bg-sky-50 px-4 text-sm font-bold text-sky-800 hover:bg-sky-100">Manage subscription loyalty offers →</a>
            </div>
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <span
                role="status"
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClass}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                {ready ? status.text : 'Loading'}
              </span>
              {lastSaved && (
                <span className="text-xs text-slate-500">
                  Saved at {lastSaved.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>

          {ready && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <label className="block">
                <span className="sr-only">Search settings</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search settings, for example commission or phone"
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-slate-400 hover:border-slate-400 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/20"
                />
              </label>
            </div>
          )}
        </header>

        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">These are live production settings</p>
          <p className="mt-1 text-xs leading-5 text-amber-900/80">
            Changes affect pricing, order assignment and customer operations. You’ll see a review of every change
            before anything is saved.
          </p>
        </div>

        {maintenanceOn && ready && (
          <div role="status" className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
            <strong className="font-semibold">Maintenance mode is on.</strong> Customers can’t place orders while this
            is enabled{maintenanceTurningOn ? ', and it takes effect when you save' : ''}.
          </div>
        )}

        {ready && pendingLaunchKeys.length > 0 && editedKeys.length === 0 && (
          <div role="status" className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950">
            The approved launch prices differ from what’s stored on the server for{' '}
            {pendingLaunchKeys.map((k) => FIELD_META[k].label.toLowerCase()).join(', ')}. Review and save to apply
            them.
          </div>
        )}

        {ready && submitted && errorKeys.length > 0 && (
          <div role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-900">
              {errorKeys.length} {errorKeys.length === 1 ? 'setting needs' : 'settings need'} attention
            </p>
            <ul className="mt-2 space-y-1">
              {errorKeys.slice(0, 5).map((k) => (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => document.getElementById(`setting-${k}`)?.focus()}
                    className="text-left text-sm text-red-800 underline-offset-2 hover:underline"
                  >
                    {FIELD_META[k].label}: {errors[k]}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {loadError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
            <span>
              {ready
                ? 'We couldn’t refresh settings, so you’re seeing the last data we loaded.'
                : `We couldn’t load settings. ${loadError}`}
            </span>
            <button
              type="button"
              onClick={() => void load({ silent: ready })}
              className={`rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-900 hover:bg-red-100 ${ringFocus}`}
            >
              Try again
            </button>
          </div>
        )}

        {loading && !ready && <LoadingSkeleton />}

        {ready && (
          <div className="grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)]">
            <nav
              aria-label="Settings sections"
              className="sticky top-0 z-20 -mx-3 flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-100/90 px-3 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:top-4 lg:z-auto lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:rounded-2xl lg:border lg:bg-white lg:p-2 lg:shadow-sm"
            >
              {SECTIONS.map((s) => {
                const stat = sectionStats[s.id];
                const active = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => jumpTo(s.id)}
                    aria-current={active ? 'true' : undefined}
                    className={`flex items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${ringFocus} ${
                      active ? 'bg-cyan-100 text-cyan-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {s.title}
                    {stat.errors > 0 ? (
                      <span className="rounded-full bg-red-100 px-1.5 text-[11px] font-bold text-red-800" aria-label={`${stat.errors} errors`}>
                        {stat.errors}
                      </span>
                    ) : stat.edited > 0 ? (
                      <span className="h-2 w-2 rounded-full bg-amber-500" aria-label={`${stat.edited} unsaved`} />
                    ) : null}
                  </button>
                );
              })}
            </nav>

            <form
              className="min-w-0 space-y-5"
              noValidate
              aria-busy={saving}
              onSubmit={(e) => {
                e.preventDefault();
                requestSave();
              }}
            >
              {visibleSections.length === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center shadow-sm">
                  <p className="text-sm font-semibold text-slate-800">No settings match “{query}”</p>
                  <p className="mt-1 text-sm text-slate-500">Try a shorter word, like price, fee or phone.</p>
                </div>
              )}

              {visibleSections.map((section) => (
                <section
                  key={section.id}
                  id={`section-${section.id}`}
                  aria-labelledby={`section-title-${section.id}`}
                  className="scroll-mt-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <h2 id={`section-title-${section.id}`} className="text-base font-semibold text-slate-900">
                        {section.title}
                      </h2>
                      {sectionStats[section.id].edited > 0 && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                          {sectionStats[section.id].edited} edited
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">{section.description}</p>
                  </div>

                  <div className="grid gap-x-6 gap-y-6 p-5 md:grid-cols-2">
                    {section.keys.map((key) => (
                      <Field
                        key={key}
                        k={key}
                        value={values[key]}
                        error={submitted || touched[key] ? errors[key] : undefined}
                        dirty={editedSet.has(key)}
                        disabled={saving}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        onReset={handleReset}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </form>
          </div>
        )}
      </div>

      
{ready &&
  (editedKeys.length > 0 ||
    changedKeys.length > 0 ||
    errorKeys.length > 0) && (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-3 sm:px-6 sm:pb-4">

          <div className="pointer-events-auto mx-auto flex max-w-6xl flex-col gap-3 rounded-2xl border border-slate-300 bg-white p-3 shadow-[0_8px_30px_rgba(15,23,42,0.18)] sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {editedKeys.length > 0
                  ? `${editedKeys.length} unsaved ${editedKeys.length === 1 ? 'change' : 'changes'}`
                  : changedKeys.length > 0
                    ? 'Launch prices ready to save'
                    : 'Settings are up to date'}
              </p>
          
{errorKeys.length > 0 ? (
  <button
    type="button"
    onClick={() => {
      setSubmitted(true);
      const firstError = errorKeys[0];
      if (!firstError) return;

      requestAnimationFrame(() => {
        document.getElementById(`setting-${firstError}`)?.focus();
        document.getElementById(`setting-${firstError}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }}
    className="text-left text-xs font-medium text-red-700 underline underline-offset-2 hover:text-red-900"
  >
    {errorKeys.length} {errorKeys.length === 1
      ? 'field needs'
      : 'fields need'} attention — click to review
  </button>
) : (
  <p className="text-xs text-slate-500">
    Saving clears the public settings cache so customers see updates right away.
  </p>
)}

            </div>
            <div className="flex items-center gap-2">
              {editedKeys.length > 0 && (
                <button
                  type="button"
                  onClick={discardAll}
                  disabled={saving}
                  className={`rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 ${ringFocus}`}
                >
                  Discard
                </button>
              )}
              <button
                type="button"
                onClick={requestSave}
                disabled={!canSave}
                className={`inline-flex min-w-40 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 ${ringFocus}`}
              >
                Review and save
                <kbd className="hidden rounded border border-white/30 px-1.5 text-[10px] font-medium text-white/80 sm:inline">
                  Ctrl S
                </kbd>
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewOpen && (
        <ReviewDialog
          changes={reviewChanges}
          saving={saving}
          saveError={saveError}
          maintenanceTurningOn={maintenanceTurningOn}
          onCancel={closeReview}
          onConfirm={() => void confirmSave()}
        />
      )}
    </div>
  );
}








// 'use client';

// import React, {
//   useCallback,
//   useEffect,
//   useMemo,
//   useState,
// } from 'react';
// import { toast } from 'sonner';
// import {
//   adminSettingsGet,
//   adminSettingsPut,
// } from '@/lib/api-client';
// import { safeRemove } from '@/lib/storage';

// /**
//  * Keys validated by PUT /api/admin/settings.
//  *
//  * IMPORTANT:
//  * Keep these synchronized with the server SETTINGS_SCHEMA.
//  */
// const MANAGED_KEYS = [
//   'default_can_price',
//   'chilled_can_price',
//   'subscription_can_price',
//   'bulk_can_price',
//   'bulk_threshold',
//   'market_can_price',
//   'convenience_fee',
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

// type Values = Record<ManagedKey, string>;

// const LABELS: Record<ManagedKey, string> = {
//   default_can_price: 'Normal RO can price (₹20 target)',
//   chilled_can_price: 'Chilled RO can price (₹25 target)',
//   subscription_can_price: 'Recurring can price',
//   bulk_can_price: 'Bulk can price',
//   bulk_threshold: 'Bulk price threshold',
//   market_can_price: 'Illustrative reference price (not verified market average)',
//   convenience_fee: 'Order handling fee',
//   min_can_price: 'Minimum can price',
//   max_can_price: 'Maximum can price',
//   platform_fee: 'Platform fee',
//   plumber_booking_fee: 'Plumber booking fee',
//   supplier_commission: 'Supplier commission',
//   bulk_commission: 'Bulk commission',
//   service_radius_km: 'Service radius',
//   max_cans_per_order: 'Maximum cans per order',
//   emergency_surcharge: 'Emergency surcharge',
//   support_phone: 'Support phone',
//   support_email: 'Support email',
//   whatsapp_number: 'WhatsApp number',
//   maintenance_mode: 'Maintenance mode',
//   auto_assign_orders: 'Auto-assign orders',
// };

// const DESCRIPTIONS: Record<ManagedKey, string> = {
//   default_can_price:
//     'Customer price per 20L Normal RO can. The water-can order API applies no separate convenience fee.',
//   chilled_can_price:
//     'Customer price per 20L Chilled RO can. Chilled water is selected as a separate one-time booking option.',
//   subscription_can_price:
//     'Per-can rate for recurring deliveries. Each delivery is paid separately; no automatic debit.',
//   bulk_can_price:
//     'Per-can rate for orders that meet the bulk threshold.',
//   bulk_threshold:
//     'Minimum can quantity required to apply the bulk rate.',
//   market_can_price:
//     'Manually configured comparison reference for illustrative savings only. Research comparable local prices before setting it; do not present it as a verified market average or MRP.',
//   convenience_fee:
//     'Flat fee for eligible non-water-can bookings. The water-can order API currently applies no separate convenience fee.',
//   min_can_price:
//     'Lowest allowed water-can price.',
//   max_can_price:
//     'Highest allowed water-can price.',
//   platform_fee:
//     'Platform fee added to eligible orders.',
//   plumber_booking_fee:
//     'Base booking fee for plumber services.',
//   supplier_commission:
//     'Standard supplier commission percentage.',
//   bulk_commission:
//     'Commission percentage used for bulk orders.',
//   service_radius_km:
//     'Maximum service radius used by applicable services.',
//   max_cans_per_order:
//     'Maximum number of cans allowed in one order.',
//   emergency_surcharge:
//     'Additional charge for emergency bookings.',
//   support_phone:
//     'Customer support phone number.',
//   support_email:
//     'Primary customer support email address.',
//   whatsapp_number:
//     'WhatsApp number used for customer communication.',
//   maintenance_mode:
//     'Temporarily disable normal customer operations.',
//   auto_assign_orders:
//     'Automatically assign eligible orders to available suppliers/technicians.',
// };

// const CURRENCY_KEYS: ReadonlySet<ManagedKey> = new Set([
//   'default_can_price',
//   'chilled_can_price',
//   'subscription_can_price',
//   'bulk_can_price',
//   'market_can_price',
//   'convenience_fee',
//   'min_can_price',
//   'max_can_price',
//   'platform_fee',
//   'plumber_booking_fee',
//   'emergency_surcharge',
// ]);

// const PERCENTAGE_KEYS: ReadonlySet<ManagedKey> = new Set([
//   'supplier_commission',
//   'bulk_commission',
// ]);

// const INTEGER_KEYS: ReadonlySet<ManagedKey> = new Set([
//   'bulk_threshold',
//   'max_cans_per_order',
// ]);

// const DECIMAL_KEYS: ReadonlySet<ManagedKey> = new Set([
//   'service_radius_km',
// ]);

// const BOOLEAN_KEYS: ReadonlySet<ManagedKey> = new Set([
//   'maintenance_mode',
//   'auto_assign_orders',
// ]);

// const CONTACT_KEYS: ReadonlySet<ManagedKey> = new Set([
//   'support_phone',
//   'support_email',
//   'whatsapp_number',
// ]);

// const DEFAULT_VALUES: Values = {
//   default_can_price: '',
//   chilled_can_price: '25',
//   subscription_can_price: '18',
//   bulk_can_price: '',
//   bulk_threshold: '',
//   market_can_price: '',
//   convenience_fee: '',
//   min_can_price: '',
//   max_can_price: '',
//   platform_fee: '',
//   plumber_booking_fee: '',
//   supplier_commission: '',
//   bulk_commission: '',
//   service_radius_km: '',
//   max_cans_per_order: '',
//   emergency_surcharge: '',
//   support_phone: '',
//   support_email: '',
//   whatsapp_number: '',
//   maintenance_mode: 'false',
//   auto_assign_orders: 'false',
// };

// function isBooleanKey(key: ManagedKey): boolean {
//   return BOOLEAN_KEYS.has(key);
// }

// function isNumericKey(key: ManagedKey): boolean {
//   return (
//     CURRENCY_KEYS.has(key) ||
//     PERCENTAGE_KEYS.has(key) ||
//     INTEGER_KEYS.has(key) ||
//     DECIMAL_KEYS.has(key)
//   );
// }

// function getInputType(key: ManagedKey): string {
//   if (key === 'support_email') return 'email';

//   if (
//     key === 'support_phone' ||
//     key === 'whatsapp_number'
//   ) {
//     return 'tel';
//   }

//   if (isNumericKey(key)) return 'number';

//   return 'text';
// }

// function getStep(key: ManagedKey): string | undefined {
//   if (INTEGER_KEYS.has(key)) return '1';
//   if (DECIMAL_KEYS.has(key)) return '0.1';

//   if (
//     CURRENCY_KEYS.has(key) ||
//     PERCENTAGE_KEYS.has(key)
//   ) {
//     return '0.01';
//   }

//   return undefined;
// }

// function getPrefix(key: ManagedKey): string {
//   return CURRENCY_KEYS.has(key) ? '₹' : '';
// }

// function getSuffix(key: ManagedKey): string {
//   if (PERCENTAGE_KEYS.has(key)) return '%';
//   if (key === 'service_radius_km') return 'km';
//   if (key === 'max_cans_per_order') return 'cans';

//   return '';
// }

// function normaliseValue(value: unknown): string {
//   if (value === undefined || value === null) {
//     return '';
//   }

//   if (typeof value === 'boolean') {
//     return value ? 'true' : 'false';
//   }

//   return String(value);
// }

// function validateValues(values: Values): string | null {
//   const minPrice = values.min_can_price.trim();
//   const maxPrice = values.max_can_price.trim();
//   const defaultPrice = values.default_can_price.trim();

//   if (minPrice !== '') {
//     const value = Number(minPrice);

//     if (!Number.isFinite(value) || value < 0) {
//       return 'Minimum can price must be a valid non-negative number.';
//     }
//   }

//   if (maxPrice !== '') {
//     const value = Number(maxPrice);

//     if (!Number.isFinite(value) || value < 0) {
//       return 'Maximum can price must be a valid non-negative number.';
//     }
//   }

//   if (defaultPrice !== '') {
//     const value = Number(defaultPrice);

//     if (!Number.isFinite(value) || value < 0) {
//       return 'Default can price must be a valid non-negative number.';
//     }
//   }

//   if (
//     minPrice !== '' &&
//     maxPrice !== '' &&
//     Number(minPrice) > Number(maxPrice)
//   ) {
//     return 'Minimum can price cannot be greater than maximum can price.';
//   }

//   if (
//     defaultPrice !== '' &&
//     minPrice !== '' &&
//     Number(defaultPrice) < Number(minPrice)
//   ) {
//     return 'Default can price cannot be below the minimum price.';
//   }

//   if (
//     defaultPrice !== '' &&
//     maxPrice !== '' &&
//     Number(defaultPrice) > Number(maxPrice)
//   ) {
//     return 'Default can price cannot be above the maximum price.';
//   }

//   for (const key of PERCENTAGE_KEYS) {
//     const raw = values[key]?.trim() ?? '';

//     if (raw === '') continue;

//     const value = Number(raw);

//     if (!Number.isFinite(value) || value < 0 || value > 100) {
//       return `${LABELS[key]} must be between 0 and 100%.`;
//     }
//   }

//   for (const key of INTEGER_KEYS) {
//     const raw = values[key]?.trim() ?? '';

//     if (raw === '') continue;

//     const value = Number(raw);

//     if (
//       !Number.isInteger(value) ||
//       value < 1
//     ) {
//       return `${LABELS[key]} must be a positive whole number.`;
//     }
//   }

//   for (const key of DECIMAL_KEYS) {
//     const raw = values[key]?.trim() ?? '';

//     if (raw === '') continue;

//     const value = Number(raw);

//     if (!Number.isFinite(value) || value <= 0) {
//       return `${LABELS[key]} must be greater than 0.`;
//     }
//   }

//   for (const key of CURRENCY_KEYS) {
//     const raw = values[key]?.trim() ?? '';

//     if (raw === '') continue;

//     const value = Number(raw);

//     if (!Number.isFinite(value) || value < 0) {
//       return `${LABELS[key]} must be a valid non-negative amount.`;
//     }
//   }

//   if (
//     values.support_email.trim() !== '' &&
//     !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
//       values.support_email.trim()
//     )
//   ) {
//     return 'Please enter a valid support email address.';
//   }

//   for (const key of [
//     'support_phone',
//     'whatsapp_number',
//   ] as const) {
//     const raw = values[key]
//       .replace(/\D/g, '')
//       .trim();

//     if (raw !== '' && raw.length !== 10) {
//       return `${LABELS[key]} must contain exactly 10 digits.`;
//     }
//   }

//   return null;
// }

// function buildRequestBody(
//   values: Values
// ): Record<string, unknown> {
//   const body: Record<string, unknown> = {};

//   for (const key of MANAGED_KEYS) {
//     const raw = values[key]?.trim() ?? '';

//     if (isBooleanKey(key)) {
//       body[key] =
//         raw === 'true' ||
//         raw === '1';

//       continue;
//     }

//     /*
//      * Empty values are omitted so existing server-side
//      * settings are not accidentally overwritten.
//      */
//     if (raw === '') {
//       continue;
//     }

//     if (isNumericKey(key)) {
//       body[key] = Number(raw);
//       continue;
//     }

//     if (
//       key === 'support_phone' ||
//       key === 'whatsapp_number'
//     ) {
//       body[key] = raw.replace(/\D/g, '');
//       continue;
//     }

//     body[key] = raw;
//   }

//   return body;
// }

// function groupKeys() {
//   return {
//     pricing: [
//       'default_can_price',
//       'min_can_price',
//       'max_can_price',
//       'platform_fee',
//       'plumber_booking_fee',
//       'emergency_surcharge',
//     ] as ManagedKey[],

//     commissions: [
//       'supplier_commission',
//       'bulk_commission',
//     ] as ManagedKey[],

//     operations: [
//       'service_radius_km',
//       'max_cans_per_order',
//       'auto_assign_orders',
//       'maintenance_mode',
//     ] as ManagedKey[],

//     support: [
//       'support_phone',
//       'support_email',
//       'whatsapp_number',
//     ] as ManagedKey[],
//   };
// }

// export default function AdminSettingsPage() {
//   const [loading, setLoading] =
//     useState(true);

//   const [saving, setSaving] =
//     useState(false);

//   const [values, setValues] =
//     useState<Values>(DEFAULT_VALUES);

//   const [savedValues, setSavedValues] =
//     useState<Values>(DEFAULT_VALUES);

//   const [error, setError] =
//     useState<string | null>(null);

//   const groups = useMemo(
//     () => groupKeys(),
//     []
//   );

//   const hasChanges = useMemo(
//     () =>
//       MANAGED_KEYS.some(
//         (key) =>
//           values[key] !== savedValues[key]
//       ),
//     [savedValues, values]
//   );

//   const load = useCallback(
//     async () => {
//       setLoading(true);
//       setError(null);

//       try {
//         const data =
//           await adminSettingsGet();

//         const source =
//           data as Record<
//             string,
//             unknown
//           >;

//         const next: Values = {
//           ...DEFAULT_VALUES,
//         };

//         const read = (
//           key: string,
//           ...aliases: string[]
//         ) => {
//           for (
//             const candidate of [
//               key,
//               ...aliases,
//             ]
//           ) {
//             const value =
//               source[candidate];

//             if (
//               value !== undefined &&
//               value !== null
//             ) {
//               return value;
//             }
//           }

//           return undefined;
//         };

//         for (
//           const key of MANAGED_KEYS
//         ) {
//           let value: unknown;

//           if (
//             key ===
//             'supplier_commission'
//           ) {
//             value = read(
//               'supplier_commission',
//               'supplier_commission_rate'
//             );
//           } else if (
//             key === 'support_phone'
//           ) {
//             value = read(
//               'support_phone',
//               'phone_primary'
//             );
//           } else {
//             value = read(key);
//           }

//           next[key] =
//             normaliseValue(value);
//         }

//         // Preserve the stored values for dirty-state comparison, but display
//         // approved launch pricing and never present an invalid bulk "discount".
//         const storedValues: Values = { ...next };
//         const normalPrice = 20;
//         const chilledPrice = 25;
//         const configuredRecurring = Number(next.subscription_can_price);
//         const recurringPrice = Number.isFinite(configuredRecurring) && configuredRecurring > 0 && configuredRecurring < normalPrice
//           ? Math.min(configuredRecurring, 18)
//           : 18;
//         const effectiveBulk = 20;

//         next.default_can_price = String(normalPrice);
//         next.chilled_can_price = String(chilledPrice);
//         next.subscription_can_price = String(recurringPrice);
//         next.bulk_can_price = String(effectiveBulk);

//         setValues(next);
//         setSavedValues(storedValues);
//       } catch (cause: unknown) {
//         const message =
//           cause instanceof Error
//             ? cause.message
//             : 'Failed to load settings.';

//         setError(message);
//         toast.error(message);
//       } finally {
//         setLoading(false);
//       }
//     },
//     []
//   );

//   useEffect(() => {
//     void load();
//   }, [load]);

//   const updateValue = (
//     key: ManagedKey,
//     value: string
//   ) => {
//     setValues((current) => ({
//       ...current,
//       [key]: value,
//     }));

//     setError(null);
//   };

//   const handleSave = async () => {
//     const validationError =
//       validateValues(values);

//     if (validationError) {
//       setError(validationError);
//       toast.error(validationError);
//       return;
//     }

//     setSaving(true);
//     setError(null);

//     try {
//       const body =
//         buildRequestBody(values);

//       await adminSettingsPut(body);

//       /*
//        * Clear client-side public settings cache.
//        */
//       safeRemove('aw_settings_v3');
//       safeRemove('aw_settings_v3_ts');

//       /*
//        * Treat current values as saved immediately.
//        * Then refresh from the server to ensure the
//        * actual persisted state is displayed.
//        */
//       setSavedValues(values);

//       toast.success(
//         'Settings saved successfully.'
//       );

//       await load();
//     } catch (cause: unknown) {
//       const message =
//         cause instanceof Error
//           ? cause.message
//           : 'Failed to save settings.';

//       setError(message);
//       toast.error(message);
//     } finally {
//       setSaving(false);
//     }
//   };

//   const renderField = (
//     key: ManagedKey
//   ) => {
//     const booleanField =
//       isBooleanKey(key);

//     const prefix =
//       getPrefix(key);

//     const suffix =
//       getSuffix(key);

//     return (
//       <div
//         key={key}
//         className="space-y-2"
//       >
//         <label
//           htmlFor={`setting-${key}`}
//           className="block"
//         >
//           <span className="flex items-center justify-between gap-4">
//             <span className="text-sm font-medium text-white">
//               {LABELS[key]}
//             </span>

//             {booleanField && (
//               <span className="text-[11px] uppercase tracking-wide text-slate-500">
//                 Toggle
//               </span>
//             )}
//           </span>

//           <span className="mt-1 block text-xs leading-5 text-slate-400">
//             {DESCRIPTIONS[key]}
//           </span>
//         </label>

//         {booleanField ? (
//           <select
//             id={`setting-${key}`}
//             aria-label={LABELS[key]}
//             disabled={saving}
//             value={
//               values[key] ?? 'false'
//             }
//             onChange={(event) =>
//               updateValue(
//                 key,
//                 event.target.value
//               )
//             }
//             className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/10 disabled:cursor-not-allowed disabled:opacity-60"
//           >
//             <option value="false">
//               Off
//             </option>
//             <option value="true">
//               On
//             </option>
//           </select>
//         ) : (
//           <div className="relative">
//             {prefix && (
//               <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
//                 {prefix}
//               </span>
//             )}

//             <input
//               id={`setting-${key}`}
//               aria-label={LABELS[key]}
//               type={getInputType(key)}
//               inputMode={
//                 isNumericKey(key)
//                   ? 'decimal'
//                   : key ===
//                       'support_phone' ||
//                     key ===
//                       'whatsapp_number'
//                   ? 'numeric'
//                   : undefined
//               }
//               step={getStep(key)}
//               min={
//                 PERCENTAGE_KEYS.has(key)
//                   ? 0
//                   : INTEGER_KEYS.has(key)
//                   ? 1
//                   : isNumericKey(key)
//                   ? 0
//                   : undefined
//               }
//               max={
//                 PERCENTAGE_KEYS.has(key)
//                   ? 100
//                   : undefined
//               }
//               disabled={saving}
//               value={
//                 values[key] ?? ''
//               }
//               onChange={(event) =>
//                 updateValue(
//                   key,
//                   event.target.value
//                 )
//               }
//               className={[
//                 'w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none transition',
//                 'placeholder:text-slate-600',
//                 'focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/10',
//                 'disabled:cursor-not-allowed disabled:opacity-60',
//                 prefix ? 'pl-8' : '',
//                 suffix ? 'pr-14' : '',
//               ].join(' ')}
//             />

//             {suffix && (
//               <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500">
//                 {suffix}
//               </span>
//             )}
//           </div>
//         )}
//       </div>
//     );
//   };

//   const renderSection = (
//     title: string,
//     description: string,
//     keys: ManagedKey[]
//   ) => (
//     <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
//       <div className="mb-5">
//         <h2 className="text-sm font-semibold text-white">
//           {title}
//         </h2>

//         <p className="mt-1 text-xs leading-5 text-slate-400">
//           {description}
//         </p>
//       </div>

//       <div className="grid gap-5 md:grid-cols-2">
//         {keys.map(renderField)}
//       </div>
//     </section>
//   );

//   return (
//     <div className="mx-auto w-full max-w-5xl space-y-6 pb-10">
//       {/* Header */}
//       <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
//         <div>
//           <div className="mb-2 inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-sky-300">
//             Admin control
//           </div>

//           <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
//             Settings
//           </h1>

//           <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
//             Manage pricing, commissions,
//             operations and customer support
//             settings for AuroWater.
//           </p>
//         </div>

//         <div
//           className={[
//             'rounded-full border px-3 py-1.5 text-xs font-medium',
//             hasChanges
//               ? 'border-amber-400/20 bg-amber-400/10 text-amber-300'
//               : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
//           ].join(' ')}
//         >
//           {hasChanges
//             ? 'Unsaved changes'
//             : 'All changes saved'}
//         </div>
//       </div>

//       {/* Warning */}
//       <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.06] p-4">
//         <div className="flex gap-3">
//           <div className="mt-0.5 text-amber-300">
//             ⚠
//           </div>

//           <div>
//             <p className="text-sm font-medium text-amber-200">
//               Production settings
//             </p>

//             <p className="mt-1 text-xs leading-5 text-amber-100/60">
//               Changes can affect live pricing,
//               order assignment and customer
//               operations. Review values before
//               saving.
//             </p>
//           </div>
//         </div>
//       </div>

//       {/* Error */}
//       {error && (
//         <div
//           role="alert"
//           className="rounded-2xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm text-red-200"
//         >
//           {error}
//         </div>
//       )}

//       {/* Loading */}
//       {loading ? (
//         <div className="space-y-4">
//           {[1, 2, 3].map((item) => (
//             <div
//               key={item}
//               className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]"
//             />
//           ))}
//         </div>
//       ) : (
//         <>
//           {renderSection(
//             'Pricing',
//             'Control customer-facing pricing and service charges.',
//             groups.pricing
//           )}

//           {renderSection(
//             'Commissions',
//             'Configure supplier and bulk-order commission rates.',
//             groups.commissions
//           )}

//           {renderSection(
//             'Operations',
//             'Control service coverage, order limits and operational automation.',
//             groups.operations
//           )}

//           {renderSection(
//             'Customer support',
//             'Configure the contact details customers see when they need help.',
//             groups.support
//           )}

//           {/* Save bar */}
//           <div className="sticky bottom-4 z-10 rounded-2xl border border-white/10 bg-slate-950/90 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl">
//             <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
//               <div>
//                 <p className="text-sm font-medium text-white">
//                   {hasChanges
//                     ? 'You have unsaved changes'
//                     : 'Settings are up to date'}
//                 </p>

//                 <p className="mt-0.5 text-xs text-slate-500">
//                   Public settings cache is cleared
//                   after a successful save.
//                 </p>
//               </div>

//               <button
//                 type="button"
//                 disabled={
//                   saving ||
//                   !hasChanges
//                 }
//                 onClick={() =>
//                   void handleSave()
//                 }
//                 className="inline-flex min-w-36 items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-40"
//               >
//                 {saving ? (
//                   <>
//                     <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
//                     Saving…
//                   </>
//                 ) : (
//                   'Save changes'
//                 )}
//               </button>
//             </div>
//           </div>
//         </>
//       )}
//     </div>
//   );
// }

