import { Prisma, PostStatus } from '@prisma/client';
import { unstable_cache } from 'next/cache';

import { prisma } from './prisma';

export const POSTS_TAG = 'posts';
export const NAV_TAG = 'navigation';

/**
 * `unstable_cache` round-trips its payload through JSON, which turns every
 * Date into a string on a cache hit but not on a miss. Rather than making
 * every component defensive about that, cached results are revived here so the
 * Prisma types stay honest.
 */
const DATE_KEYS = new Set([
  'publishedAt',
  'createdAt',
  'updatedAt',
  'scheduledFor',
  'lastLoginAt',
  'emailVerified',
  'confirmedAt',
  'startedAt',
  'endedAt',
  'day',
]);

function reviveDates<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach(reviveDates);
    return value;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (typeof child === 'string' && DATE_KEYS.has(key)) {
        (value as Record<string, unknown>)[key] = new Date(child);
      } else if (child && typeof child === 'object') {
        reviveDates(child);
      }
    }
  }
  return value;
}

/** unstable_cache with the Date revival applied on the way out. */
function cachedQuery<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  keyParts: string[],
  options: { tags: string[]; revalidate: number },
) {
  const cached = unstable_cache(fn, keyParts, options);
  return async (...args: Args): Promise<Result> => reviveDates(await cached(...args));
}

/** Everything a card needs, and nothing it does not. */
export const postCardSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImage: true,
  coverAlt: true,
  publishedAt: true,
  readingTimeMinutes: true,
  viewCount: true,
  rating: true,
  category: { select: { name: true, slug: true, colour: true } },
  contentType: { select: { name: true, slug: true } },
  author: { select: { name: true, slug: true, image: true } },
  _count: { select: { comments: { where: { status: 'APPROVED' } } } },
} satisfies Prisma.PostSelect;

export type PostCard = Prisma.PostGetPayload<{ select: typeof postCardSelect }>;

/**
 * Only ever surface posts that are actually live. This is a function, not a
 * constant: a module-level `new Date()` would freeze at server start and
 * quietly hide anything published since.
 */
export const publishedWhere = (): Prisma.PostWhereInput => ({
  status: PostStatus.PUBLISHED,
  publishedAt: { lte: new Date() },
  // Soft-deleted posts stay in the table but must never reach a reader.
  deletedAt: null,
});

/** Not deleted, whatever the status. For admin listings and counts. */
export const liveWhere = (): Prisma.PostWhereInput => ({ deletedAt: null });

const byNewest: Prisma.PostOrderByWithRelationInput[] = [
  { publishedAt: 'desc' },
  { createdAt: 'desc' },
];

// ---------------------------------------------------------------- navigation

export type NavCategory = {
  name: string;
  slug: string;
  colour: string;
  formats: { name: string; slug: string }[];
};

/**
 * The mega-menu is the content model made visible: verticals across the top,
 * formats underneath. Only formats that actually have published posts appear.
 */
export const getNavigation = cachedQuery(
  async (): Promise<NavCategory[]> => {
    const categories = await prisma.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, slug: true, colour: true },
    });

    const pairs = await prisma.post.groupBy({
      by: ['categoryId', 'contentTypeId'],
      where: publishedWhere(),
      _count: { _all: true },
    });

    const contentTypes = await prisma.contentType.findMany({
      orderBy: { order: 'asc' },
      select: { id: true, name: true, slug: true },
    });
    const typeById = new Map(contentTypes.map((t) => [t.id, t]));

    return categories.map((category) => ({
      name: category.name,
      slug: category.slug,
      colour: category.colour,
      formats: contentTypes
        .filter((type) =>
          pairs.some((p) => p.categoryId === category.id && p.contentTypeId === type.id),
        )
        .map((type) => ({ name: typeById.get(type.id)!.name, slug: type.slug })),
    }));
  },
  ['navigation'],
  { tags: [NAV_TAG, POSTS_TAG], revalidate: 900 },
);

// ---------------------------------------------------------------- homepage

export const getTrending = cachedQuery(
  async () =>
    prisma.post.findMany({
      where: { ...publishedWhere(), isTrending: true },
      orderBy: byNewest,
      take: 10,
      select: { title: true, slug: true, category: { select: { slug: true } } },
    }),
  ['trending'],
  { tags: [POSTS_TAG], revalidate: 300 },
);

/**
 * The top block in one query batch: the hero, two secondary cards and the
 * LATEST rail, with no post appearing twice.
 */
