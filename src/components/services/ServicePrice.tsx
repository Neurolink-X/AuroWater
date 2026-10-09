'use client';

import { useSettings } from '@/hooks/useSettings';

type ServicePriceProps = {
  serviceKey: string;
  fallback: string;
  unit: string;
};

/** Reads the same public pricing settings used by booking and the service list. */
export default function ServicePrice({ serviceKey, fallback, unit }: ServicePriceProps) {
  const { settings, loading } = useSettings();
  const configured = serviceKey === 'water_can'
    ? settings.default_can_price
    : serviceKey === 'chilled_water'
      ? settings.chilled_can_price
      : (settings.service_base_prices as Record<string, number>)[serviceKey];
  const amount = typeof configured === 'number' && Number.isFinite(configured) && configured > 0 ? configured : null;

  return (
    <>
      <p className="mt-2 text-4xl font-black">
        {loading && amount === null ? fallback : amount === null ? fallback : `₹${amount.toLocaleString('en-IN')}`}
      </p>
      <p className="mt-1 text-sm text-slate-400">{unit}</p>
      <p className="mt-5 border-t border-white/10 pt-4 text-sm leading-6 text-slate-300">
        This is an indicative starting rate from current public settings. Address, service scope, parts and availability may affect the final quote. Review the total in booking before confirming.
      </p>
    </>
  );
}
