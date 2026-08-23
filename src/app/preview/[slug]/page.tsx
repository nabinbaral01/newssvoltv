import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArticleBody } from '@/components/site/article-body';
import { SiteFooter } from '@/components/site/footer';
import { SiteHeader } from '@/components/site/header';
import { StatusPill } from '@/components/ui/surface';
import { getArticleForPreview } from '@/lib/queries';
import { formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
};

/**
 * Unpublished preview, gated by the post's own token rather than the session —
 * so an editor can send a link to someone who has no account at all, and the
 * link dies the moment the token is rotated.
 */
export default async function PreviewPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { token } = await searchParams;
  if (!token) notFound();

  const post = await getArticleForPreview(slug, token);
  if (!post) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <div className="border-b border-accent bg-accent/10 px-4 py-2 text-center text-xs">
        <span className="font-semibold text-accent">Preview</span> — this is how the article will
        look once live. <StatusPill status={post.status} />{' '}
        {post.publishedAt ? `· ${formatDateTime(post.publishedAt)}` : '· not scheduled'}
      </div>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: post.category.colour }}>
          {post.category.name} · {post.contentType.name}
        </p>
        <h1 className="headline mt-2 text-[clamp(2rem,5vw,3.25rem)]">{post.title}</h1>
        {post.excerpt ? <p className="mt-3 text-lg text-muted">{post.excerpt}</p> : null}

        <p className="mt-4 border-y border-border py-3 text-sm text-muted">
          By {post.author.name} · {post.readingTimeMinutes} min read
        </p>

        {post.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImage}
            alt={post.coverAlt ?? ''}
            className="mt-6 aspect-video w-full rounded-card border border-border object-cover"
          />
        ) : null}

        <div className="mt-6">
          <ArticleBody body={post.body} />
        </div>

        <p className="mt-10 text-sm">
          <Link href={`/admin/posts`} className="text-accent hover:underline">
            ← Back to the admin panel
          </Link>
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
