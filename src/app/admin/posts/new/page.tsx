import type { Metadata } from 'next';

import { PageHeader } from '@/components/admin/page-header';
import { PostEditor } from '@/components/admin/editor/post-editor';
import { emptyDoc } from '@/lib/content';
import { can, requireCapability } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = { title: 'New post' };

export default async function NewPostPage() {
  const user = await requireCapability('post.create');

  const [categories, contentTypes, tags] = await Promise.all([
    prisma.category.findMany({ where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, name: true, slug: true } }),
    prisma.contentType.findMany({ orderBy: { order: 'asc' }, select: { id: true, name: true, slug: true } }),
    prisma.tag.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true } }),
  ]);

  return (
    <>
      <PageHeader title="New post" description="Draft it, tag it, then hand it to an editor." />
      <PostEditor
        post={{
          id: null,
          title: '',
          slug: '',
          excerpt: '',
          body: emptyDoc(),
          coverImage: '',
          coverAlt: '',
          categoryId: categories[0]?.id ?? '',
          contentTypeId: contentTypes[0]?.id ?? '',
          status: 'DRAFT',
          publishedAt: '',
          scheduledFor: '',
          isFeatured: false,
          isTrending: false,
          isEditorPick: false,
          rating: '',
          metaTitle: '',
          metaDescription: '',
          ogImage: '',
          tagIds: [],
          previewToken: '',
          authorName: user.name ?? undefined,
        }}
        categories={categories}
        contentTypes={contentTypes}
        tags={tags}
        canPublish={can(user.role, 'post.publish')}
        canDelete={false}
      />
    </>
  );
}
