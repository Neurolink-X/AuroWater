import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { publishedNews } from '@/lib/blog/reviewed-news';

export const revalidate = 3600;
type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return publishedNews().map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = publishedNews().find((news) => news.slug === slug);
  if (!item) return { robots: { index: false, follow: false } };
  return {
    title: `${item.title} | AuroTap Water Updates`,
    description: item.summary,
    alternates: { canonical: `/blog/news/${item.slug}` },
    openGraph: { type: 'article', title: item.title, description: item.summary,
      publishedTime: item.publish_at, url: `/blog/news/${item.slug}` },
  };
}

export default async function NewsArticle({ params }: Props) {
  const { slug } = await params;
  const item = publishedNews().find((news) => news.slug === slug);
  if (!item) notFound();
  return <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
    <Link href="/blog" className="text-sm font-semibold text-emerald-700 hover:underline">← All water guides and updates</Link>
    <article className="mt-8">
      <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Verified source update</p>
      <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">{item.title}</h1>
      <p className="mt-4 text-lg leading-8 text-slate-700">{item.summary}</p>
      <p className="mt-6 text-sm text-slate-600">Source: <a href={item.source_url}
        target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-800 underline">{item.source_name}</a>
        {' · '}Source published {new Date(item.source_published_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
      </p>
      <p className="mt-2 text-sm text-slate-500">Reviewed on {new Date(item.reviewed_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}.
        Source information is attributed; availability and offers from AuroTap are independent and checked at checkout.</p>
    </article>
    <aside className="mt-12 rounded-2xl border border-emerald-100 bg-emerald-50 p-6">
      <h2 className="font-bold text-slate-900">Need water or home services?</h2>
      <p className="mt-2 text-sm text-slate-700">Check your address and current service availability. The final price is shown before confirmation.</p>
      <Link className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-emerald-700 px-4 font-bold text-white" href="/services">Explore AuroTap services →</Link>
    </aside>
  </main>;
}
