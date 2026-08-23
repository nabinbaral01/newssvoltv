'use server';

import { revalidatePath } from 'next/cache';

import { signOut } from '@/auth';
import { currentUser } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { accountSchema } from '@/lib/validation';

export type AccountState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

export async function updateAccountAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await currentUser();
  if (!user) return { error: 'You need to be signed in.' };

  const parsed = accountSchema.safeParse({
    name: formData.get('name'),
    bio: formData.get('bio') ?? '',
    birthYear: formData.get('birthYear') ?? '',
    gender: formData.get('gender') ?? '',
    country: formData.get('country') ?? '',
    city: formData.get('city') ?? '',
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? 'form')] ??= issue.message;
    }
    return { fieldErrors };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name,
      bio: parsed.data.bio || null,
      birthYear: parsed.data.birthYear,
      gender: parsed.data.gender,
      country: parsed.data.country,
      city: parsed.data.city,
    },
  });

  revalidatePath('/account');
  return { ok: true };
}

/**
 * Right to erasure. Comments are kept but detached (the thread would otherwise
 * lose its shape), and every analytics row tied to the account is unlinked so
 * nothing traces back to the person.
 */
export async function deleteAccountAction(
  _prev: AccountState,
  _formData: FormData,
): Promise<AccountState> {
  const user = await currentUser();
  if (!user) return { error: 'You need to be signed in.' };

  // Bylines are a public record — an account with published work has to be
  // handled by an editor who can reassign or unpublish it first.
  const authored = await prisma.post.count({ where: { authorId: user.id } });
  if (authored > 0) {
    return {
      error:
        'This account has published articles. Contact an editor to have them reassigned before deletion.',
    };
  }

  await prisma.$transaction([
    prisma.comment.updateMany({
      where: { userId: user.id },
      data: { userId: null, guestName: 'Deleted account' },
    }),
    prisma.pageView.updateMany({ where: { userId: user.id }, data: { userId: null } }),
    prisma.visitSession.updateMany({ where: { userId: user.id }, data: { userId: null } }),
    prisma.auditLog.updateMany({ where: { userId: user.id }, data: { userId: null } }),
    prisma.account.deleteMany({ where: { userId: user.id } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  await signOut({ redirectTo: '/?deleted=1' });
  return { ok: true };
}
