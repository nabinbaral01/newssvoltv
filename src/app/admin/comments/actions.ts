'use server';

import { CommentStatus } from '@prisma/client';
import { revalidatePath, updateTag } from 'next/cache';
import { headers } from 'next/headers';

import { clientIp, hash } from '@/lib/analytics';
import { assertCapability } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { POSTS_TAG } from '@/lib/queries';

export type ModerationResult = { ok?: boolean; error?: string; affected?: number };

/**
 * Comments publish on arrival, so moderation is a corrective act, not a gate.
 *
 *   spam     hides it from the site and keeps the row. Reversible.
 *   restore  puts a spammed comment back.
 *   delete   destroys it. The only irreversible one, so it is admin-only.
 *
 * Spam and delete are kept apart on purpose. Marking something spam is a
 * judgement an editor makes dozens of times a day and sometimes gets wrong;
 * it must not be the same button as "this is gone forever". Keeping the row
 * also means the thread it was replying to still makes sense.
 */
export type ModerationAction = 'spam' | 'restore' | 'delete';

export async function moderateComments(
  action: ModerationAction,
  ids: string[],
): Promise<ModerationResult> {
  let user;
  try {
    user = await assertCapability('comment.moderate');
  } catch {
    return { error: 'Not authorised.' };
  }

  // Deleting is the one thing that cannot be undone, so an editor can hide a
  // comment but only an administrator can destroy it.
  if (action === 'delete' && user.role !== 'ADMIN') {
    return { error: 'Only an administrator can delete a comment. Mark it as spam instead.' };
  }

  if (!ids.length) return { error: 'Nothing selected.' };

  // Which posts to bust the cache for — approved counts show on every card.
  const affectedPosts = await prisma.comment.findMany({
    where: { id: { in: ids } },
    select: { post: { select: { slug: true, category: { select: { slug: true } } } } },
  });

  let affected = 0;
  if (action === 'delete') {
    // Replies are cascaded by the schema; deleting a parent would otherwise
    // leave orphans pointing at nothing.
    affected = (await prisma.comment.deleteMany({ where: { id: { in: ids } } })).count;
  } else {
    const status = action === 'spam' ? CommentStatus.SPAM : CommentStatus.APPROVED;
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
