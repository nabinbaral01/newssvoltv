import type { Metadata } from 'next';

import { CommentsClient, type CommentRow } from './comments-client';
import { PageHeader } from '@/components/admin/page-header';
import { requireCapability } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = { title: 'Comments' };
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ status?: string }> };

export default async function AdminCommentsPage({ searchParams }: Props) {
  await requireCapability('comment.moderate');
  const { status = 'PENDING' } = await searchParams;

  const [comments, grouped] = await Promise.all([
    prisma.comment.findMany({
      where: status ? { status: status as 'PENDING' } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        body: true,
        status: true,
        createdAt: true,
        parentId: true,
        guestName: true,
        user: { select: { name: true } },
        post: { select: { title: true, slug: true, category: { select: { slug: true } } } },
      },
    }),
    prisma.comment.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const rows: CommentRow[] = comments.map((comment) => ({
    id: comment.id,
    body: comment.body,
    status: comment.status,
    createdAt: comment.createdAt.toISOString(),
    authorName: comment.user?.name ?? comment.guestName ?? 'Deleted account',
    postTitle: comment.post.title,
    postHref: `/${comment.post.category.slug}/${comment.post.slug}#comments`,
    isReply: Boolean(comment.parentId),
  }));

  const counts = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]));
  const pending = counts.PENDING ?? 0;

  return (
    <>
      <PageHeader
        title="Comments"
        description={
          pending
            ? `${pending} comment${pending === 1 ? '' : 's'} waiting on a decision.`
            : 'Nothing waiting. New comments are held until someone approves them.'
        }
      />
      <CommentsClient comments={rows} status={status} counts={counts} />
    </>
  );
}
