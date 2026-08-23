import { Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ArchiveView, Pagination } from '@/components/site/archive-view';
import { getMixedFeed, getPopularTags, searchPosts } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search every story published on Volt V.',
  robots: { index: false, follow: true },
};

type Props = { searchParams: Promise<{ q?: string; page?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q = '', page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const term = q.trim();

  const [results, popular, latest] = await Promise.all([
    term ? searchPosts(term, page) : null,
    getPopularTags(18),
    term ? null : getMixedFeed(0, 12),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="headline text-4xl uppercase sm:text-5xl">Search</h1>

      <form action="/search" method="get" className="mt-4 flex max-w-2xl items-center gap-2">
        <label htmlFor="q" className="sr-only">
          Search Volt V
        </label>
        <div className="flex h-11 flex-1 items-center gap-2 rounded-md border border-border bg-elevated px-3 focus-within:border-accent">
          <Search className="size-4 shrink-0 text-muted" aria-hidden />
          <input
            id="q"
            name="q"
            defaultValue={term}
            placeholder="Try a franchise, a studio or a topic…"
            className="h-full flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          />
        </div>
        <button
          type="submit"
          className="h-11 rounded-md bg-accent px-5 text-sm font-semibold text-accent-fg hover:opacity-90"
        >
          Search
        </button>
      </form>

      {results ? (
        <>
          <p className="mt-6 text-xs uppercase tracking-widest text-muted">
            {results.total} {results.total === 1 ? 'result' : 'results'} for “{term}”
          </p>
          <div className="mt-4">
            <ArchiveView
              posts={results.posts}
              emptyTitle={`Nothing found for “${term}”`}
              emptyDescription="Try a broader term, or browse a topic below."
            />
          </div>
          <Pagination
            page={results.page}
            pages={results.pages}
            basePath="/search"
            searchParams={{ q: term }}
          />
        </>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
              Popular topics
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {popular.map((tag) => (
                <li key={tag.slug}>
                  <Link
                    href={`/tag/${tag.slug}`}
                    className="inline-block rounded-full border border-border bg-surface px-3 py-1 text-xs transition-colors hover:border-accent hover:text-accent"
                  >
                    {tag.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="headline border-b-2 border-accent pb-2 text-2xl uppercase">
              Latest stories
            </h2>
            <div className="mt-4">
              <ArchiveView posts={latest ?? []} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
