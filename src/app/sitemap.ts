import type { MetadataRoute } from 'next';

import { buildSafe } from '@/lib/build-safe';
import { getSitemapEntries } from '@/lib/queries';
import { absoluteUrl } from '@/lib/seo';
import { SITE_URL } from '@/lib/site';

/**
 * Same reasoning as the RSS feed: the response is generated per request and the
 * data behind it is cached on the POSTS_TAG, so a newly published article is
 * discoverable straight away rather than after the next revalidation window.
 * A search engine crawling in the minutes after publication should find it.
 *
 * Only indexable URLs belong here: /search is noindex, and archives with no
 * published stories are noindex too, so both are left out. Every archive's
 * lastModified is its newest story, which is the signal Google actually uses
 * (it ignores priority and changeFrequency).
 */
export const dynamic = 'force-dynamic';

type Entries = Awaited<ReturnType<typeof getSitemapEntries>>;

function latest(map: Map<string, Date>, key: string, date: Date) {
  const current = map.get(key);
  if (!current || date > current) map.set(key, date);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A sitemap missing its dynamic entries beats a failed deploy; the next
  // request rebuilds it once the database is reachable again.
  const { posts, categories, contentTypes, tags, authors } = await buildSafe<Entries>(
    'sitemap',
    () => getSitemapEntries(),
    { posts: [], categories: [], contentTypes: [], tags: [], authors: [] } as never,
  );

  const activeCategories = new Set(categories.map((c) => c.slug));
  const knownTypes = new Set(contentTypes.map((t) => t.slug));

  // Newest story per archive, derived from the posts themselves.
  const byCategory = new Map<string, Date>();
  const byFormat = new Map<string, Date>();
  let newest: Date | undefined;
  for (const p of posts) {
    const date = p.updatedAt;
    if (!newest || date > newest) newest = date;
    latest(byCategory, p.category.slug, date);
    if (knownTypes.has(p.contentType.slug)) {
      latest(byFormat, `${p.category.slug}/${p.contentType.slug}`, date);
    }
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: newest, changeFrequency: 'hourly', priority: 1 },
    { url: `${SITE_URL}/authors`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  return [
    ...staticRoutes,
    ...categories.map((c) => ({
      url: `${SITE_URL}/${c.slug}`,
      lastModified: byCategory.get(c.slug),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...[...byFormat.entries()]
      .filter(([path]) => activeCategories.has(path.split('/')[0]))
      .map(([path, date]) => ({
        url: `${SITE_URL}/${path}`,
        lastModified: date,
        changeFrequency: 'daily' as const,
        priority: 0.6,
      })),
    ...posts.map((p) => ({
      url: `${SITE_URL}/${p.category.slug}/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
      ...(p.coverImage ? { images: [absoluteUrl(p.coverImage)] } : {}),
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
