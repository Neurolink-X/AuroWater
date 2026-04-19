'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminSettingsGet, adminSettingsPut } from '@/lib/api-client';

/** Keys validated by `PUT /api/admin/settings` (must match server SETTINGS_SCHEMA). */
const MANAGED_KEYS = [
  'default_can_price',
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

const LABELS: Record<ManagedKey, string> = {
  default_can_price: 'Default can price (₹)',
  min_can_price: 'Min can price (₹)',
  max_can_price: 'Max can price (₹)',
  platform_fee: 'Platform fee (₹)',
  plumber_booking_fee: 'Plumber booking fee (₹)',
  supplier_commission: 'Supplier commission (%)',
  bulk_commission: 'Bulk commission (%)',
  service_radius_km: 'Service radius (km)',
  max_cans_per_order: 'Max cans per order',
  emergency_surcharge: 'Emergency surcharge (₹)',
  support_phone: 'Support phone (10 digits)',
  support_email: 'Support email',
  whatsapp_number: 'WhatsApp number (10 digits)',
  maintenance_mode: 'Maintenance mode',
  auto_assign_orders: 'Auto-assign orders',
};

function isBoolKey(k: ManagedKey) {
  return k === 'maintenance_mode' || k === 'auto_assign_orders';
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminSettingsGet();
      const next: Record<string, string> = {};
      const d = data as Record<string, unknown>;
      const read = (k: string, ...aliases: string[]) => {
        for (const key of [k, ...aliases]) {
          const v = d[key];
          if (v !== undefined && v !== null) return v;
        }
        return undefined;
      };
      for (const k of MANAGED_KEYS) {
        let v: unknown;
        if (k === 'supplier_commission') {
          v = read('supplier_commission', 'supplier_commission_rate');
        } else if (k === 'support_phone') {
          v = read('support_phone', 'phone_primary');
        } else if (k === 'whatsapp_number') {
          v = read('whatsapp_number');
        } else {
          v = read(k);
        }
        if (v === undefined || v === null) next[k] = '';
        else if (typeof v === 'boolean') next[k] = v ? 'true' : 'false';
        else next[k] = String(v);
      }
      setValues(next);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      for (const k of MANAGED_KEYS) {
        const raw = values[k]?.trim() ?? '';
        if (isBoolKey(k)) {
          body[k] = raw === 'true' || raw === '1';
          continue;
        }
        if (raw === '') continue;
        if (
          k.includes('price') ||
          k.includes('fee') ||
          k.includes('surcharge') ||
          k.includes('radius') ||
          k.includes('max_cans') ||
          k.includes('commission') ||
          k === 'platform_fee'
        ) {
          body[k] = Number(raw);
        } else {
          body[k] = raw;
        }
      }
      await adminSettingsPut(body);
      try {
        localStorage.removeItem('aw_settings_v3');
        localStorage.removeItem('aw_settings_v3_ts');
      } catch {
        /* ignore */
      }
      toast.success('Settings saved. Public pricing will pick up changes on next cache refresh.');
      void load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-300 mt-1">
          Updates persist to Supabase <code className="text-sky-300">settings</code> and clear the public settings
          cache so pricing pages refresh sooner.
        </p>
      </div>

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 space-y-4">
          {MANAGED_KEYS.map((k) => (
            <label key={k} className="block">
              <span className="text-xs text-slate-400 font-medium">{LABELS[k]}</span>
              {isBoolKey(k) ? (
                <select
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
                  value={values[k] ?? 'false'}
                  onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
                >
                  <option value="false">Off</option>
                  <option value="true">On</option>
                </select>
              ) : (
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
                  value={values[k] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
                />
              )}
            </label>
          ))}

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  );
}
