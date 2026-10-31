import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { publishedGuides } from '@/lib/blog/posts';
import { publishedNews } from '@/lib/blog/reviewed-news';

export const revalidate = 3600;
export const metadata: Metadata = {
  title: 'Water Delivery & Home Service Guides | AuroTap',
  description: 'Useful guides on water-can delivery, RO servicing, and everyday water problems. Check service availability before booking.',
  alternates: { canonical: '/blog' },
};

export default function BlogIndex() {
  const posts = publishedGuides();
  const news = publishedNews();
  return (
    <main className="mx-auto min-h-[70vh] max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-10">
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">AuroTap guides</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">Water & home service guides</h1>
        <p className="mt-4 max-w-2xl text-slate-600">Practical tips, not unverified news. Check your address for current service availability and final prices.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {posts.map((post) => (
          <article key={post.slug} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {post.coverImage && <Image src={post.coverImage} alt="Illustrated checklist for 20-litre water can delivery" width={1200} height={630} className="h-auto w-full" loading="lazy" />}
            <div className="p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{post.category}</p>
            <h2 className="mt-3 text-xl font-semibold text-slate-900">
              <Link className="hover:text-emerald-700 focus-visible:underline" href={`/blog/${post.slug}`}>{post.title}</Link>
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{post.description}</p>
            <p className="mt-4 text-xs text-slate-500">Published {new Date(post.publishAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })}</p>
            <Link className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-emerald-700 hover:underline" href={`/blog/${post.slug}`}>Read guide →</Link>
            </div>
          </article>
        ))}
      </div>
      {news.length > 0 && <section aria-labelledby="reviewed-news-heading" className="mt-14">
        <h2 id="reviewed-news-heading" className="text-2xl font-bold text-slate-900">Reviewed water updates</h2>
        <p className="mt-2 text-sm text-slate-600">Source-attributed developments reviewed before publication.</p>
        <div className="mt-6 grid gap-5 md:grid-cols-2">{news.map((item) => <article key={item.slug}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold"><Link className="hover:text-emerald-700" href={`/blog/news/${item.slug}`}>{item.title}</Link></h3>
          <p className="mt-3 text-sm text-slate-700">{item.summary}</p>
          <p className="mt-3 text-xs text-slate-500">Reviewed source: {item.source_name}</p>
          <Link className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-emerald-700 hover:underline"
            href={`/blog/news/${item.slug}`}>Read update →</Link>
        </article>)}</div>
      </section>}
    </main>
  );
}
