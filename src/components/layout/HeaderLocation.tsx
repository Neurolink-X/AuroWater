'use client';

import { useId, useMemo, useState } from 'react';
import type { City } from '@/lib/cities';

type HeaderLocationProps = {
  city: string;
  cities: City[];
  onCityChange: (city: string) => void;
  signedInCustomer: boolean;
};

function LocationIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z"
      />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={`h-3.5 w-3.5 transition-transform ${
        open ? 'rotate-180' : ''
      }`}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m6 9 6 6 6-6"
      />
    </svg>
  );
}

function getCityStatus(city: City): string {
  if (city.status === 'coming_soon') {
    return 'Coming soon';
  }

  if (city.status === 'active') {
    return 'Available';
  }

  return '';
}

export default function HeaderLocation({
  city,
  cities,
  onCityChange,
  signedInCustomer,
}: HeaderLocationProps) {
  const [open, setOpen] = useState(false);
  const listboxId = useId();

  const selectedCity = useMemo(
    () =>
      cities.find(
        (item) =>
          item.name.toLowerCase() === city.toLowerCase()
      ),
    [cities, city]
  );

  const availableCities = useMemo(
    () =>
      cities.filter(
        (item) =>
          item.status === 'active' ||
          item.status === 'coming_soon'
      ),
    [cities]
  );

  const selectCity = (value: string) => {
    onCityChange(value);
    setOpen(false);
  };

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className="flex h-10 max-w-[150px] items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-200 transition-colors hover:border-cyan-500/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 sm:max-w-[190px]"
      >
        <LocationIcon />

        <span className="min-w-0 flex-1 truncate text-left font-medium">
          {selectedCity?.name ?? city}
        </span>

        <ChevronIcon open={open} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close location selector"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />

          <div
            id={listboxId}
            role="listbox"
            aria-label="Select delivery city"
            className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#0F1D33] p-2 shadow-2xl shadow-black/40"
          >
            <div className="px-3 pb-2 pt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Delivery location
              </p>

              <p className="mt-1 text-xs text-neutral-400">
                Choose your city to see local availability.
              </p>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {availableCities.length > 0 ? (
                availableCities.map((item) => {
                  const selected =
                    item.name.toLowerCase() ===
                    city.toLowerCase();

                  const status = getCityStatus(item);

                  return (
                    <button
                      key={item.id ?? item.name}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => selectCity(item.name)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                        selected
                          ? 'bg-cyan-500/10 text-cyan-300'
                          : 'text-neutral-200 hover:bg-white/5'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {item.name}
                        </span>

                        {status ? (
                          <span className="mt-0.5 block text-xs text-neutral-500">
                            {status}
                          </span>
                        ) : null}
                      </span>

                      {selected ? (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          className="h-4 w-4 shrink-0 text-cyan-400"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m5 12 4 4L19 6"
                          />
                        </svg>
                      ) : null}
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-4 text-sm text-neutral-400">
                  City availability is loading.
                </div>
              )}
            </div>

            <div className="mt-2 border-t border-white/5 px-3 pb-2 pt-3">
              <p className="text-xs leading-5 text-neutral-500">
                {signedInCustomer
                  ? 'Your selected city is saved for your next visit.'
                  : 'Sign in when you are ready to save addresses and book services.'}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
