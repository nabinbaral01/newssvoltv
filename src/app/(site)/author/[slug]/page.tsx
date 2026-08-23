import { Role } from '@prisma/client';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArchiveView, Pagination } from '@/components/site/archive-view';
import { FollowButton } from '@/components/site/follow-button';
import { bylineTitle, initials, socialLabel } from '@/lib/byline';
import { currentUser } from '@/lib/permissions';
import { getArchive, getAuthorBeats, getAuthorBySlug, isFollowing } from '@/lib/queries';
import { SITE_URL } from '@/lib/site';
import { formatDate } from '@/lib/utils';

// Follow state is per-reader, so this page cannot be a shared static page.
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);
  if (!author || author.role === Role.READER) return {};
  return {
    title: `${author.name} — ${bylineTitle(author)}`,
    description: author.bio ?? `Stories by ${author.name} for Volt V.`,
    alternates: { canonical: `/author/${author.slug}` },
    openGraph: {
      title: author.name,
      description: author.bio ?? undefined,
      type: 'profile',
      images: author.image ? [author.image] : undefined,
    },
  };
}

/** One cell of the dossier strip. Renders nothing when its field is empty. */
function Dossier({ label, body }: { label: string; body: string | null }) {
  if (!body?.trim()) return null;
  return (
    <div className="border-l-2 border-border pl-4">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">{label}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-fg/90">
        {body
          .split(/\n{2,}/)
          .map((paragraph, i) => <p key={i}>{paragraph}</p>)}
      </div>
    </div>
  );
}

export default async function AuthorPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;

  const author = await getAuthorBySlug(slug);
  // Readers have accounts, not bylines. Their slug exists so comments can link
  // a name, but there is no public page behind it to visit.
  if (!author || author.role === Role.READER) notFound();

  const page = Math.max(1, Number(pageParam ?? 1) || 1);
  const [archive, beats, viewer] = await Promise.all([
    getArchive({ authorSlug: slug, page }),
    getAuthorBeats(author.id),
    currentUser(),
  ]);

  const social = (author.socialLinks ?? {}) as Record<string, string>;
  const following = viewer ? await isFollowing(viewer.id, author.id) : false;
  const isSelf = viewer?.id === author.id;

  // The writer's own strongest beat colours the page. Derived from published
  // work, so it shifts if they change what they cover — and it means no one
  // has to upload a banner image to get a page that is not grey.
  const accent = beats[0]?.colour ?? 'var(--accent)';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    dateCreated: author.createdAt.toISOString(),
    mainEntity: {
      '@type': 'Person',
      name: author.name,
      jobTitle: bylineTitle(author),
      description: author.bio ?? undefined,
      image: author.image ? `${SITE_URL}${author.image}` : undefined,
      url: `${SITE_URL}/author/${author.slug}`,
      knowsAbout: beats.map((beat) => beat.name),
      sameAs: Object.values(social),
      interactionStatistic: {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/FollowAction',
        userInteractionCount: author._count.followers,
      },
    },
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* A colour band rather than a photographic banner: it needs nothing
          uploaded, never crops badly, and comes from the writer's own beat. */}
      <div className="h-2 w-full" style={{ backgroundColor: accent }} />

      <header className="border-b border-border bg-elevated/30">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end gap-6 px-4 py-8">
          {/* Square, hard-edged — the site's cards are square, and a circle
              would be the only round thing on the page. */}
          <span
            className="grid size-28 shrink-0 place-items-center overflow-hidden rounded-card border-2 bg-elevated text-3xl font-bold sm:size-36"
            style={{ borderColor: accent, color: accent }}
          >
            {author.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={author.image} alt="" className="size-full object-cover" />
            ) : (
              initials(author.name)
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p
              className="text-xs font-bold uppercase tracking-[0.2em]"
              style={{ color: accent }}
            >
              {bylineTitle(author)}
            </p>
            <h1 className="headline mt-1 text-4xl uppercase leading-none sm:text-6xl">
              {author.name}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
              {isSelf ? (
                <Link
                  href="/admin/profile"
                  className="text-xs font-semibold uppercase tracking-widest text-accent hover:underline"
                >
                  Edit your profile
                </Link>
              ) : (
                <FollowButton
                  authorId={author.id}
                  authorName={author.name}
                  initialFollowing={following}
                  initialFollowers={author._count.followers}
                />
              )}

              <span className="text-xs text-muted">
                {author._count.posts} published {author._count.posts === 1 ? 'story' : 'stories'}
              </span>
              <span className="text-xs text-muted">Writing here since {formatDate(author.createdAt)}</span>
            </div>

            {beats.length ? (
              <nav aria-label={`What ${author.name} covers`} className="mt-4 flex flex-wrap gap-2">
                {beats.map((beat) => (
                  <Link
                    key={beat.slug}
                    href={`/${beat.slug}`}
                    className="rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-elevated"
                    style={{ borderColor: beat.colour, color: beat.colour }}
                  >
                    {beat.name}
                    <span className="ml-1.5 opacity-60">{beat.count}</span>
                  </Link>
                ))}
              </nav>
            ) : null}

            {Object.keys(social).length ? (
              <nav
                aria-label={`${author.name} elsewhere`}
                className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs"
              >
                {Object.entries(social).map(([key, href]) => (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noreferrer noopener me"
                    className="text-muted underline-offset-4 hover:text-accent hover:underline"
                  >
                    {socialLabel(key)}
                  </a>
                ))}
              </nav>
            ) : null}
          </div>
        </div>
      </header>

      {author.bio || author.focus || author.favourites ? (
        <section
          aria-label={`About ${author.name}`}
          className="border-b border-border bg-surface"
        >
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:grid-cols-3">
            <Dossier label={`About ${author.name}`} body={author.bio} />
            <Dossier label="Current focus" body={author.focus} />
            <Dossier label="Recommends" body={author.favourites} />
          </div>
        </section>
      ) : null}

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3">
          <h2 className="headline text-2xl uppercase">Latest from {author.name}</h2>
          <Link href="/authors" className="text-xs text-muted hover:text-accent">
            All writers →
          </Link>
        </div>

        <div className="mt-6">
          <ArchiveView
            posts={archive.posts}
            emptyTitle={`${author.name} has not published yet`}
            emptyDescription="Their first story will appear here."
          />
        </div>

        <Pagination page={archive.page} pages={archive.pages} basePath={`/author/${author.slug}`} />
      </div>
    </div>
  );
}
