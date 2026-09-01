import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta(
  'Careers at AuroWater | Delivery & Tech Jobs in UP',
  'Join AuroWater as a delivery partner or technician in Gorakhpur, Kanpur and Lucknow.',
  '/careers'
);

export default function CareersPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-[Syne] text-3xl font-black text-[#0A1628]">Careers at AuroWater</h1>
      <p className="mt-4 text-slate-600">
        We hire delivery partners and technicians across Gorakhpur, Kanpur and Lucknow. WhatsApp us to apply.
      </p>
      <a
        href="https://wa.me/919889305803?text=Hi%20I%20want%20to%20join%20AuroWater"
        className="mt-6 inline-flex rounded-xl bg-cyan-500 px-5 py-3 text-sm font-extrabold text-slate-950"
      >
        Apply on WhatsApp
      </a>
    </div>
  );
}
