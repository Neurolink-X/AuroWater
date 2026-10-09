import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '20L Water Can Delivery in Kanpur, Lucknow & Gorakhpur | AuroTap',
  description: 'Choose your city to request 20L Normal RO water can delivery or Chilled RO for one-time gatherings. Check address availability and current prices before ordering.',
  keywords: ['20 litre water can delivery Uttar Pradesh', 'water delivery Kanpur', 'water delivery Lucknow', 'water delivery Gorakhpur', '20L water can home delivery'],
  alternates: { canonical: '/water-delivery' },
  openGraph: {
    title: 'Water Can Delivery in Kanpur, Lucknow & Gorakhpur | AuroTap',
    description: 'Choose your city and check 20L water can delivery availability.',
    url: '/water-delivery',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'AuroTap water can delivery' }],
  },
};

const CITIES = [
  { slug: 'kanpur', name: 'Kanpur', copy: 'Request 20L water can delivery for home and office in eligible areas of Kanpur.' },
  { slug: 'lucknow', name: 'Lucknow', copy: 'Check Normal RO and one-time Chilled RO water options in eligible areas of Lucknow.' },
  { slug: 'gorakhpur', name: 'Gorakhpur', copy: 'Check water can delivery serviceability and available slots in eligible areas of Gorakhpur.' },
] as const;

export default function WaterDeliveryIndexPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="bg-[#071A2B] text-white">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-sky-300">AuroTap · Local delivery</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">20L water can delivery in Uttar Pradesh</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">Choose a configured service city to check delivery availability for your address. Normal RO is designed for everyday use; Chilled RO is a separate one-time option for gatherings where available.</p>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-5 px-5 py-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-3 lg:px-12">
        {CITIES.map((city) => (
          <article key={city.slug} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-sky-700">Service city</p>
            <h2 className="mt-3 text-2xl font-black">{city.name}</h2>
            <p className="mt-3 leading-7 text-slate-600">{city.copy}</p>
            <Link href={`/water-delivery/${city.slug}`} className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-sky-600 px-5 py-3 font-bold text-white hover:bg-sky-500">View city service →</Link>
          </article>
        ))}
      </section>
    </main>
  );
}
