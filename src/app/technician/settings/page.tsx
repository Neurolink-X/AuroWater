'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LanguageToggle from '@/components/LanguageToggle';
import SpecialistStatusPanel from '@/components/technician/SpecialistStatusPanel';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const services = [
  { key: 'plumbing', src: '/images/plumbing.webp', en: 'Plumbing', hi: 'प्लंबिंग' },
  { key: 'borewell', src: '/images/borewell.webp', en: 'Borewell', hi: 'बोरवेल' },
  { key: 'tank_cleaning', src: '/images/tank_cleaning.webp', en: 'Tank cleaning', hi: 'टंकी की सफाई' },
  { key: 'ro_service', src: '/images/ro_service.webp', en: 'RO service', hi: 'RO सर्विस' },
  { key: 'motor_pump', src: '/images/motor_pump.webp', en: 'Motor pump', hi: 'मोटर पंप' },
] as const;

export default function TechnicianSettingsPage() {
  const router = useRouter();
  const { hydrated, isLoggedIn, role } = useAuth();
  const { language } = useLanguage();
  const hi = language === 'hi';
  const allowed = hydrated && isLoggedIn && (role === 'technician');
  useEffect(() => {
    if (hydrated && (!isLoggedIn || role !== 'technician')) {
      router.replace('/auth/login?returnTo=%2Ftechnician%2Fsettings');
    }
  }, [hydrated,isLoggedIn,role,router]);
  if (!hydrated || !allowed) return <main className="min-h-screen bg-slate-50 p-6 text-slate-600">{hi ? 'खाता जाँचा जा रहा है…' : 'Checking account access…'}</main>;
  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link className="text-sm font-bold text-emerald-700 underline" href="/technician/dashboard">{hi ? 'डैशबोर्ड पर जाएँ' : 'Back to dashboard'}</Link>
        <LanguageToggle />
      </div>
      <header><h1 className="text-2xl font-extrabold sm:text-3xl">{hi ? 'प्रोफेशनल सेटिंग्स' : 'Professional settings'}</h1>
        <p className="mt-2 text-sm text-slate-600">{hi ? 'अपना पंजीकृत ईमेल, कार्य शहर, सेवा अनुमतियाँ और आवेदन यहाँ देखें।' :
          'Review your sign-in email, operating city, approved services and application status here.'}</p>
      </header>
      <SpecialistStatusPanel enabled={allowed} />
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-lg font-bold">{hi ? 'उपलब्ध सेवा श्रेणियाँ' : 'Service categories'}</h2>
        <p className="mt-1 text-xs text-slate-600">{hi ? 'ये केवल सेवाओं के उदाहरण हैं। आपकी स्वीकृत सेवाएँ ऊपर दिखाई देती हैं।' :
          'Examples only. These images do not indicate that your account is approved for these services.'}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {services.map(s=><div key={s.key} className="overflow-hidden rounded-xl border border-slate-200">
            <Image src={s.src} width={320} height={190} sizes="(max-width:640px) 45vw, 175px"
              alt={hi?s.hi:s.en} className="h-24 w-full object-cover" loading="lazy" />
            <p className="p-2 text-xs font-semibold">{hi?s.hi:s.en}</p>
          </div>)}
        </div>
      </section>
      <nav className="flex flex-wrap gap-3 text-sm font-semibold text-emerald-700">
        <Link href="/technician/dashboard#profile" className="underline">{hi ? 'प्रोफ़ाइल बदलें' : 'Edit profile'}</Link>
        <Link href="/technician/dashboard#availability" className="underline">{hi ? 'उपलब्धता' : 'Availability'}</Link>
        <Link href="/technician/dashboard#documents" className="underline">{hi ? 'दस्तावेज़ सत्यापन' : 'Document verification'}</Link>
        <Link href="/contact?subject=technician" className="underline">{hi ? 'सहायता' : 'Support'}</Link>
      </nav>
    </div>
  </main>;
}
