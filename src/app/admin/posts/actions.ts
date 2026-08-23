'use server';

import { PostStatus, Prisma } from '@prisma/client';
import { revalidatePath, updateTag } from 'next/cache';
import { headers } from 'next/headers';

import { clientIp, hash } from '@/lib/analytics';
import { docToText, readingTime, autoExcerpt } from '@/lib/content';
import { assertCapability, can, currentUser } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { NAV_TAG, POSTS_TAG } from '@/lib/queries';
import { slugify, uniqueSlug } from '@/lib/slug';
import { TRASH_RETENTION_DAYS } from '@/lib/trash';
import { postSchema } from '@/lib/validation';

export type PostActionState = {
  ok?: boolean;
  id?: string;
  slug?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  savedAt?: string;
};

async function logAudit(
  userId: string,
  action: string,
  entityId: string,
  diff?: Prisma.InputJsonValue,
) {
  const requestHeaders = await headers();
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entity: 'Post',
      entityId,
      diff,
      ipHash: hash(clientIp(requestHeaders)),
    },
  });
}

/** Everything the public site caches off a post. Called on any status change. */
function revalidatePublic(categorySlug?: string, slug?: string) {
  // updateTag (not revalidateTag) so the editor sees its own write immediately.
  updateTag(POSTS_TAG);
  updateTag(NAV_TAG);
  revalidatePath('/');
  if (categorySlug) revalidatePath(`/${categorySlug}`);
  if (categorySlug && slug) revalidatePath(`/${categorySlug}/${slug}`);
  revalidatePath('/sitemap.xml', 'page');
  revalidatePath('/rss.xml', 'page');
}

function parseFormPayload(formData: FormData) {
  const raw = formData.get('payload');
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function savePostAction(
  _prev: PostActionState,
  formData: FormData,
): Promise<PostActionState> {
  const user = await currentUser();
  if (!user || !can(user.role, 'post.create')) return { error: 'Not authorised.' };

  const payload = parseFormPayload(formData);
  if (!payload) return { error: 'Could not read the editor payload.' };

  const parsed = postSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? 'form')] ??= issue.message;
    }
    return { fieldErrors, error: 'Some fields need attention.' };
  }

  const data = parsed.data;
  const id = String(formData.get('id') ?? '') || null;

  const existing = id
    ? await prisma.post.findUnique({
        where: { id },
        select: {
          id: true,
          authorId: true,
          slug: true,
          status: true,
          title: true,
          body: true,
          excerpt: true,
          publishedAt: true,
          category: { select: { slug: true } },
        },
      })
    : null;

  if (id && !existing) return { error: 'That post no longer exists.' };

  // An AUTHOR may only touch their own drafts, and may never publish.
  if (existing && existing.authorId !== user.id && !can(user.role, 'post.edit.any')) {
    return { error: 'You can only edit your own posts.' };
  }

  const status = data.status as PostStatus;
  if (
    (status === PostStatus.PUBLISHED || status === PostStatus.SCHEDULED) &&
    !can(user.role, 'post.publish')
  ) {
    // Silently downgrading would be worse than saying so.
    return {
      error: 'Your role can submit for review but not publish. Set the status to "In review".',
    };
  }

  const bodyText = docToText(data.body);
  const excerpt = data.excerpt?.trim() || autoExcerpt(bodyText, 190);

  const desiredSlug = data.slug?.trim() || slugify(data.title);
  const slug =
    existing && existing.slug === desiredSlug
      ? existing.slug
      : await uniqueSlug(desiredSlug, async (candidate) => {
          const clash = await prisma.post.findUnique({
            where: { slug: candidate },
            select: { id: true },
          });
          return Boolean(clash && clash.id !== id);
        });

  // Publishing without an explicit timestamp stamps "now" once, not on re-save.
  const publishedAt =
    status === PostStatus.PUBLISHED
      ? data.publishedAt
        ? new Date(data.publishedAt)
        : (existing?.publishedAt ?? new Date())
      : null;

  const scheduledFor =
    status === PostStatus.SCHEDULED && data.scheduledFor ? new Date(data.scheduledFor) : null;

  if (status === PostStatus.SCHEDULED && !scheduledFor) {
    return { fieldErrors: { scheduledFor: 'Pick a date and time to publish.' } };
  }

  const tagConnections = await resolveTags(data.tagIds, data.newTags);

  const common = {
    title: data.title.trim(),
    slug,
    excerpt,
    body: (data.body ?? null) as Prisma.InputJsonValue,
    bodyText,
    coverImage: data.coverImage || null,
    coverAlt: data.coverAlt || null,
    categoryId: data.categoryId,
    contentTypeId: data.contentTypeId,
    status,
    publishedAt,
    scheduledFor,
    isFeatured: data.isFeatured,
    isTrending: data.isTrending,
    isEditorPick: data.isEditorPick,
    readingTimeMinutes: readingTime(bodyText),
    rating: data.rating === '' || data.rating == null ? null : Number(data.rating),
    metaTitle: data.metaTitle || null,
    metaDescription: data.metaDescription || null,
    ogImage: data.ogImage || null,
  };

  const saved = existing
    ? await prisma.post.update({
        where: { id: existing.id },
        data: { ...common, tags: { set: tagConnections } },
        select: { id: true, slug: true, category: { select: { slug: true } } },
      })
    : await prisma.post.create({
        data: { ...common, authorId: user.id, tags: { connect: tagConnections } },
        select: { id: true, slug: true, category: { select: { slug: true } } },
      });

  // Revision snapshot of the *previous* state, so restore means something.
  if (existing) {
    await prisma.postRevision.create({
      data: {
        postId: existing.id,
        authorId: user.id,
        title: existing.title,
        excerpt: existing.excerpt,
        body: (existing.body ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        note: existing.status === status ? 'edit' : `status: ${existing.status} → ${status}`,
      },
    });
  }

  await syncTagCounts();
  await logAudit(user.id, existing ? 'post.update' : 'post.create', saved.id, {
    status,
    slug,
  });

  revalidatePublic(saved.category.slug, saved.slug);
  revalidatePath('/admin/posts');

  return { ok: true, id: saved.id, slug: saved.slug, savedAt: new Date().toISOString() };
}

