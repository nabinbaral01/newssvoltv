import type { Metadata } from 'next';
import Link from 'next/link';
import { forbidden, notFound } from 'next/navigation';

import { PageHeader } from '@/components/admin/page-header';
import { PostEditor } from '@/components/admin/editor/post-editor';
import { Badge } from '@/components/ui/surface';
import { can, requireCapability } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { compactNumber } from '@/lib/utils';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await prisma.post.findUnique({ where: { id }, select: { title: true } });
  return { title: post ? `Editing: ${post.title}` : 'Post' };
}

/** datetime-local wants "YYYY-MM-DDTHH:mm" in local time, not an ISO string. */
function toLocalInput(date: Date | null): string {
  if (!date) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default async function EditPostPage({ params }: Props) {
  const user = await requireCapability('post.edit.own');
  const { id } = await params;

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      tags: { select: { id: true } },
      author: { select: { name: true } },
      _count: { select: { comments: true } },
    },
  });
  if (!post) notFound();

  if (post.authorId !== user.id && !can(user.role, 'post.edit.any')) forbidden();

  const [categories, contentTypes, tags, revisions] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, name: true, slug: true } }),
    prisma.contentType.findMany({ orderBy: { order: 'asc' }, select: { id: true, name: true, slug: true } }),
    prisma.tag.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true } }),
    prisma.postRevision.findMany({
      where: { postId: id },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: {
        id: true,
        title: true,
        note: true,
        createdAt: true,
        author: { select: { name: true } },
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Edit post"
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{compactNumber(post.viewCount)} views</Badge>
            <Badge>{post._count.comments} comments</Badge>
            <Link href="/admin/posts" className="text-accent hover:underline">
              ← All posts
            </Link>
          </span>
        }
      />

      <PostEditor
        post={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt ?? '',
          body: post.body,
          coverImage: post.coverImage ?? '',
          coverAlt: post.coverAlt ?? '',
          categoryId: post.categoryId,
          contentTypeId: post.contentTypeId,
          status: post.status,
          publishedAt: toLocalInput(post.publishedAt),
          scheduledFor: toLocalInput(post.scheduledFor),
          isFeatured: post.isFeatured,
          isTrending: post.isTrending,
          isEditorPick: post.isEditorPick,
          rating: post.rating != null ? String(post.rating) : '',
          metaTitle: post.metaTitle ?? '',
          metaDescription: post.metaDescription ?? '',
          ogImage: post.ogImage ?? '',
          tagIds: post.tags.map((tag) => tag.id),
          previewToken: post.previewToken,
          authorName: post.author.name,
          viewCount: post.viewCount,
        }}
        categories={categories}
        contentTypes={contentTypes}
        tags={tags}
        revisions={revisions.map((revision) => ({
          id: revision.id,
          title: revision.title,
          note: revision.note,
          createdAt: revision.createdAt.toISOString(),
          authorName: revision.author?.name ?? null,
        }))}
        canPublish={can(user.role, 'post.publish')}
        canDelete={can(user.role, 'post.delete')}
      />
    </>
  );
}