export const getHomepageTop = cachedQuery(
  async () => {
    const featured = await prisma.post.findMany({
      where: { ...publishedWhere(), isFeatured: true },
      orderBy: byNewest,
      take: 3,
      select: postCardSelect,
    });

    const usedIds = featured.map((p) => p.id);

    const latest = await prisma.post.findMany({
      where: { ...publishedWhere(), id: { notIn: usedIds } },
      orderBy: byNewest,
      take: 6,
      select: postCardSelect,
    });

    // If an editor has not flagged a hero, fall back to the newest story.
    const hero = featured[0] ?? latest[0];
    const secondary = featured.slice(1, 3);
    const secondaryFill = latest
      .filter((p) => p.id !== hero?.id && !secondary.some((s) => s.id === p.id))
      .slice(0, 2 - secondary.length);

    return {
      hero,
      secondary: [...secondary, ...secondaryFill].slice(0, 2),
      latest: latest.filter((p) => p.id !== hero?.id).slice(0, 5),
    };
  },
  ['homepage-top'],
  { tags: [POSTS_TAG], revalidate: 120 },
);

export const getCategoryBlock = cachedQuery(
  async (slug: string, take: number = 4) => {
    const category = await prisma.category.findUnique({
      where: { slug },
      select: { name: true, slug: true, colour: true, description: true },
    });
    if (!category) return null;
    const posts = await prisma.post.findMany({
      where: { ...publishedWhere(), category: { slug } },
      orderBy: byNewest,
      take,
      select: postCardSelect,
    });
    return posts.length ? { category, posts } : null;
  },
  ['category-block'],
  { tags: [POSTS_TAG], revalidate: 300 },
);

export const getEditorPicks = cachedQuery(
  async () =>
    prisma.post.findMany({
      where: { ...publishedWhere(), isEditorPick: true },
      orderBy: byNewest,
      take: 10,
      select: postCardSelect,
    }),
  ['editor-picks'],
  { tags: [POSTS_TAG], revalidate: 300 },
);

/** The dense two-column feed lower down the page. */
export const getMixedFeed = cachedQuery(
  async (skip: number = 0, take: number = 14) =>
    prisma.post.findMany({
      where: publishedWhere(),
      orderBy: byNewest,
      skip,
      take,
      select: postCardSelect,
    }),
  ['mixed-feed'],
  { tags: [POSTS_TAG], revalidate: 300 },
);

export const getMostRead = cachedQuery(
  async (take: number = 5) =>
    prisma.post.findMany({
      where: publishedWhere(),
      orderBy: { viewCount: 'desc' },
      take,
      select: postCardSelect,
    }),
  ['most-read'],
  { tags: [POSTS_TAG], revalidate: 900 },
);

// ---------------------------------------------------------------- article

export const articleSelect = {
  ...postCardSelect,
  body: true,
  bodyText: true,
  metaTitle: true,
  metaDescription: true,
  ogImage: true,
  status: true,
  updatedAt: true,
  categoryId: true,
  contentTypeId: true,
  tags: { select: { name: true, slug: true }, orderBy: { name: 'asc' } },
  author: {
    select: { id: true, name: true, slug: true, image: true, bio: true, socialLinks: true },
  },
} satisfies Prisma.PostSelect;

export type Article = Prisma.PostGetPayload<{ select: typeof articleSelect }>;

/**
 * Cached per (slug, category) and busted by the POSTS_TAG on publish, so a
 * popular article is one database read per revalidation window rather than one
 * per request.
 */
export const getArticle = cachedQuery(
  async (slug: string, categorySlug: string) =>
    prisma.post.findFirst({
      where: { slug, category: { slug: categorySlug }, ...publishedWhere() },
      select: articleSelect,
    }),
  ['article'],
  { tags: [POSTS_TAG], revalidate: 300 },
);

/** Preview access for editors: any status, gated by the post's preview token. */
export async function getArticleForPreview(slug: string, token: string) {
  return prisma.post.findFirst({
    where: { slug, previewToken: token, deletedAt: null },
    select: articleSelect,
  });
}

export async function getRelatedPosts(postId: string, categoryId: string, tagSlugs: string[]) {
  const byTag = tagSlugs.length
    ? await prisma.post.findMany({
        where: {
          ...publishedWhere(),
          id: { not: postId },
          tags: { some: { slug: { in: tagSlugs } } },
        },
        orderBy: byNewest,
        take: 4,
        select: postCardSelect,
      })
    : [];

  if (byTag.length >= 4) return byTag;

  const filler = await prisma.post.findMany({
    where: {
      ...publishedWhere(),
      categoryId,
      id: { notIn: [postId, ...byTag.map((p) => p.id)] },
    },
    orderBy: byNewest,
    take: 4 - byTag.length,
    select: postCardSelect,
  });
  return [...byTag, ...filler];
}