async function resolveTags(tagIds: string[], newTags: string[]) {
  const created = await Promise.all(
    newTags
      .map((name) => name.trim())
      .filter(Boolean)
      .map(async (name) => {
        const slug = slugify(name);
        return prisma.tag.upsert({
          where: { slug },
          create: { name, slug },
          update: {},
          select: { id: true },
        });
      }),
  );
  const ids = new Set([...tagIds, ...created.map((tag) => tag.id)]);
  return [...ids].map((id) => ({ id }));
}

/** useCount drives the tag cloud and the merge screen; keep it truthful. */
async function syncTagCounts() {
  await prisma.$executeRawUnsafe(`
    UPDATE "Tag" t
    SET "useCount" = COALESCE(counts.total, 0)
    FROM (
      SELECT tag."id" AS tag_id, COUNT(pt."A")::int AS total
      FROM "Tag" tag
      LEFT JOIN "_PostTags" pt ON pt."B" = tag."id"
      GROUP BY tag."id"
    ) counts
    WHERE counts.tag_id = t."id" AND t."useCount" IS DISTINCT FROM counts.total
  `);
}

/** Autosave: body/title only, never touches status or slug. */
export async function autosaveAction(
  postId: string,
  title: string,
  body: unknown,
): Promise<{ savedAt: string } | { error: string }> {
  const user = await currentUser();
  if (!user || !can(user.role, 'post.create')) return { error: 'Not authorised.' };

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true },
  });
  if (!post) return { error: 'Post not found.' };
  if (post.authorId !== user.id && !can(user.role, 'post.edit.any')) {
    return { error: 'Not your post.' };
  }

  const bodyText = docToText(body);
  await prisma.post.update({
    where: { id: postId },
    data: {
      title: title.trim() || 'Untitled',
      body: (body ?? null) as Prisma.InputJsonValue,
      bodyText,
      readingTimeMinutes: readingTime(bodyText),
    },
  });

  return { savedAt: new Date().toISOString() };
}

