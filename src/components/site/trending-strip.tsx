import { Flame } from 'lucide-react';
import Link from 'next/link';

import { getTrending } from '@/lib/queries';

/**
 * Editor-pinned topics, not an algorithm. Nine or so links, one line on
 * desktop, horizontally scrollable on mobile.
 */
export async function TrendingStrip() {
  const posts = await getTrending();
  if (!posts.length) return null;

  return (
    <div className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 sm:px-4">
        <span className="hidden shrink-0 items-center gap-1.5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-accent sm:flex">
          <Flame className="size-3.5" aria-hidden />
          Trending
        </span>
        <nav aria-label="Trending topics" className="min-w-0 flex-1">
          <ul className="no-scrollbar flex items-center gap-4 overflow-x-auto py-2.5">
            {posts.map((post) => (
              <li key={post.slug} className="shrink-0">
                <Link
                  href={`/${post.category.slug}/${post.slug}`}
                  className="text-xs font-medium uppercase tracking-wide text-muted transition-colors hover:text-accent"
                >
                  {post.title.length > 46 ? `${post.title.slice(0, 44)}…` : post.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
