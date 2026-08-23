import type { MetadataRoute } from 'next';

import { prisma } from '@/lib/prisma';
import { SITE_URL } from '@/lib/site';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, categories, contentTypes, tags, authors] = await Promise.all([
    prisma.post.findMany({
      where: { status: 'PUBLISHED', publishedAt: { lte: new Date() }, deletedAt: null },
      select: {
        slug: true,
        updatedAt: true,
        publishedAt: true,
        category: { select: { slug: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 40_000,
    }),
    prisma.category.findMany({ where: { isActive: true }, select: { slug: true } }),
    prisma.contentType.findMany({ select: { slug: true } }),
    prisma.tag.findMany({ where: { useCount: { gt: 0 } }, select: { slug: true } }),
    prisma.user.findMany({
      where: { posts: { some: { status: 'PUBLISHED' } } },
      select: { slug: true },
    }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'hourly', priority: 1 },
    { url: `${SITE_URL}/search`, changeFrequency: 'weekly', priority: 0.3 },
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
