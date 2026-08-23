import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { currentUser } from '@/lib/permissions';
import { clientIp, hash } from '@/lib/analytics';
import { prisma } from '@/lib/prisma';
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
    where: { id: parsed.data.postId, status: 'PUBLISHED' },
    select: { id: true },
  });
  if (!post) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });

  // A reply must belong to the same post — otherwise a crafted parentId could
  // graft a thread onto an unrelated article.
  if (parsed.data.parentId) {
    const parent = await prisma.comment.findFirst({
      where: { id: parsed.data.parentId, postId: post.id },
      select: { id: true },
    });
    if (!parent) return NextResponse.json({ error: 'That thread no longer exists.' }, { status: 400 });
  }

  await prisma.comment.create({
    data: {
      postId: post.id,
      parentId: parsed.data.parentId ?? null,
      userId: user.id,
      body: parsed.data.body,
      status: 'PENDING',
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

  return NextResponse.json({ message: 'Thanks — your comment is awaiting moderation.' });
}
