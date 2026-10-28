// src/components/services/ServicePrice.tsx
'use client';

import { useMemo } from 'react';
import { useSettings } from '@/hooks/useSettings';

type ServicePriceProps = {
  serviceKey: string;
  fallback: string;
  unit: string;
  className?: string;
};

/**
 * Created once, reused on every render.
 * (toLocaleString builds a new formatter each time, which is slower.)
 */
const INR = new Intl.NumberFormat('en-IN');

/** Keep this text identical to your old sentence. */
const PRICE_NOTE =
  'This is an indicative starting rate from current public settings. Address, service scope, parts and availability may affect the final quote. Review the total in booking before confirming.';

/** A price is valid only if it is a real number above zero. */
function toValidAmount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;
}

/** Reads the same public pricing settings used by booking and the service list. */
export default function ServicePrice({
  serviceKey,
  fallback,
  unit,
  className = '',
}: ServicePriceProps) {
  const { settings, loading } = useSettings();

  const amount = useMemo(() => {
    let configured: unknown;

    if (serviceKey === 'water_can') {
      configured = settings?.default_can_price;
    } else if (serviceKey === 'chilled_water') {
      configured = settings?.chilled_can_price;
    } else {
      // "?." means: if prices are missing, do not crash the page.
      configured = (
        settings?.service_base_prices as Record<string, number> | undefined
      )?.[serviceKey];
    }

    return toValidAmount(configured);
  }, [settings, serviceKey]);

  const isWaiting = loading && amount === null;
  const display = amount === null ? fallback : `₹${INR.format(amount)}`;

  return (
    <div className={className} aria-busy={isWaiting}>
      <p
        aria-live="polite"
        className={`mt-2 text-4xl font-black tabular-nums transition-opacity duration-300 ${
          isWaiting ? 'animate-pulse opacity-70' : 'opacity-100'
        }`}
      >
        {display}
      </p>

      <p className="mt-1 text-sm text-slate-400">{unit}</p>

      <p className="mt-5 border-t border-white/10 pt-4 text-sm leading-6 text-slate-300">
        {PRICE_NOTE}
      </p>
    </div>
  );
}








// 'use client';

// import { useSettings } from '@/hooks/useSettings';

// type ServicePriceProps = {
//   serviceKey: string;
//   fallback: string;
//   unit: string;
// };

// /** Reads the same public pricing settings used by booking and the service list. */
// export default function ServicePrice({ serviceKey, fallback, unit }: ServicePriceProps) {
//   const { settings, loading } = useSettings();
//   const configured = serviceKey === 'water_can'
//     ? settings.default_can_price
//     : serviceKey === 'chilled_water'
//       ? settings.chilled_can_price
//       : (settings.service_base_prices as Record<string, number>)[serviceKey];
//   const amount = typeof configured === 'number' && Number.isFinite(configured) && configured > 0 ? configured : null;

//   return (
//     <>
//       <p className="mt-2 text-4xl font-black">
//         {loading && amount === null ? fallback : amount === null ? fallback : `₹${amount.toLocaleString('en-IN')}`}
//       </p>
//       <p className="mt-1 text-sm text-slate-400">{unit}</p>
//       <p className="mt-5 border-t border-white/10 pt-4 text-sm leading-6 text-slate-300">
//         This is an indicative starting rate from current public settings. Address, service scope, parts and availability may affect the final quote. Review the total in booking before confirming.
//       </p>
//     </>
//   );
// }
