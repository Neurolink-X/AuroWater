import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { GUIDE_POSTS } from '@/lib/blog/posts';
import { findPublishedGuide, allPublishedGuides } from '@/lib/blog/managed-posts';
import { getSiteUrl } from '@/lib/env';

export const revalidate = 3600;
type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return GUIDE_POSTS.map(post => ({ slug: post.slug })); }
const date = (value: string) => new Date(value).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await findPublishedGuide(slug);
  if (!post) return { robots: { index: false, follow: false } };
  return { title: `${post.title} | AuroTap`, description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { title: post.title, description: post.description, type: 'article', publishedTime: post.publishAt, modifiedTime: post.updatedAt, url: `/blog/${post.slug}`, ...(post.coverImage ? { images: [{ url: post.coverImage, width: 1200, height: 630, alt: post.title }] } : {}) },
  };
}
export default async function BlogArticle({ params }: Props) {
  const { slug } = await params;
  const post = await findPublishedGuide(slug);
  if (!post) notFound();
  const related = (await allPublishedGuides()).filter(item => item.slug !== slug).slice(0, 2);
  const words = post.sections.reduce((n, section) => n + section.paragraphs.join(' ').split(/\s+/).length, 0);
  const jsonLd = { '@context': 'https://schema.org', '@type': 'Article', headline: post.title, description: post.description,
    datePublished: post.publishAt, dateModified: post.updatedAt,
    ...(post.coverImage ? { image: `${getSiteUrl().replace(/\/+$/, '')}${post.coverImage}` } : {}),
    author: { '@type': 'Organization', name: 'AuroTap' }, publisher: { '@type': 'Organization', name: 'AuroTap' },
    mainEntityOfPage: `${getSiteUrl().replace(/\/+$/, '')}/blog/${post.slug}`,
  };
  return <main className="min-h-[70vh] bg-slate-50 text-slate-900">
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-teal-700"><Link href="/blog" className="font-semibold hover:underline">← All guides</Link></nav>
      <header className="mx-auto mt-10 max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[.15em] text-teal-700">{post.category}</p>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{post.title}</h1>
        <p className="mt-6 text-lg leading-8 text-slate-600 sm:text-xl">{post.description}</p>
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-slate-200 py-4 text-sm text-slate-600">
          <span className="font-semibold text-slate-800">AuroTap Editorial</span>
          <span>Published {date(post.publishAt)}</span>
          <span>{Math.max(1, Math.ceil(words / 200))} min read</span>
        </div>
      </header>
      {post.coverImage && <figure className="mx-auto mt-8 max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-blue-50 shadow-sm">
        <Image src={post.coverImage} alt={post.title + ' editorial illustration'} width={1200} height={630} priority className="h-auto w-full" />
        <figcaption className="px-5 py-3 text-xs text-slate-500">Editorial illustration · not a photograph of a delivery or product certification.</figcaption>
      </figure>}
      <div className="mx-auto mt-10 grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,1fr)_230px]">
        <article className="min-w-0 rounded-3xl border border-slate-200 bg-white px-5 py-8 shadow-sm sm:px-9">
          <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-5 text-sm leading-7 text-slate-700"><strong className="text-slate-900">Before you book:</strong> Confirm availability for your exact address and review the final price at checkout. Guidance here does not guarantee service coverage.</div>
          <div className="mt-9 space-y-10">{post.sections.map((section, index) => <section key={section.heading} id={`section-${index + 1}`} className="scroll-mt-24">
            <h2 className="text-xl font-extrabold leading-snug tracking-tight sm:text-2xl">{section.heading}</h2>
            {section.paragraphs.map(paragraph => <p key={paragraph} className="mt-4 text-base leading-8 text-slate-700">{paragraph}</p>)}
          </section>)}</div>
          <div className="mt-12 border-t border-slate-200 pt-7"><Link href="/book" className="inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-5 py-3 font-bold text-white hover:bg-blue-800">Check services & pricing →</Link></div>
        </article>
        <aside className="self-start lg:sticky lg:top-24">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">In this guide</h2>
            <ol className="mt-4 space-y-3">{post.sections.map((section, index) => <li key={section.heading}><a href={`#section-${index + 1}`} className="text-sm leading-6 text-slate-600 hover:text-teal-700 hover:underline">{section.heading}</a></li>)}</ol>
          </div>
        </aside>
      </div>
      {related.length > 0 && <section className="mx-auto mt-14 max-w-5xl border-t border-slate-200 pt-10">
        <h2 className="text-2xl font-extrabold">Keep reading</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">{related.map(item => <Link key={item.slug} href={`/blog/${item.slug}`} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-teal-300 hover:shadow-md">
          <span className="text-xs font-bold uppercase tracking-wide text-teal-700">{item.category}</span>
          <h3 className="mt-3 text-lg font-bold">{item.title}</h3>
          <span className="mt-4 inline-block text-sm font-bold text-teal-700">Read guide →</span>
        </Link>)}</div>
      </section>}
    </div>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
  </main>;
}
