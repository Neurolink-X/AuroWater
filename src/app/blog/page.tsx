import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { publishedGuides } from '@/lib/blog/posts';
import { publishedNews } from '@/lib/blog/reviewed-news';

export const revalidate = 3600;
export const metadata: Metadata = {
  title: 'Water Delivery & Home Care Guides | AuroTap',
  description: 'Practical, reviewed guides to drinking-water delivery, RO maintenance and plumbing. Explore helpful checklists and water updates.',
  alternates: { canonical: '/blog' },
};
const date = (value: string) => new Date(value).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
const readTime = (sections: readonly { paragraphs: readonly string[] }[]) => Math.max(1, Math.ceil(sections.reduce((n, s) => n + s.paragraphs.join(' ').split(/\s+/).length, 0) / 200));

export default function BlogIndex() {
  const posts = publishedGuides();
  const news = publishedNews();
  const [featured, ...others] = posts;
  return <main className="min-h-[70vh] bg-slate-50 text-slate-900">
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-cyan-900 px-4 py-16 text-white sm:px-6 sm:py-24">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" />
      <div className="relative mx-auto max-w-6xl">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-200">AuroTap • Knowledge centre</p>
        <h1 className="mt-5 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">Better water decisions start here.</h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-blue-100 sm:text-lg">Straightforward advice on water delivery, purifier care and home services. Reviewed guidance, without exaggerated promises.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#guides" className="inline-flex min-h-11 items-center rounded-xl bg-white px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-50">Explore guides ↓</a>
          <Link href="/book" className="inline-flex min-h-11 items-center rounded-xl border border-white/40 px-5 py-3 font-semibold text-white hover:bg-white/10">Check service availability →</Link>
        </div>
      </div>
    </section>
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <section id="guides" aria-labelledby="guides-title">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-widest text-teal-700">Editorial guides</p><h2 id="guides-title" className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Helpful reads for your home</h2></div>
          <p className="max-w-md text-sm leading-6 text-slate-600">Service areas and final prices are confirmed during booking, not by an article.</p>
        </div>
        {featured && <article className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg">
          <div className="grid md:grid-cols-2">
            <div className="relative flex min-h-56 items-center justify-center overflow-hidden bg-gradient-to-br from-blue-100 via-cyan-50 to-teal-100">
              {featured.coverImage ? <Image src={featured.coverImage} alt={featured.title + ' editorial illustration'} width={1200} height={630} priority className="h-full w-full object-cover" /> : <span aria-hidden="true" className="text-7xl">💧</span>}
            </div>
            <div className="flex flex-col justify-center p-6 sm:p-10">
              <span className="w-fit rounded-full bg-teal-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-teal-800">Featured guide · {featured.category}</span>
              <h3 className="mt-5 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl"><Link href={`/blog/${featured.slug}`} className="hover:text-teal-700">{featured.title}</Link></h3>
              <p className="mt-4 leading-7 text-slate-600">{featured.description}</p>
              <p className="mt-5 text-sm text-slate-500">{date(featured.publishAt)} · {readTime(featured.sections)} min read</p>
              <Link href={`/blog/${featured.slug}`} className="mt-6 inline-flex min-h-11 w-fit items-center font-bold text-teal-700 hover:underline">Read the guide <span aria-hidden="true" className="ml-2">→</span></Link>
            </div>
          </div>
        </article>}
        {others.length > 0 && <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{others.map(post => <article key={post.slug} className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <span className="text-xs font-bold uppercase tracking-wide text-teal-700">{post.category}</span>
          <h3 className="mt-3 text-xl font-bold leading-snug"><Link href={`/blog/${post.slug}`} className="hover:text-teal-700">{post.title}</Link></h3>
          <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">{post.description}</p>
          <p className="mt-5 text-xs text-slate-500">{date(post.publishAt)} · {readTime(post.sections)} min read</p>
          <Link href={`/blog/${post.slug}`} className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-teal-700 hover:underline">Read guide →</Link>
        </article>)}</div>}
      </section>
      {news.length > 0 && <section aria-labelledby="water-updates-title" className="mt-16 border-t border-slate-200 pt-12">
        <p className="text-xs font-bold uppercase tracking-widest text-teal-700">Reviewed information</p>
        <h2 id="water-updates-title" className="mt-2 text-2xl font-extrabold sm:text-3xl">Water updates</h2>
        <p className="mt-3 text-slate-600">Source-attributed developments published after editorial review.</p>
        <div className="mt-7 grid gap-5 md:grid-cols-2">{news.map(item => <article key={item.slug} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold"><Link href={`/blog/news/${item.slug}`} className="hover:text-teal-700">{item.title}</Link></h3>
          <p className="mt-3 leading-7 text-slate-600">{item.summary}</p>
          <p className="mt-4 text-xs text-slate-500">Reviewed source: {item.source_name}</p>
          <Link href={`/blog/news/${item.slug}`} className="mt-4 inline-flex min-h-11 items-center font-bold text-teal-700 hover:underline">Read update →</Link>
        </article>)}</div>
      </section>}
      <aside className="mt-16 rounded-3xl bg-gradient-to-r from-blue-900 to-blue-700 p-7 text-white sm:p-10">
        <h2 className="text-2xl font-extrabold">Ready to check availability?</h2>
        <p className="mt-3 max-w-xl leading-7 text-blue-100">Enter your actual address to see supported services and current checkout pricing.</p>
        <Link href="/book" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-white px-6 py-3 font-bold text-blue-900 hover:bg-blue-50">Explore services →</Link>
      </aside>
    </div>
  </main>;
}
