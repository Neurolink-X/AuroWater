import type { Metadata } from 'next';
import Link from 'next/link';
import { publishedGuides } from '@/lib/blog/posts';

export const revalidate = 3600;
export const metadata: Metadata = {
  title: 'Water Delivery & Home Service Guides | AuroTap',
  description: 'Useful guides on water-can delivery, RO servicing, and everyday water problems. Check service availability before booking.',
  alternates: { canonical: '/blog' },
};

export default function BlogIndex() {
  const posts = publishedGuides();
  return (
    <main className="mx-auto min-h-[70vh] max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-10">
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">AuroTap guides</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">Water & home service guides</h1>
        <p className="mt-4 max-w-2xl text-slate-600">Practical tips, not unverified news. Check your address for current service availability and final prices.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {posts.map((post) => (
          <article key={post.slug} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{post.category}</p>
            <h2 className="mt-3 text-xl font-semibold text-slate-900">
              <Link className="hover:text-emerald-700 focus-visible:underline" href={`/blog/${post.slug}`}>{post.title}</Link>
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{post.description}</p>
            <p className="mt-4 text-xs text-slate-500">Published {new Date(post.publishAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })}</p>
            <Link className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-emerald-700 hover:underline" href={`/blog/${post.slug}`}>Read guide →</Link>
          </article>
        ))}
      </div>
    </main>
  );
}
