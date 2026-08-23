'use server';

import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';

import { clientIp, hash } from '@/lib/analytics';
import { assertCapability } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { slugify, uniqueSlug } from '@/lib/slug';

export type UserState = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> };

const inviteSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(['ADMIN', 'EDITOR', 'AUTHOR', 'READER']),
  bio: z.string().max(400).optional(),
});

async function audit(userId: string, action: string, entityId: string, diff?: object) {
  const requestHeaders = await headers();
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entity: 'User',
      entityId,
      diff: diff as never,
      ipHash: hash(clientIp(requestHeaders)),
    },
  });
}

/**
 * Invites create the account with a random password and return a one-time
 * link. Wiring an ESP in here is the only step to make it a real email.
 */
export async function inviteUserAction(_prev: UserState, formData: FormData): Promise<UserState> {
  let admin;
  try {
    admin = await assertCapability('users.manage');
  } catch {
    return { error: 'Not authorised.' };
  }

  const parsed = inviteSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    role: formData.get('role'),
    bio: formData.get('bio') ?? '',
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? 'form')] ??= issue.message;
    }
    return { fieldErrors };
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (existing) return { fieldErrors: { email: 'That address already has an account.' } };

  const temporaryPassword = crypto.randomBytes(9).toString('base64url');
  const slug = await uniqueSlug(slugify(parsed.data.name), async (candidate) =>
    Boolean(await prisma.user.findUnique({ where: { slug: candidate }, select: { id: true } })),
  );

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      slug,
      role: parsed.data.role as Role,
      bio: parsed.data.bio || null,
      hashedPassword: await bcrypt.hash(temporaryPassword, 10),
    },
  });

  await audit(admin.id, 'user.invite', user.id, { role: parsed.data.role });
  revalidatePath('/admin/users');

  return {
    ok: true,
    message: `Invited ${parsed.data.name}. Temporary password: ${temporaryPassword} — send it over a channel you trust, they can change it in their account.`,
  };
}

export async function changeRoleAction(userId: string, role: Role): Promise<UserState> {
  let admin;
  try {
    admin = await assertCapability('users.manage');
  } catch {
    return { error: 'Not authorised.' };
  }

  // Never let the last administrator demote themselves out of the building.
  if (userId === admin.id && role !== Role.ADMIN) {
    const admins = await prisma.user.count({ where: { role: Role.ADMIN } });
    if (admins <= 1) return { error: 'You are the only administrator — promote someone first.' };
  }

  const before = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  await prisma.user.update({ where: { id: userId }, data: { role } });
  await audit(admin.id, 'user.role.change', userId, { from: before?.role, to: role });

  revalidatePath('/admin/users');
  return { ok: true, message: 'Role updated.' };
}

export async function deleteUserAction(userId: string): Promise<UserState> {
  let admin;
  try {
    admin = await assertCapability('users.manage');
  } catch {
    return { error: 'Not authorised.' };
  }

  if (userId === admin.id) return { error: 'You cannot delete your own account here.' };

  const posts = await prisma.post.count({ where: { authorId: userId } });
  if (posts > 0) {
    return { error: `${posts} post(s) are bylined to this account. Reassign them first.` };
  }

  await prisma.$transaction([
    prisma.comment.updateMany({ where: { userId }, data: { userId: null, guestName: 'Deleted account' } }),
    prisma.pageView.updateMany({ where: { userId }, data: { userId: null } }),
    prisma.visitSession.updateMany({ where: { userId }, data: { userId: null } }),
    prisma.auditLog.updateMany({ where: { userId }, data: { userId: null } }),
    prisma.account.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  await audit(admin.id, 'user.delete', userId);
  revalidatePath('/admin/users');
  return { ok: true, message: 'Account deleted.' };
}

export async function resetPasswordAction(userId: string): Promise<UserState> {
  let admin;
  try {
    admin = await assertCapability('users.manage');
  } catch {
    return { error: 'Not authorised.' };
  }

  const temporaryPassword = crypto.randomBytes(9).toString('base64url');
  await prisma.user.update({
    where: { id: userId },
    data: { hashedPassword: await bcrypt.hash(temporaryPassword, 10) },
  });

  await audit(admin.id, 'user.password.reset', userId);
  return { ok: true, message: `Temporary password: ${temporaryPassword}` };
}
