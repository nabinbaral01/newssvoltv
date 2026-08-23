import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ArchiveView, Pagination } from '@/components/site/archive-view';
import { getArchive, getAuthorBySlug } from '@/lib/queries';
import { SITE_URL } from '@/lib/site';

export const revalidate = 300;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);
  if (!author) return {};
  return {
    title: author.name,
    description: author.bio ?? `Stories by ${author.name} for Volt V.`,
    alternates: { canonical: `/author/${author.slug}` },
  };
}

export default async function AuthorPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;

  const author = await getAuthorBySlug(slug);
  if (!author) notFound();

  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const archive = await getArchive({ authorSlug: slug, page });
  const social = (author.socialLinks ?? {}) as Record<string, string>;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.name,
    description: author.bio ?? undefined,
    url: `${SITE_URL}/author/${author.slug}`,
    sameAs: Object.values(social),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="flex flex-wrap items-start gap-4 border-b-2 border-accent pb-6">
        <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-elevated text-2xl font-bold text-accent">
          {author.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={author.image} alt="" className="size-full object-cover" />
          ) : (
            author.name.slice(0, 1)
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">
            {author.role === 'ADMIN' ? 'Editor-in-chief' : author.role === 'EDITOR' ? 'Editor' : 'Writer'}
          </p>
          <h1 className="headline text-4xl uppercase sm:text-5xl">{author.name}</h1>
          {author.bio ? <p className="mt-2 max-w-2xl text-sm text-muted">{author.bio}</p> : null}
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <span className="text-muted">{author._count.posts} published stories</span>
            {Object.entries(social).map(([key, href]) => (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noreferrer noopener me"
                className="text-accent hover:underline"
              >
                {key}
              </a>
            ))}
          </div>
        </div>
      </header>

      <div className="mt-6">
        <ArchiveView posts={archive.posts} emptyTitle={`${author.name} has not published yet`} />
      </div>

      <Pagination page={archive.page} pages={archive.pages} basePath={`/author/${author.slug}`} />
    </div>
  );
}
