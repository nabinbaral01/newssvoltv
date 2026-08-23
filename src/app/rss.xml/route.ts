import { prisma } from '@/lib/prisma';
import { getSettings, SITE_URL } from '@/lib/site';

export const revalidate = 900;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const [settings, posts] = await Promise.all([
    getSettings(),
    prisma.post.findMany({
      where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } },
      orderBy: { publishedAt: 'desc' },
      take: 50,
      select: {
        title: true,
        slug: true,
        excerpt: true,
        publishedAt: true,
        coverImage: true,
        category: { select: { name: true, slug: true } },
        author: { select: { name: true } },
        tags: { select: { name: true } },
      },
    }),
  ]);

  const items = posts
    .map((post) => {
      const url = `${SITE_URL}/${post.category.slug}/${post.slug}`;
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${post.publishedAt?.toUTCString() ?? ''}</pubDate>
      <dc:creator>${escapeXml(post.author.name)}</dc:creator>
      <category>${escapeXml(post.category.name)}</category>
${post.tags.map((t) => `      <category>${escapeXml(t.name)}</category>`).join('\n')}
      <description>${escapeXml(post.excerpt ?? '')}</description>
${post.coverImage ? `      <enclosure url="${SITE_URL}${post.coverImage}" type="image/svg+xml"/>` : ''}
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
      'Cache-Control': 'public, max-age=900, stale-while-revalidate=3600',
    },
  });
}
