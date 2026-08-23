import { Prisma } from '@prisma/client';

import { prisma } from './prisma';

/**
 * Where a media file is actually referenced.
 *
 * Deleting the library row does not unpublish anything — a cover image is a
 * URL string on the post, not a foreign key — so without this check "delete"
 * quietly breaks every article using the file, and the editor finds out from a
 * reader. Worse on Vercel Blob, where the object stays served: the row is gone
 * from the library, the picture is still on the site, and nothing explains
 * why.
 *
 * So the delete path asks first, and says exactly what it would break.
 */
export type MediaUsage = {
  /** Posts using it as their cover or share image. */
  covers: { id: string; title: string; slug: string; categorySlug: string }[];
  /** Posts with it embedded in the body. Cannot be safely rewritten. */
  inBody: { id: string; title: string; slug: string }[];
  /** People using it as their profile picture. */
  avatars: { id: string; name: string; slug: string }[];
  total: number;
};

export async function findMediaUsage(url: string): Promise<MediaUsage> {
  const [covers, avatars, inBody] = await Promise.all([
    prisma.post.findMany({
      where: { OR: [{ coverImage: url }, { ogImage: url }], deletedAt: null },
      select: { id: true, title: true, slug: true, category: { select: { slug: true } } },
      take: 20,
    }),
    prisma.user.findMany({
      where: { image: url },
      select: { id: true, name: true, slug: true },
      take: 20,
    }),
    // The body is a TipTap document, so an embedded image is a URL buried in
    // JSON. Casting to text and matching the URL is crude but exact enough:
    // these URLs carry random suffixes, so a substring hit is a real hit.
    prisma.$queryRaw<{ id: string; title: string; slug: string }[]>`
      SELECT "id", "title", "slug"
      FROM "Post"
      WHERE "deletedAt" IS NULL
        AND "body"::text LIKE ${'%' + url + '%'}
      LIMIT 20
    `,
  ]);

  const coverIds = new Set(covers.map((c) => c.id));

  return {
    covers: covers.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      categorySlug: c.category.slug,
    })),
    // A post that uses the file as its cover *and* embeds it is one problem,
    // not two — report it once, under the heading that can be fixed.
    inBody: inBody.filter((p) => !coverIds.has(p.id)),
    avatars,
    total: covers.length + avatars.length + inBody.filter((p) => !coverIds.has(p.id)).length,
  };
}

/**
 * Clears every reference this code can clear, for a forced delete.
 *
 * Covers and avatars become null — an article with no cover image renders
 * fine, and a profile falls back to initials. Body embeds are deliberately
 * left alone: rewriting a stored document to strip a node is a content edit,
 * and doing that silently to someone's article is not a delete button's job.
 * The caller is told how many were left behind.
 */
export async function clearMediaReferences(url: string): Promise<{ cleared: number }> {
  const [covers, ogs, avatars] = await prisma.$transaction([
    prisma.post.updateMany({ where: { coverImage: url }, data: { coverImage: null, coverAlt: null } }),
    prisma.post.updateMany({ where: { ogImage: url }, data: { ogImage: null } }),
    prisma.user.updateMany({ where: { image: url }, data: { image: null } }),
  ]);

  return { cleared: covers.count + ogs.count + avatars.count };
}

/** Human-readable summary for the confirm dialog. */
export function describeUsage(usage: MediaUsage): string {
  const parts: string[] = [];
  if (usage.covers.length) {
    parts.push(`${usage.covers.length} cover image${usage.covers.length === 1 ? '' : 's'}`);
  }
  if (usage.inBody.length) {
    parts.push(`${usage.inBody.length} article${usage.inBody.length === 1 ? '' : 's'} using it inline`);
  }
  if (usage.avatars.length) {
    parts.push(`${usage.avatars.length} profile picture${usage.avatars.length === 1 ? '' : 's'}`);
  }
  return parts.join(', ');
}

export const MEDIA_USAGE_SELECT = Prisma.validator<Prisma.PostSelect>()({
  id: true,
  title: true,
  slug: true,
});
