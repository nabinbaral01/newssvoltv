'use server';

import { revalidatePath, updateTag } from 'next/cache';

import { assertCapability } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { NAV_TAG, POSTS_TAG } from '@/lib/queries';
import { slugify, uniqueSlug } from '@/lib/slug';
import { categorySchema } from '@/lib/validation';

export type TaxonomyState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

function bust() {
  updateTag(POSTS_TAG);
  updateTag(NAV_TAG);
  revalidatePath('/admin/taxonomy');
  revalidatePath('/');
}

export async function saveCategoryAction(
  _prev: TaxonomyState,
  formData: FormData,
): Promise<TaxonomyState> {
  try {
    await assertCapability('taxonomy.manage');
  } catch {
    return { error: 'Not authorised.' };
  }

  const id = String(formData.get('id') ?? '') || null;
  const parsed = categorySchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug') ?? '',
    description: formData.get('description') ?? '',
    colour: formData.get('colour'),
    parentId: formData.get('parentId') || null,
    order: formData.get('order') ?? 0,
    isActive: formData.get('isActive') === 'on',
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? 'form')] ??= issue.message;
    }
    return { fieldErrors };
  }

  const data = parsed.data;
  const slug = await uniqueSlug(data.slug || slugify(data.name), async (candidate) => {
    const clash = await prisma.category.findUnique({ where: { slug: candidate }, select: { id: true } });
    return Boolean(clash && clash.id !== id);
  });

  // A category cannot be its own parent, and we do not allow deeper than one
  // level of nesting — the second axis is ContentType, not sub-sub-categories.
  const parentId = data.parentId && data.parentId !== id ? data.parentId : null;

  if (id) {
    await prisma.category.update({
      where: { id },
      data: {
        name: data.name,
        slug,
        description: data.description || null,
        colour: data.colour,
        parentId,
        order: data.order,
        isActive: data.isActive,
      },
    });
  } else {
    await prisma.category.create({
      data: {
        name: data.name,
        slug,
        description: data.description || null,
        colour: data.colour,
        parentId,
        order: data.order,
        isActive: data.isActive,
      },
    });
  }

  bust();
  return { ok: true };
}

export async function deleteCategoryAction(id: string): Promise<TaxonomyState> {
  try {
    await assertCapability('taxonomy.manage');
  } catch {
    return { error: 'Not authorised.' };
  }

  const posts = await prisma.post.count({ where: { categoryId: id } });
  if (posts > 0) {
    return { error: `${posts} post(s) still use that category. Move them first.` };
  }

  await prisma.category.delete({ where: { id } });
  bust();
  return { ok: true };
}

export async function reorderCategoriesAction(order: string[]): Promise<TaxonomyState> {
  try {
    await assertCapability('taxonomy.manage');
  } catch {
    return { error: 'Not authorised.' };
  }

  await prisma.$transaction(
    order.map((id, index) => prisma.category.update({ where: { id }, data: { order: index + 1 } })),
  );

  bust();
  return { ok: true };
}

export async function renameTagAction(id: string, name: string): Promise<TaxonomyState> {
  try {
    await assertCapability('taxonomy.manage');
  } catch {
    return { error: 'Not authorised.' };
  }

  const trimmed = name.trim();
  if (trimmed.length < 2) return { error: 'Tag names need at least two characters.' };

  const slug = await uniqueSlug(slugify(trimmed), async (candidate) => {
    const clash = await prisma.tag.findUnique({ where: { slug: candidate }, select: { id: true } });
    return Boolean(clash && clash.id !== id);
  });

  await prisma.tag.update({ where: { id }, data: { name: trimmed, slug } });
  bust();
  return { ok: true };
}

/**
 * Merge `sourceIds` into `targetId`: every post on a source tag gains the
 * target, then the sources are deleted. Duplicate tags are the fastest way to
 * fragment an archive, so this is a first-class operation.
 */
export async function mergeTagsAction(targetId: string, sourceIds: string[]): Promise<TaxonomyState> {
  try {
    await assertCapability('taxonomy.manage');
  } catch {
    return { error: 'Not authorised.' };
  }

  const sources = sourceIds.filter((id) => id !== targetId);
  if (!sources.length) return { error: 'Pick at least one other tag to merge in.' };

  const target = await prisma.tag.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!target) return { error: 'The target tag no longer exists.' };

  const posts = await prisma.post.findMany({
    where: { tags: { some: { id: { in: sources } } } },
    select: { id: true },
  });

  await prisma.$transaction([
    ...posts.map((post) =>
      prisma.post.update({ where: { id: post.id }, data: { tags: { connect: { id: targetId } } } }),
    ),
    prisma.tag.deleteMany({ where: { id: { in: sources } } }),
  ]);

  await prisma.tag.update({
    where: { id: targetId },
    data: { useCount: await prisma.post.count({ where: { tags: { some: { id: targetId } } } }) },
  });

  bust();
  return { ok: true };
}

export async function deleteTagAction(id: string): Promise<TaxonomyState> {
  try {
    await assertCapability('taxonomy.manage');
  } catch {
    return { error: 'Not authorised.' };
  }
  await prisma.tag.delete({ where: { id } });
  bust();
  return { ok: true };
}