export async function getMoreFromSection(categoryId: string, excludeId: string, take = 8) {
  return prisma.post.findMany({
    where: { ...publishedWhere(), categoryId, id: { not: excludeId } },
    orderBy: byNewest,
    take,
    select: {
      title: true,
      slug: true,
      publishedAt: true,
      coverImage: true,
      category: { select: { slug: true } },
    },
  });
}

export async function getApprovedComments(postId: string) {
  return prisma.comment.findMany({
    where: { postId, status: 'APPROVED' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      body: true,
      createdAt: true,
      parentId: true,
      guestName: true,
      user: { select: { name: true, image: true, slug: true } },
    },
  });
}

// ---------------------------------------------------------------- archives

export type ArchiveQuery = {
  categorySlug?: string;
  contentTypeSlug?: string;
  tagSlug?: string;
  authorSlug?: string;
  page?: number;
  perPage?: number;
};

export async function getArchive(query: ArchiveQuery) {
  const perPage = query.perPage ?? 24;
  const page = Math.max(1, query.page ?? 1);
  const where: Prisma.PostWhereInput = {
    ...publishedWhere(),
    ...(query.categorySlug ? { category: { slug: query.categorySlug } } : {}),
    ...(query.contentTypeSlug ? { contentType: { slug: query.contentTypeSlug } } : {}),
    ...(query.tagSlug ? { tags: { some: { slug: query.tagSlug } } } : {}),
    ...(query.authorSlug ? { author: { slug: query.authorSlug } } : {}),
  };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: byNewest,
      skip: (page - 1) * perPage,
      take: perPage,
      select: postCardSelect,
    }),
    prisma.post.count({ where }),
  ]);

  return { posts, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) };
}

// ---------------------------------------------------------------- search

/**
 * Postgres full-text search over the GIN index added in the second migration.
 * websearch_to_tsquery gives readers quoted phrases and OR for free.
 */
export async function searchPosts(q: string, page = 1, perPage = 20) {
  const term = q.trim();
  if (!term) return { posts: [] as PostCard[], total: 0, page, pages: 1 };

  const offset = (page - 1) * perPage;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p."id"
    FROM "Post" p
    WHERE p."status" = 'PUBLISHED'
      AND p."publishedAt" <= NOW()
      AND p."deletedAt" IS NULL
      AND to_tsvector('english',
            coalesce(p."title", '') || ' ' || coalesce(p."excerpt", '') || ' ' || coalesce(p."bodyText", '')
          ) @@ websearch_to_tsquery('english', ${term})
    ORDER BY ts_rank(
        to_tsvector('english',
          coalesce(p."title", '') || ' ' || coalesce(p."excerpt", '') || ' ' || coalesce(p."bodyText", '')),
        websearch_to_tsquery('english', ${term})
      ) DESC,
      p."publishedAt" DESC
    LIMIT ${perPage} OFFSET ${offset}
  `;

  const [{ count }] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "Post" p
    WHERE p."status" = 'PUBLISHED'
      AND p."publishedAt" <= NOW()
      AND p."deletedAt" IS NULL
      AND to_tsvector('english',
            coalesce(p."title", '') || ' ' || coalesce(p."excerpt", '') || ' ' || coalesce(p."bodyText", '')
          ) @@ websearch_to_tsquery('english', ${term})
  `;

  const ids = rows.map((r) => r.id);
  const posts = ids.length
    ? await prisma.post.findMany({ where: { id: { in: ids } }, select: postCardSelect })
    : [];
  const order = new Map(ids.map((id, i) => [id, i]));

  return {
    posts: posts.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)),
    total: Number(count),
    page,
    pages: Math.max(1, Math.ceil(Number(count) / perPage)),
  };
}

// ---------------------------------------------------------------- people

export async function getAuthorBySlug(slug: string) {
  return prisma.user.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      image: true,
      bio: true,
      socialLinks: true,
      role: true,
      _count: { select: { posts: { where: publishedWhere() } } },
    },
  });
}

export async function getTagBySlug(slug: string) {
  return prisma.tag.findUnique({ where: { slug }, select: { name: true, slug: true, useCount: true } });
}

export const getPopularTags = cachedQuery(
  async (take: number = 24) =>
    prisma.tag.findMany({
      where: { useCount: { gt: 0 } },
      orderBy: { useCount: 'desc' },
      take,
      select: { name: true, slug: true, useCount: true },
    }),
  ['popular-tags'],
  { tags: [POSTS_TAG], revalidate: 3600 },
);
