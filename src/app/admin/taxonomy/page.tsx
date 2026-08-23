import type { Metadata } from 'next';

import { TaxonomyClient } from './taxonomy-client';
import { PageHeader } from '@/components/admin/page-header';
import { requireCapability } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = { title: 'Categories & tags' };
export const dynamic = 'force-dynamic';

export default async function TaxonomyPage() {
  await requireCapability('taxonomy.manage');

  const [categories, tags, contentTypes] = await Promise.all([
    prisma.category.findMany({
      orderBy: { order: 'asc' },
      select: {
        id: true, name: true, slug: true, description: true, colour: true,
        parentId: true, order: true, isActive: true,
        _count: { select: { posts: true } },
      },
    }),
    prisma.tag.findMany({
      orderBy: [{ useCount: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, useCount: true },
    }),
    prisma.contentType.findMany({
      orderBy: { order: 'asc' },
      select: { id: true, name: true, slug: true, _count: { select: { posts: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Categories & tags"
        description="Two axes, not one: a post is Movies × Review. Categories are the verticals, content types are the formats, and tags are the granular topics underneath both."
      />

      <div className="mb-4 rounded-card border border-border bg-surface p-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">Content types</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {contentTypes.map((type) => (
            <li
              key={type.id}
              className="rounded-full border border-border bg-elevated px-3 py-1 text-xs"
            >
              {type.name}
              <span className="ml-2 tabular-nums text-muted">{type._count.posts}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          Formats are deliberately a fixed, small set — they are the second axis of the model, not
          a place for ad-hoc labels. Use tags for those.
        </p>
      </div>

      <TaxonomyClient
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          colour: category.colour,
          parentId: category.parentId,
          order: category.order,
          isActive: category.isActive,
          postCount: category._count.posts,
        }))}
        tags={tags}
      />
    </>
  );
}
