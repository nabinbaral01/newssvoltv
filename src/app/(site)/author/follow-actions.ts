'use server';

import { Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';

import { currentUser } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

export type FollowState = {
  following?: boolean;
  followers?: number;
  error?: string;
  /** Set when the action failed because nobody is signed in. */
  needsSignIn?: boolean;
};

/**
 * Follow or unfollow a writer.
 *
 * One action for both directions rather than two: the button is a toggle, and
 * splitting it means the client has to know the current state to pick an
 * endpoint — which is exactly the thing that goes stale in another tab.
 */
export async function toggleFollowAction(authorId: string): Promise<FollowState> {
  const user = await currentUser();
  if (!user) return { needsSignIn: true, error: 'Sign in to follow writers.' };

  // Following is cheap to do and cheap to undo, so the limit is only here to
  // stop a script from writing thousands of rows.
  const limit = rateLimit(`follow:${user.id}`, 60, 60);
  if (!limit.ok) return { error: 'Slow down a moment.' };

  if (authorId === user.id) return { error: 'You cannot follow yourself.' };

  // Only people who actually write can be followed. A reader account has no
  // public page for a follow to mean anything on, and allowing it would turn
  // the commenter list into a social graph nobody asked for.
  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { role: true, slug: true },
  });
  if (!author || author.role === Role.READER) return { error: 'That writer no longer exists.' };

  const existing = await prisma.follow.findUnique({
    where: { followerId_authorId: { followerId: user.id, authorId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
  } else {
    // The unique pair makes a double-click a no-op rather than a second row.
    await prisma.follow
      .create({ data: { followerId: user.id, authorId } })
      .catch(() => null);
  }

  const followers = await prisma.follow.count({ where: { authorId } });

  // The author page shows the count, and /account lists who you follow.
  revalidatePath(`/author/${author.slug}`);
  revalidatePath('/account');

  return { following: !existing, followers };
}
