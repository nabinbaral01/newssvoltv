import type { Role } from '@prisma/client';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { bylineTitle, initials, socialLabel } from '@/lib/byline';
import { getAuthorBeats, getAuthorStats } from '@/lib/queries';

/**
 * The card that closes an article: who wrote this, and why they would know.
 *
 * Everything on it is public and cacheable. There is deliberately no follow
 * button here — the control needs the viewer's session, and reading a cookie
 * on the article route would turn the busiest page on the site from an
 * ISR-cached render into a per-request one. Following lives one click away on
 * the author page, which is already dynamic for exactly that reason.
 */
export async function AuthorCard({
  author,
}: {
  author: {
    id: string;
    name: string;
    slug: string;
    image: string | null;
    bio: string | null;
    title: string | null;
    role: Role;
    socialLinks: unknown;
  };
}) {
  const [beats, stats] = await Promise.all([
    getAuthorBeats(author.id),
    getAuthorStats(author.id),
  ]);

  const social = (author.socialLinks ?? {}) as Record<string, string>;
  const accent = beats[0]?.colour ?? 'var(--accent)';

  return (
    <aside
      aria-label={`About ${author.name}`}
      className="mt-10 overflow-hidden rounded-card border border-border bg-surface"
    >
      <div className="h-1 w-full" style={{ backgroundColor: accent }} />

      <div className="flex flex-wrap gap-4 p-5">
        <Link href={`/author/${author.slug}`} className="shrink-0">
          <span
            className="grid size-16 place-items-center overflow-hidden rounded-card border-2 bg-elevated text-lg font-bold"
            style={{ borderColor: accent, color: accent }}
          >
            {author.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={author.image} alt="" className="size-full object-cover" />
            ) : (
              initials(author.name)
            )}
          </span>
        </Link>

        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: accent }}
          >
            {bylineTitle(author)}
          </p>
          <Link
            href={`/author/${author.slug}`}
            className="headline text-xl uppercase hover:text-accent"
          >
            {author.name}
          </Link>

          {author.bio ? (
            <p className="mt-2 text-sm leading-relaxed text-muted">{author.bio}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
            <span>
              {stats.published} {stats.published === 1 ? 'story' : 'stories'}
            </span>
            {stats.followers > 0 ? (
              <span>
                {stats.followers.toLocaleString()}{' '}
                {stats.followers === 1 ? 'follower' : 'followers'}
              </span>
            ) : null}
            {Object.entries(social).map(([key, href]) => (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noreferrer noopener me"
                className="underline-offset-4 hover:text-accent hover:underline"
              >
                {socialLabel(key)}
              </a>
            ))}
          </div>

          {beats.length ? (
            <nav
              aria-label={`What ${author.name} covers`}
              className="mt-3 flex flex-wrap gap-2"
            >
              {beats.map((beat) => (
                <Link
                  key={beat.slug}
                  href={`/${beat.slug}`}
                  className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors hover:bg-elevated"
                  style={{ borderColor: beat.colour, color: beat.colour }}
                >
                  {beat.name}
                </Link>
              ))}
            </nav>
          ) : null}

          <Link
            href={`/author/${author.slug}`}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-accent hover:underline"
          >
            More from {author.name}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </aside>
  );
}
