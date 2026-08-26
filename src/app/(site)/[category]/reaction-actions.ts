'use server';

import { ReactionKind } from '@prisma/client';
import { revalidatePath } from 'next/cache';

import { currentUser } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

export type ReactionState = {
  active?: boolean;
  count?: number;
  error?: string;
  /** Set when the action failed only because nobody is signed in. */
  needsSignIn?: boolean;
};

/**
 * Toggles a like or a save on an article.
 *
 * One action for both, and one action for both directions. The button is a
 * toggle, so splitting it would mean the client has to know the current state
 * to pick an endpoint — which is exactly what goes stale in a second tab.
 */
export async function toggleReactionAction(
  postId: string,
  kind: ReactionKind,
): Promise<ReactionState> {
  const user = await currentUser();
  if (!user) {
    return {
      needsSignIn: true,
      error: kind === ReactionKind.LIKE ? 'Sign in to like stories.' : 'Sign in to save stories.',
    };
  }

  // Cheap to do and cheap to undo; the limit only exists to stop a script
  // writing thousands of rows.
  const limit = rateLimit(`reaction:${user.id}`, 120, 60);
  if (!limit.ok) return { error: 'Slow down a moment.' };

  const post = await prisma.post.findFirst({
    where: { id: postId, status: 'PUBLISHED', deletedAt: null },
    select: { id: true, slug: true, category: { select: { slug: true } } },
  });
  if (!post) return { error: 'That story is no longer available.' };

  const existing = await prisma.postReaction.findUnique({
    where: { postId_userId_kind: { postId, userId: user.id, kind } },
    select: { id: true },
  });

  if (existing) {
    await prisma.postReaction.delete({ where: { id: existing.id } });
  } else {
    // The unique triple turns a double-tap into a no-op rather than a second
    // row, so a lost race here costs nothing.
    await prisma.postReaction.create({ data: { postId, userId: user.id, kind } }).catch(() => null);
  }

  const count =
    kind === ReactionKind.LIKE
      ? await prisma.postReaction.count({ where: { postId, kind: ReactionKind.LIKE } })
      : undefined;

  // A save shows up on the account page; a like changes a count on the article.
  if (kind === ReactionKind.SAVE) revalidatePath('/account');

  return { active: !existing, count };
}
