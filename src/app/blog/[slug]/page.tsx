import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GUIDE_POSTS, publishedGuide } from '@/lib/blog/posts';
import { getSiteUrl } from '@/lib/env';

export const revalidate = 3600;
type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return GUIDE_POSTS.map((post) => ({ slug: post.slug })); }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = publishedGuide(slug);
  if (!post) return { robots: { index: false, follow: false } };
  return {
    title: `${post.title} | AuroTap`,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { title: post.title, description: post.description, type: 'article', publishedTime: post.publishAt, modifiedTime: post.updatedAt, url: `/blog/${post.slug}` },
  };
}

export default async function BlogArticle({ params }: Props) {
  const { slug } = await params;
  const post = publishedGuide(slug);
  if (!post) notFound();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.publishAt,
    dateModified: post.updatedAt,
    author: { '@type': 'Organization', name: 'AuroTap' },
    publisher: { '@type': 'Organization', name: 'AuroTap' },
    mainEntityOfPage: `${getSiteUrl().replace(/\/+$/, '')}/blog/${post.slug}`,
  };
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <nav aria-label="Breadcrumb" className="text-sm text-emerald-700"><Link className="hover:underline" href="/blog">← All guides</Link></nav>
      <article>
        <p className="mt-8 text-sm font-semibold uppercase tracking-wider text-emerald-700">{post.category}</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">{post.title}</h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">{post.description}</p>
        <p className="mt-3 text-sm text-slate-500">Published {new Date(post.publishAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })}</p>
        <div className="mt-10 space-y-10">
          {post.sections.map((section) => <section key={section.heading}>
            <h2 className="text-2xl font-semibold text-slate-900">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-4 leading-8 text-slate-700">{paragraph}</p>)}
          </section>)}
        </div>
      </article>
      <div className="mt-12 border-t border-slate-200 pt-7">
        <Link className="inline-flex min-h-11 items-center font-semibold text-emerald-700 hover:underline" href="/services">Check available services →</Link>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    </main>
  );
}
