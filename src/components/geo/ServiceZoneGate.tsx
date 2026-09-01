'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import WaitlistPanel from '@/components/ui/WaitlistPanel';
import { OUT_OF_ZONE_MESSAGE, SERVICE_ZONES, getServiceZone } from '@/lib/geo';

type Props = {
  onInZone?: (city: string, lat: number, lng: number) => void;
};

export default function ServiceZoneGate({ onInZone }: Props) {
  const [blocked, setBlocked] = useState(false);
  const [cityGuess, setCityGuess] = useState('');

  const locate = () => {
    if (!navigator.geolocation) {
      toast.error('Location is not available on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const zone = getServiceZone(latitude, longitude);
        if (!zone) {
          setBlocked(true);
          return;
        }
        setBlocked(false);
        onInZone?.(zone.city, latitude, longitude);
        toast.success(`We deliver in ${zone.city}.`);
      },
      () => toast.error('Could not read your location. Allow location access or pick a city address.')
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
      <p className="font-semibold text-slate-800">Delivery area</p>
      <p className="mt-1 text-slate-600">We currently serve {SERVICE_ZONES.map((z) => z.city).join(', ')}.</p>
      <button
        type="button"
        onClick={locate}
        className="mt-3 rounded-xl bg-[#0A1628] px-4 py-2 text-xs font-extrabold text-white"
      >
        Use my location
      </button>
      {blocked && (
        <div className="mt-4 space-y-3">
          <p className="font-semibold text-amber-950">{OUT_OF_ZONE_MESSAGE}</p>
          <input
            className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-slate-900"
            placeholder="Your city name"
            value={cityGuess}
            onChange={(e) => setCityGuess(e.target.value)}
          />
          {cityGuess.trim().length >= 2 ? (
            <div className="text-left">
              <WaitlistPanel cityName={cityGuess.trim()} cityId={null} role="customer" source="book" />
            </div>
          ) : (
            <p className="text-xs text-slate-500">Enter your city to join the waitlist.</p>
          )}
        </div>
      )}
    </div>
  );
}
