import type { MetadataRoute } from 'next';

import { buildSafe } from '@/lib/build-safe';
import { getSitemapEntries } from '@/lib/queries';
import { SITE_URL } from '@/lib/site';

/**
 * Same reasoning as the RSS feed: the response is generated per request and the
 * data behind it is cached on the POSTS_TAG, so a newly published article is
 * discoverable straight away rather than after the next revalidation window.
 * A search engine crawling in the minutes after publication should find it.
 */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A sitemap missing its dynamic entries beats a failed deploy; the next
  // request rebuilds it once the database is reachable again.
  const { posts, categories, contentTypes, tags, authors } = await buildSafe(
    'sitemap',
    () => getSitemapEntries(),
    { posts: [], categories: [], contentTypes: [], tags: [], authors: [] } as never,
  );

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'hourly', priority: 1 },
    { url: `${SITE_URL}/search`, changeFrequency: 'weekly', priority: 0.3 },
    { url: `${SITE_URL}/authors`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  return [
    ...staticRoutes,
    ...categories.map((c) => ({
      url: `${SITE_URL}/${c.slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    // Category x content type: both axes are real, indexable pages.
    ...categories.flatMap((c) =>
      contentTypes.map((t) => ({
        url: `${SITE_URL}/${c.slug}/${t.slug}`,
        changeFrequency: 'daily' as const,
        priority: 0.6,
      })),
    ),
    ...posts.map((p) => ({
      url: `${SITE_URL}/${p.category.slug}/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...tags.map((t) => ({
      url: `${SITE_URL}/tag/${t.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.4,
    })),
    ...authors.map((a) => ({
      url: `${SITE_URL}/author/${a.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.4,
    })),
  ];
}
