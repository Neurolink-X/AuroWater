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
  const [locating, setLocating] = useState(false);
  const [accuracyWarning, setAccuracyWarning] = useState('');

  const locate = () => {
    if (locating) return;
    setAccuracyWarning('');
    if (!navigator.geolocation) {
      toast.error('Location is not available on this device.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude, accuracy } = pos.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy)) {
          toast.error('Location accuracy is unavailable. Enter your address or PIN code manually.');
          return;
        }
        if (accuracy > 1500) {
          setAccuracyWarning('Location is too approximate to confirm a delivery area. Please enable precise location or enter your address and PIN code.');
          return;
        }
        if (accuracy > 200) setAccuracyWarning('Your location is approximate. Confirm your building and PIN code before ordering.');
        const zone = getServiceZone(latitude, longitude);
        if (!zone) {
          setBlocked(true);
          return;
        }
        setBlocked(false);
        onInZone?.(zone.city, latitude, longitude);
        toast.success(`Your location is near ${zone.city}. Verify delivery availability at checkout.`);
      },
      () => {
        setLocating(false);
        toast.error('Could not read your location. Allow location access or pick a city address.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
      <p className="font-semibold text-slate-800">Delivery area</p>
      <p className="mt-1 text-slate-600">We currently check availability around {SERVICE_ZONES.map((z) => z.city).join(', ')}. Your exact address and an available provider must be confirmed at checkout.</p>
      <button
        type="button"
        onClick={locate}
        disabled={locating}
        aria-busy={locating}
        className="mt-3 rounded-xl bg-[#0A1628] px-4 py-2 text-xs font-extrabold text-white"
      >
        {locating ? 'Detecting location…' : 'Use my location'}
      </button>
      {accuracyWarning && <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{accuracyWarning}</p>}
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
