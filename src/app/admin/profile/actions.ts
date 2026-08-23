'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { headers } from 'next/headers';

import { clientIp, hash } from '@/lib/analytics';
import { assertCapability, can, currentUser } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { NAV_TAG, STAFF_TAG } from '@/lib/queries';
import { slugify, uniqueSlug } from '@/lib/slug';
import { staffAdminFieldsSchema, staffProfileSchema } from '@/lib/validation';

export type ProfileState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  savedAt?: string;
};

function collectFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    // Social links arrive as socialLinks.x — key them by platform so the error
    // lands under the right input rather than on the section as a whole.
    const key =
      issue.path[0] === 'socialLinks' && issue.path[1]
        ? `social.${String(issue.path[1])}`
        : String(issue.path[0] ?? 'form');
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

/**
 * Saves the signed-in user's own byline.
 *
 * Deliberately self-only. Editing someone else's public identity is a
 * different act with different consequences — it belongs in Users & roles,
 * behind `users.manage`, not in a page called "Your profile".
 */
export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await currentUser();
  if (!user || !can(user.role, 'admin.access')) {
    return { error: 'Not authorised.' };
  }

  const socialLinks: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('social.') && typeof value === 'string') {
      socialLinks[key.slice('social.'.length)] = value.trim();
    }
  }

  const parsed = staffProfileSchema.safeParse({
    name: formData.get('name'),
    title: formData.get('title') ?? '',
    bio: formData.get('bio') ?? '',
    image: formData.get('image') ?? '',
    socialLinks,
  });

  if (!parsed.success) {
    return {
      fieldErrors: collectFieldErrors(parsed.error.issues),
      error: 'Some fields need attention.',
    };
  }

  const data = parsed.data;

  // The slug is the public URL of every article this person has written. An
  // admin may change it; nobody else can, because doing so 404s their whole
  // back catalogue and hands the old URL to whoever claims it next.
  let slug: string | undefined;
  let staffOrder: number | undefined;

  if (can(user.role, 'users.manage')) {
    const admin = staffAdminFieldsSchema.safeParse({
      slug: formData.get('slug') || slugify(data.name),
      staffOrder: formData.get('staffOrder') ?? 0,
    });
    if (!admin.success) {
      return {
        fieldErrors: collectFieldErrors(admin.error.issues),
        error: 'Some fields need attention.',
      };
    }
    staffOrder = admin.data.staffOrder;
    slug = await uniqueSlug(admin.data.slug, async (candidate) => {
      const clash = await prisma.user.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      return Boolean(clash && clash.id !== user.id);
    });
  }

  const before = await prisma.user.findUnique({
    where: { id: user.id },
    select: { slug: true, title: true, name: true },
  });

  const saved = await prisma.user.update({
    where: { id: user.id },
    data: {
      name: data.name,
      title: data.title,
      bio: data.bio,
      image: data.image,
      socialLinks: data.socialLinks,
      ...(slug ? { slug } : {}),
      ...(staffOrder !== undefined ? { staffOrder } : {}),
    },
    select: { slug: true },
  });

  const requestHeaders = await headers();
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'profile.update',
      entity: 'User',
      entityId: user.id,
      diff: {
        name: data.name,
        title: data.title,
        ...(before && before.slug !== saved.slug ? { slugFrom: before.slug, slugTo: saved.slug } : {}),
      },
      ipHash: hash(clientIp(requestHeaders)),
    },
  });

  // Bylines appear on every card on the site, so this is a broad invalidation.
  updateTag(STAFF_TAG);
  updateTag(NAV_TAG);
  revalidatePath('/authors');
  revalidatePath(`/author/${saved.slug}`);
  if (before && before.slug !== saved.slug) revalidatePath(`/author/${before.slug}`);
  revalidatePath('/admin/profile');

  return { ok: true, savedAt: new Date().toISOString() };
}

/**
 * Clears the avatar. A separate action because "remove" through the same form
 * would mean an empty file input is indistinguishable from "leave it alone".
 */
export async function removeAvatarAction(): Promise<ProfileState> {
  const user = await assertCapability('admin.access');

  const saved = await prisma.user.update({
    where: { id: user.id },
    data: { image: null },
    select: { slug: true },
  });

  updateTag(STAFF_TAG);
  revalidatePath('/authors');
  revalidatePath(`/author/${saved.slug}`);
  revalidatePath('/admin/profile');

  return { ok: true };
}
