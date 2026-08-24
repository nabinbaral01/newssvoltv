import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { currentUser } from '@/lib/permissions';
import { clientIp, hash } from '@/lib/analytics';
import { prisma } from '@/lib/prisma';
import { getApprovedComments, POSTS_TAG } from '@/lib/queries';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const schema = z.object({
  postId: z.string().min(1),
  parentId: z.string().min(1).optional(),
  body: z.string().trim().min(2).max(4000),
});

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to comment.' }, { status: 401 });
  }

  const limit = rateLimit(`comment:${user.id}`, 6, 300);
  if (!limit.ok) return tooManyRequests(limit);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Comment must be between 2 and 4000 characters.' }, { status: 400 });
  }

  const post = await prisma.post.findFirst({
    where: { id: parsed.data.postId, status: 'PUBLISHED', deletedAt: null },
    select: { id: true, slug: true, category: { select: { slug: true } } },
  });
  if (!post) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
  const postPath = post;

  // A reply must belong to the same post — otherwise a crafted parentId could
  // graft a thread onto an unrelated article.
  if (parsed.data.parentId) {
    const parent = await prisma.comment.findFirst({
      where: { id: parsed.data.parentId, postId: post.id },
      select: { id: true },
    });
    if (!parent) return NextResponse.json({ error: 'That thread no longer exists.' }, { status: 400 });
  }

  // Published immediately. A queue nobody empties is worse than no queue —
  // comments sit unseen for days, the thread dies, and people stop bothering.
  // Moderation is after the fact: an editor removes or spams what should not
  // be there. The rate limit above is what stands between the site and a
  // flood, and it applies before anything is written.
  await prisma.comment.create({
    data: {
      postId: post.id,
      parentId: parsed.data.parentId ?? null,
      userId: user.id,
      body: parsed.data.body,
      status: 'APPROVED',
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'comment.create',
      entity: 'Comment',
      entityId: post.id,
      ipHash: hash(clientIp(request.headers)),
    },
  });

  // The article page caches its approved comments, so without this the author
  // reloads and cannot see what they just wrote. A route handler is not a
  // Server Action, so this is revalidateTag with a profile, not updateTag.
  revalidateTag(POSTS_TAG, 'max');
  revalidatePath(`/${postPath.category.slug}/${postPath.slug}`);

  return NextResponse.json({ message: 'Posted.' });
}

/**
 * The approved thread for one post.
 *
 * The article page is ISR-cached, which is right for an article and wrong for
 * a comment someone just wrote: revalidatePath marks the page stale but the
 * next request is still served the previous render, so the author reloads and
 * their own comment is missing. Rather than make the busiest route on the site
 * dynamic for everyone, the thread refetches itself here — only for the people
 * who actually post something.
 */
export async function GET(request: NextRequest) {
  const postId = request.nextUrl.searchParams.get('postId');
  if (!postId) return NextResponse.json({ error: 'postId is required' }, { status: 400 });

  const comments = await getApprovedComments(postId);

  return NextResponse.json(
    {
      comments: comments.map((comment) => ({
        ...comment,
        createdAt: comment.createdAt.toISOString(),
      })),
    },
    // Never cached: the whole point is to see what the cached page cannot show.
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
