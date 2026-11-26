import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArchiveView, Pagination } from '@/components/site/archive-view';
import { JsonLd } from '@/components/site/json-ld';
import { countArchivePages, getArchive, getPopularTags, getTagBySlug } from '@/lib/queries';
import { archiveRobots, breadcrumbJsonLd, openGraph, paginated, parsePage } from '@/lib/seo';

export const revalidate = 300;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getTagBySlug(slug);
  if (!tag) return {};
  const page = parsePage((await searchParams).page);
  const { title, canonical } = paginated(`/tag/${tag.slug}`, page, `${tag.name}: Latest News & Reviews`);
  const description = `Every Volt V story about ${tag.name} — news, reviews and features, newest first. ${tag.useCount} ${tag.useCount === 1 ? 'story' : 'stories'} so far.`;
  const { total, pages } = await countArchivePages({ tagSlug: slug });
  return {
    title,
    description,
    alternates: { canonical },
    robots: archiveRobots(total, page, pages),
    openGraph: openGraph({ type: 'website', url: canonical, title, description }),
  };
}

export default async function TagPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;

  const tag = await getTagBySlug(slug);
  if (!tag) notFound();

  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const [archive, popular] = await Promise.all([
    getArchive({ tagSlug: slug, page }),
    getPopularTags(20),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: tag.name, path: `/tag/${tag.slug}` },
        ])}
      />
      <header className="border-b-2 border-accent pb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted">Topic</p>
        <h1 className="headline text-4xl uppercase sm:text-6xl">{tag.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {archive.total} {archive.total === 1 ? 'story' : 'stories'}
        </p>
      </header>

      <div className="mt-6">
        <ArchiveView posts={archive.posts} emptyTitle={`Nothing tagged ${tag.name} yet`} />
      </div>

      <Pagination page={archive.page} pages={archive.pages} basePath={`/tag/${tag.slug}`} />

      <section className="mt-12 border-t border-border pt-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">Popular topics</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {popular.map((item) => (
            <li key={item.slug}>
              <Link
                href={`/tag/${item.slug}`}
                className="inline-block rounded-full border border-border bg-surface px-3 py-1 text-xs transition-colors hover:border-accent hover:text-accent"
              >
                {item.name}
                <span className="ml-1 text-muted">{item.useCount}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
