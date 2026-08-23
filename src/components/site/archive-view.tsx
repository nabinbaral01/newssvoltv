import Link from 'next/link';

import { GridCard, ListRow } from '@/components/site/post-card';
import { EmptyState } from '@/components/ui/surface';
import type { PostCard } from '@/lib/queries';
import { cn } from '@/lib/utils';

export function Pagination({
  page,
  pages,
  basePath,
  searchParams,
}: {
  page: number;
  pages: number;
  basePath: string;
  searchParams?: Record<string, string>;
}) {
  if (pages <= 1) return null;

  const hrefFor = (target: number) => {
    const params = new URLSearchParams(searchParams);
    if (target > 1) params.set('page', String(target));
    else params.delete('page');
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  // Compact window: first, last, and two either side of the current page.
  const window = new Set<number>([1, pages, page, page - 1, page + 1, page - 2, page + 2]);
  const numbers = [...window].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);

  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          rel="prev"
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent"
        >
          ← Previous
        </Link>
      ) : null}

      {numbers.map((n, i) => (
        <span key={n} className="flex items-center gap-2">
          {i > 0 && n - numbers[i - 1] > 1 ? <span className="text-muted">…</span> : null}
          <Link
            href={hrefFor(n)}
            aria-current={n === page ? 'page' : undefined}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm transition-colors',
              n === page
                ? 'border-accent bg-accent text-accent-fg'
                : 'border-border hover:border-accent',
            )}
          >
            {n}
          </Link>
        </span>
      ))}

      {page < pages ? (
        <Link
          href={hrefFor(page + 1)}
          rel="next"
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent"
        >
          Next →
        </Link>
      ) : null}
    </nav>
  );
}

/**
 * Shared archive body: the newest four as a grid, the rest as list rows.
 * Used by category, content-type, tag, author and search results.
 */
export function ArchiveView({
  posts,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
}: {
  posts: PostCard[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (!posts.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const lead = posts.slice(0, 4);
  const rest = posts.slice(4);

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {lead.map((post) => (
          <GridCard key={post.id} post={post} />
        ))}
      </div>
      {rest.length ? (
        <div className="mt-8 border-t border-border">
          {rest.map((post) => (
            <ListRow key={post.id} post={post} />
          ))}
        </div>
      ) : null}
    </>
  );
}
