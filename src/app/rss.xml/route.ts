import { buildSafe } from '@/lib/build-safe';
import { getFeedPosts } from '@/lib/queries';
import { DEFAULT_SETTINGS, getSettings, SITE_URL } from '@/lib/site';

/**
 * Rendered per request; the query behind it is cached and tagged, so publishing
 * reaches the feed immediately through updateTag(POSTS_TAG).
 *
 * Caching the *response* instead is what broke this in production. The route
 * previously sent `Cache-Control: max-age=900`, which tells Vercel's CDN to
 * hold the response for fifteen minutes regardless of what Next revalidates —
 * so a feed generated while the database was still empty kept being served to
 * every reader long after articles existed.
 */
export const dynamic = 'force-dynamic';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const [settings, posts] = await buildSafe(
    'rss feed',
    () => Promise.all([getSettings(), getFeedPosts()]),
    [DEFAULT_SETTINGS, []] as never,
  );

  const items = posts
    .map((post) => {
      const url = `${SITE_URL}/${post.category.slug}/${post.slug}`;
      const image = post.coverImage
        ? post.coverImage.startsWith('http')
          ? post.coverImage
          : `${SITE_URL}${post.coverImage}`
        : null;

      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${post.publishedAt?.toUTCString() ?? ''}</pubDate>
      <dc:creator>${escapeXml(post.author.name)}</dc:creator>
      <category>${escapeXml(post.category.name)}</category>
${post.tags.map((t) => `      <category>${escapeXml(t.name)}</category>`).join('\n')}
      <description>${escapeXml(post.excerpt ?? '')}</description>
${image ? `      <enclosure url="${image}" type="image/jpeg"/>` : ''}
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(settings['site.name'])}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(settings['site.description'])}</description>
    <language>en-gb</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      // Short enough that a stale copy is measured in seconds, not minutes.
      // Real freshness comes from the tagged query above.
      'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