export async function restoreRevisionAction(revisionId: string): Promise<PostActionState> {
  const user = await assertCapability('post.edit.own');

  const revision = await prisma.postRevision.findUnique({
    where: { id: revisionId },
    include: { post: { select: { id: true, authorId: true, slug: true, category: { select: { slug: true } } } } },
  });
  if (!revision) return { error: 'That revision is gone.' };
  if (revision.post.authorId !== user.id && !can(user.role, 'post.edit.any')) {
    return { error: 'Not your post.' };
  }

  const bodyText = docToText(revision.body);
  await prisma.post.update({
    where: { id: revision.postId },
    data: {
      title: revision.title,
      excerpt: revision.excerpt,
      body: (revision.body ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      bodyText,
      readingTimeMinutes: readingTime(bodyText),
    },
  });

  await logAudit(user.id, 'post.restore', revision.postId, { revisionId });
  revalidatePublic(revision.post.category.slug, revision.post.slug);
  revalidatePath(`/admin/posts/${revision.postId}`);

  return { ok: true, id: revision.postId };
}

export type BulkAction = 'publish' | 'archive' | 'draft' | 'delete' | 'restore' | 'purge';

export async function bulkPostAction(
  action: BulkAction,
  ids: string[],
): Promise<{ ok?: boolean; error?: string; affected?: number }> {
  const user = await currentUser();
  if (!user) return { error: 'Not authorised.' };

  // Purging is the only irreversible operation here, so it is admin-only even
  // though ordinary deletion is not.
  const needed =
    action === 'purge'
      ? 'post.delete'
      : action === 'delete'
        ? 'post.delete'
        : action === 'publish'
          ? 'post.publish'
          : 'post.edit.any';
  if (!can(user.role, needed)) return { error: 'Your role cannot do that.' };
  if (action === 'purge' && user.role !== 'ADMIN') {
    return { error: 'Only an administrator can permanently delete a post.' };
  }
  if (!ids.length) return { error: 'Nothing selected.' };

  let affected = 0;

  if (action === 'delete') {
    // Soft: the row, its comments and its analytics all survive.
    const result = await prisma.post.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date(), deletedById: user.id },
    });
    affected = result.count;
  } else if (action === 'restore') {
    const result = await prisma.post.updateMany({
      where: { id: { in: ids }, deletedAt: { not: null } },
      data: { deletedAt: null, deletedById: null },
    });
    affected = result.count;
  } else if (action === 'purge') {
    // Only ever reachable from the Trash view, and only for rows already
    // soft-deleted — so nothing can be destroyed in a single step.
    const result = await prisma.post.deleteMany({
      where: { id: { in: ids }, deletedAt: { not: null } },
    });
    affected = result.count;
  } else {
    const status =
      action === 'publish' ? PostStatus.PUBLISHED : action === 'archive' ? PostStatus.ARCHIVED : PostStatus.DRAFT;
    const result = await prisma.post.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: {
        status,
        ...(action === 'publish' ? { publishedAt: new Date() } : {}),
      },
    });
    affected = result.count;
  }

  await syncTagCounts();
  await logAudit(user.id, `post.bulk.${action}`, ids[0], { ids, affected });

  revalidatePublic();
  revalidatePath('/admin/posts');

  return { ok: true, affected };
}

export async function deletePostAction(id: string): Promise<{ ok?: boolean; error?: string }> {
  const user = await currentUser();
  if (!user || !can(user.role, 'post.delete')) return { error: 'Not authorised.' };

  const post = await prisma.post.findUnique({
    where: { id },
    select: { slug: true, category: { select: { slug: true } } },
  });
  if (!post) return { error: 'Already gone.' };

  // Soft delete: the editor's "Delete post" button sends it to Trash, where it
  // stays recoverable for TRASH_RETENTION_DAYS.
  await prisma.post.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: user.id },
  });
  await syncTagCounts();
  await logAudit(user.id, 'post.delete', id);

  revalidatePublic(post.category.slug, post.slug);
  revalidatePath('/admin/posts');
  return { ok: true };
}

/**
 * Empties the trash of anything past the retention window. Called by the
 * weekly cron alongside the analytics prune.
 */
export async function purgeExpiredTrash(): Promise<number> {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 86_400_000);
  const { count } = await prisma.post.deleteMany({
    where: { deletedAt: { not: null, lt: cutoff } },
  });
  return count;
}
