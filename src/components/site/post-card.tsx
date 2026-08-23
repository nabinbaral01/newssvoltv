import { MessageSquare, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import type { PostCard as PostCardData } from '@/lib/queries';
import { cn, compactNumber, relativeTime } from '@/lib/utils';

export function postHref(post: { slug: string; category: { slug: string } }) {
  return `/${post.category.slug}/${post.slug}`;
}

function CategoryLabel({
  post,
  className,
}: {
  post: PostCardData;
  className?: string;
}) {
  return (
    <span
      className={cn('text-[11px] font-semibold uppercase tracking-widest', className)}
      style={{ color: post.category.colour }}
    >
      {post.category.name}
      <span className="text-muted"> · {post.contentType.name}</span>
    </span>
  );
}

function Meta({ post, className }: { post: PostCardData; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted', className)}>
      <span>By {post.author.name}</span>
      {post.publishedAt ? (
        <>
          <span aria-hidden>·</span>
          <time dateTime={post.publishedAt.toISOString()}>{relativeTime(post.publishedAt)}</time>
        </>
      ) : null}
      {post._count.comments > 0 ? (
        <>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="size-3" aria-hidden />
            <span className="sr-only">Comments: </span>
            {compactNumber(post._count.comments)}
          </span>
        </>
      ) : null}
      {post.rating != null ? (
        <>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1 text-accent">
            <Star className="size-3 fill-current" aria-hidden />
            <span className="sr-only">Rating: </span>
            {post.rating.toFixed(1)}/10
          </span>
        </>
      ) : null}
    </div>
  );
}

/**
 * Full-bleed image with the headline sitting on the scrim. Used for the hero
 * (`size="hero"`) and the two secondary slots (`size="medium"`).
 */
export function OverlayCard({
  post,
  size = 'medium',
  priority,
}: {
  post: PostCardData;
  size?: 'hero' | 'medium';
  priority?: boolean;
}) {
  return (
    <article className="group relative isolate overflow-hidden rounded-card border border-border bg-surface">
      <Link href={postHref(post)} className="block">
        <div className={cn('relative w-full', size === 'hero' ? 'aspect-[16/10] sm:aspect-[16/9]' : 'aspect-[16/9]')}>
          {post.coverImage ? (
            <Image
              src={post.coverImage}
              alt={post.coverAlt ?? ''}
              fill
              sizes={size === 'hero' ? '(max-width: 1024px) 100vw, 66vw' : '(max-width: 1024px) 100vw, 33vw'}
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              priority={priority}
            />
          ) : (
            <div className="size-full bg-elevated" />
          )}
          <div className="img-scrim absolute inset-0" aria-hidden />
        </div>

        <div className={cn('absolute inset-x-0 bottom-0 p-4', size === 'hero' && 'sm:p-6')}>
          <CategoryLabel post={post} className="drop-shadow" />
          <h2
            className={cn(
              'headline mt-1 text-white drop-shadow-md',
              size === 'hero'
                ? 'text-[clamp(1.75rem,4.2vw,3.25rem)]'
                : 'text-[clamp(1.35rem,2.4vw,1.9rem)]',
            )}
          >
            {post.title}
          </h2>
          {size === 'hero' && post.excerpt ? (
            <p className="mt-2 hidden max-w-2xl text-sm text-white/80 sm:line-clamp-2">
              {post.excerpt}
            </p>
          ) : null}
          <Meta post={post} className="mt-2 text-white/70" />
        </div>
      </Link>
    </article>
  );
}

/** The uniform card used in every section grid. */
export function GridCard({ post, sizes }: { post: PostCardData; sizes?: string }) {
  return (
    <article className="group flex flex-col">
      <Link href={postHref(post)} className="block">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-card border border-border bg-elevated">
          {post.coverImage ? (
            <Image
              src={post.coverImage}
              alt={post.coverAlt ?? ''}
              fill
              sizes={sizes ?? '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw'}
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : null}
        </div>
      </Link>
      <div className="mt-2.5 flex flex-1 flex-col">
        <CategoryLabel post={post} />
        <h3 className="headline mt-1 text-lg leading-tight sm:text-xl">
          <Link href={postHref(post)} className="transition-colors hover:text-accent">
            {post.title}
          </Link>
        </h3>
        <Meta post={post} className="mt-auto pt-2" />
      </div>
    </article>
  );
}

/** Compact thumbnail-right row — the LATEST rail and the mixed feed. */
export function RailRow({
  post,
  showThumb = true,
}: {
  post: PostCardData;
  showThumb?: boolean;
}) {
  return (
    <article className="group flex items-start gap-3 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        {post.publishedAt ? (
          <time
            dateTime={post.publishedAt.toISOString()}
            className="text-[11px] font-semibold uppercase tracking-widest text-accent"
          >
            {relativeTime(post.publishedAt)}
          </time>
        ) : null}
        <h3 className="headline mt-0.5 line-clamp-3 text-base leading-tight sm:text-lg">
          <Link href={postHref(post)} className="transition-colors hover:text-accent">
            {post.title}
          </Link>
        </h3>
      </div>
      {showThumb && post.coverImage ? (
        <Link href={postHref(post)} className="shrink-0" tabIndex={-1} aria-hidden>
          <div className="relative size-16 overflow-hidden rounded border border-border bg-elevated sm:size-20">
            <Image
              src={post.coverImage}
              alt=""
              fill
              sizes="80px"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        </Link>
      ) : null}
    </article>
  );
}

/** Thumbnail-left list row for archives and the lower feed. */
export function ListRow({ post }: { post: PostCardData }) {
  return (
    <article className="group flex gap-4 border-b border-border py-4 last:border-b-0">
      <Link href={postHref(post)} className="shrink-0" tabIndex={-1} aria-hidden>
        <div className="relative aspect-[4/3] w-28 overflow-hidden rounded border border-border bg-elevated sm:w-40">
          {post.coverImage ? (
            <Image src={post.coverImage} alt="" fill sizes="160px" className="object-cover" />
          ) : null}
        </div>
      </Link>
      <div className="min-w-0 flex-1">
        <CategoryLabel post={post} />
        <h3 className="headline mt-1 text-lg leading-tight sm:text-2xl">
          <Link href={postHref(post)} className="transition-colors hover:text-accent">
            {post.title}
          </Link>
        </h3>
        {post.excerpt ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted">{post.excerpt}</p>
        ) : null}
        <Meta post={post} className="mt-2" />
      </div>
    </article>
  );
}

/** Text-only row for the dense right-hand column. */
export function TextRow({ post }: { post: PostCardData }) {
  return (
    <article className="border-b border-border py-3 last:border-b-0">
      <CategoryLabel post={post} />
      <h3 className="headline mt-0.5 text-base leading-tight sm:text-lg">
        <Link href={postHref(post)} className="transition-colors hover:text-accent">
          {post.title}
        </Link>
      </h3>
      <Meta post={post} className="mt-1.5" />
    </article>
  );
}
