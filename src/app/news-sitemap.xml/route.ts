import { buildSafe } from '@/lib/build-safe';
import { getSitemapEntries } from '@/lib/queries';
import { SITE_NAME } from '@/lib/seo';
import { SITE_URL } from '@/lib/site';

/**
 * Google News sitemap: only articles published in the last two days, per
 * Google's spec (older entries are ignored, and the file is capped at 1,000).
 * It is how Top Stories and the News tab find a story within minutes rather
 * than on the next routine crawl. Served per request for the same reason as
 * the main sitemap and the RSS feed — the query behind it is cached and
 * invalidated on publish.
 */
export const dynamic = 'force-dynamic';

const WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const { posts } = await buildSafe('news sitemap', () => getSitemapEntries(), {
    posts: [],
  } as never as Awaited<ReturnType<typeof getSitemapEntries>>);

  const cutoff = Date.now() - WINDOW_MS;
  const recent = posts
    .filter((p) => p.publishedAt && p.publishedAt.getTime() >= cutoff)
    .slice(0, 1000);

  const urls = recent
    .map(
      (p) => `  <url>
    <loc>${SITE_URL}/${p.category.slug}/${p.slug}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(SITE_NAME)}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${p.publishedAt!.toISOString()}</news:publication_date>
      <news:title>${escapeXml(p.title)}</news:title>
    </news:news>
  </url>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
