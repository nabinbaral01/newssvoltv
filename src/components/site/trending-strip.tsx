import { Flame } from 'lucide-react';
import Link from 'next/link';

import { getTrending } from '@/lib/queries';

/**
 * Editor-pinned topics, not an algorithm. A row of chips, each tinted with its
 * section's colour and labelled with the section name, so a reader can tell a
 * Marvel story from a Theory piece before reading the headline. Scrolls
 * sideways on phones, with a fade at the edge to show there is more.
 */
export async function TrendingStrip() {
  const posts = await getTrending();
  if (!posts.length) return null;

  return (
    <div className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
        {/* The flame shows on every screen; the word only where there is room. */}
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent/15 px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-accent sm:px-2.5">
          <Flame className="size-3.5" aria-hidden />
          <span className="sr-only sm:not-sr-only">Trending</span>
        </span>

        <nav aria-label="Trending topics" className="relative min-w-0 flex-1">
          <ul className="no-scrollbar relative flex items-center gap-2 overflow-x-auto py-2 pr-8">
            {posts.map((post) => {
              const colour = post.category.colour;
              return (
                <li key={post.slug} className="shrink-0">
                  <Link
                    href={`/${post.category.slug}/${post.slug}`}
                    className="group flex max-w-[15rem] items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors sm:max-w-[19rem]"
                    style={{
                      borderColor: `color-mix(in srgb, ${colour} 45%, transparent)`,
                      backgroundColor: `color-mix(in srgb, ${colour} 12%, transparent)`,
                    }}
                  >
                    <span
                      className="shrink-0 text-[10px] font-bold uppercase tracking-wider"
                      // Blended toward the text colour: darker on the light
                      // theme, where a bright section colour on its own pale
                      // tint is hard to read, and barely changed on dark.
                      style={{ color: `color-mix(in srgb, ${colour} 75%, var(--fg))` }}
                    >
                      {post.category.name}
                    </span>
                    <span className="truncate font-medium text-fg/85 group-hover:text-fg">
                      {post.title}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {/* Edge fade: a cue that the row scrolls, not a hard cut-off. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface to-transparent"
          />
        </nav>
      </div>
    </div>
  );
}
