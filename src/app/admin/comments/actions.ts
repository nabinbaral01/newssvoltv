'use server';

import { CommentStatus } from '@prisma/client';
import { revalidatePath, updateTag } from 'next/cache';
import { headers } from 'next/headers';

import { clientIp, hash } from '@/lib/analytics';
import { assertCapability } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { POSTS_TAG } from '@/lib/queries';

export type ModerationResult = { ok?: boolean; error?: string; affected?: number };

export async function moderateComments(
  action: 'approve' | 'spam' | 'pending' | 'delete',
  ids: string[],
): Promise<ModerationResult> {
  let user;
  try {
    user = await assertCapability('comment.moderate');
  } catch {
    return { error: 'Not authorised.' };
  }

  if (!ids.length) return { error: 'Nothing selected.' };

  // Which posts to bust the cache for — approved counts show on every card.
  const affectedPosts = await prisma.comment.findMany({
    where: { id: { in: ids } },
    select: { post: { select: { slug: true, category: { select: { slug: true } } } } },
  });

  let affected = 0;
  if (action === 'delete') {
    affected = (await prisma.comment.deleteMany({ where: { id: { in: ids } } })).count;
  } else {
    const status =
      action === 'approve'
        ? CommentStatus.APPROVED
        : action === 'spam'
          ? CommentStatus.SPAM
          : CommentStatus.PENDING;
    affected = (await prisma.comment.updateMany({ where: { id: { in: ids } }, data: { status } })).count;
  }

  const requestHeaders = await headers();
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: `comment.${action}`,
      entity: 'Comment',
      entityId: ids[0],
      diff: { ids, affected },
      ipHash: hash(clientIp(requestHeaders)),
    },
  });

  updateTag(POSTS_TAG);
  revalidatePath('/admin/comments');
  for (const row of affectedPosts) {
    revalidatePath(`/${row.post.category.slug}/${row.post.slug}`);
  }

  return { ok: true, affected };
}
