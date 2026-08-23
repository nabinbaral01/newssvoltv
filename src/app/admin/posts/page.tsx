import { Prisma } from '@prisma/client';
import { PenLine, Trash2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PostsTable, type PostRow } from './posts-table';
import { TRASH_RETENTION_DAYS } from '@/lib/trash';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { can, requireCapability } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { cn, formatNumber } from '@/lib/utils';

export const metadata: Metadata = { title: 'Posts' };
export const dynamic = 'force-dynamic';

const PER_PAGE = 25;

type Props = {
  searchParams: Promise<{
    q?: string; status?: string; category?: string; contentType?: string;
    author?: string; from?: string; to?: string; page?: string; trash?: string;
  }>;
};

export default async function AdminPostsPage({ searchParams }: Props) {
  const user = await requireCapability('post.create');
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const inTrash = params.trash === '1';

  const where: Prisma.PostWhereInput = {
    // Deleted posts are hidden everywhere except the Trash view.
    deletedAt: inTrash ? { not: null } : null,
    // Authors see only their own work; editors and admins see everything.
    ...(can(user.role, 'post.edit.any') ? {} : { authorId: user.id }),
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: 'insensitive' } },
            { slug: { contains: params.q, mode: 'insensitive' } },
            { excerpt: { contains: params.q, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(params.status ? { status: params.status as Prisma.EnumPostStatusFilter['equals'] } : {}),
    ...(params.category ? { categoryId: params.category } : {}),
    ...(params.contentType ? { contentTypeId: params.contentType } : {}),
    ...(params.author ? { authorId: params.author } : {}),
    ...(params.from || params.to
      ? {
          createdAt: {
            ...(params.from ? { gte: new Date(params.from) } : {}),
            ...(params.to ? { lte: new Date(`${params.to}T23:59:59`) } : {}),
          },
        }
      : {}),
  };

  const [posts, total, categories, contentTypes, authors, counts, trashCount] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: inTrash ? [{ deletedAt: 'desc' }] : [{ updatedAt: 'desc' }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true, title: true, slug: true, status: true, publishedAt: true,
        scheduledFor: true, viewCount: true, isFeatured: true, isTrending: true,
        previewToken: true, deletedAt: true,
        deletedBy: { select: { name: true } },
        author: { select: { name: true } },
        category: { select: { name: true, slug: true } },
        contentType: { select: { name: true } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.post.count({ where }),
    prisma.category.findMany({ orderBy: { order: 'asc' }, select: { id: true, name: true } }),
    prisma.contentType.findMany({ orderBy: { order: 'asc' }, select: { id: true, name: true } }),
    can(user.role, 'post.edit.any')
      ? prisma.user.findMany({
          where: { role: { in: ['ADMIN', 'EDITOR', 'AUTHOR'] } },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        })
      : Promise.resolve([{ id: user.id, name: user.name ?? 'You' }]),
    prisma.post.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.post.count({ where: { deletedAt: { not: null } } }),
  ]);

  const rows: PostRow[] = posts.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    status: post.status,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    scheduledFor: post.scheduledFor?.toISOString() ?? null,
    viewCount: post.viewCount,
    comments: post._count.comments,
    authorName: post.author.name,
    categoryName: post.category.name,
    categorySlug: post.category.slug,
    contentTypeName: post.contentType.name,
    isFeatured: post.isFeatured,
    isTrending: post.isTrending,
    previewToken: post.previewToken,
    deletedAt: post.deletedAt?.toISOString() ?? null,
    deletedByName: post.deletedBy?.name ?? null,
  }));

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const countFor = (status: string) => counts.find((c) => c.status === status)?._count._all ?? 0;

  const buildHref = (targetPage: number) => {
    const next = new URLSearchParams(
      Object.entries(params).filter(([, value]) => Boolean(value)) as [string, string][],
    );
    if (targetPage > 1) next.set('page', String(targetPage));
    else next.delete('page');
    const qs = next.toString();
    return qs ? `/admin/posts?${qs}` : '/admin/posts';
  };

  return (
    <>
      <PageHeader
        title={inTrash ? 'Trash' : 'Posts'}
        description={
          inTrash ? (
            <>
              {formatNumber(total)} deleted post{total === 1 ? '' : 's'}, kept for
              {' '}{TRASH_RETENTION_DAYS} days before they are removed for good.
            </>
          ) : (
            <>
              {formatNumber(total)} matching · {countFor('PUBLISHED')} published ·{' '}
              {countFor('DRAFT')} draft · {countFor('IN_REVIEW')} in review ·{' '}
              {countFor('SCHEDULED')} scheduled
            </>
          )
        }
        actions={
          inTrash ? (
            <Button asChild variant="outline">
              <Link href="/admin/posts">← Back to posts</Link>
            </Button>
          ) : (
            <>
              {trashCount > 0 ? (
                <Button asChild variant="outline">
                  <Link href="/admin/posts?trash=1">
                    <Trash2 className="size-4" /> Trash ({trashCount})
                  </Link>
                </Button>
              ) : null}
              <Button asChild>
                <Link href="/admin/posts/new">
                  <PenLine className="size-4" /> New post
                </Link>
              </Button>
            </>
          )
        }
      />

      <PostsTable
        posts={rows}
        categories={categories}
        contentTypes={contentTypes}
        authors={authors}
        filters={{
          q: params.q ?? '',
          status: params.status ?? '',
          category: params.category ?? '',
          contentType: params.contentType ?? '',
          author: params.author ?? '',
          from: params.from ?? '',
          to: params.to ?? '',
        }}
        canBulkEdit={can(user.role, 'post.edit.any')}
        canDelete={can(user.role, 'post.delete')}
        canPublish={can(user.role, 'post.publish')}
        inTrash={inTrash}
        isAdmin={user.role === 'ADMIN'}
      />

      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 2)
            .map((n, index, list) => (
              <span key={n} className="flex items-center gap-2">
                {index > 0 && n - list[index - 1] > 1 ? <span className="text-muted">…</span> : null}
                <Link
                  href={buildHref(n)}
                  aria-current={n === page ? 'page' : undefined}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-sm',
                    n === page ? 'border-accent bg-accent text-accent-fg' : 'border-border hover:border-accent',
                  )}
                >
                  {n}
                </Link>
              </span>
            ))}
        </nav>
      ) : null}
    </>
  );
}
