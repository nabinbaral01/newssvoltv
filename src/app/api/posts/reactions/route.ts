import { ReactionKind } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';

import { currentUser } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The viewer's own like/save state for one article.
 *
 * This exists because the article route is ISR-cached and shared by every
 * reader. "Have I liked this" is per-person, so rendering it into that cached
 * HTML would show one reader's state to everybody — and opting the route out
 * of caching would charge every visitor for something only signed-in readers
 * use.
 *
 * Anonymous callers get an immediate empty answer: `currentUser` reads a JWT
 * and touches no database, so this costs nothing for the majority of visits.
 */
export async function GET(request: NextRequest) {
  const postId = request.nextUrl.searchParams.get('postId');
  if (!postId) return NextResponse.json({ error: 'postId is required' }, { status: 400 });

  const user = await currentUser();
  if (!user) {
    return NextResponse.json(
      { liked: false, saved: false, following: false, isAuthor: false },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // The author is resolved from the post rather than taken from the query, so
  // a crafted request cannot ask "am I following <someone else>" through here.
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true },
  });

  const [rows, follow] = await Promise.all([
    prisma.postReaction.findMany({
      where: { postId, userId: user.id },
      select: { kind: true },
    }),
    post
      ? prisma.follow.findUnique({
          where: { followerId_authorId: { followerId: user.id, authorId: post.authorId } },
          select: { id: true },
        })
      : null,
  ]);

  return NextResponse.json(
    {
      liked: rows.some((r) => r.kind === ReactionKind.LIKE),
      saved: rows.some((r) => r.kind === ReactionKind.SAVE),
      following: Boolean(follow),
      // Nobody follows themselves, so the rail hides the control entirely.
      isAuthor: post?.authorId === user.id,
    },
    // Per-reader, so it must never touch a shared cache.
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
