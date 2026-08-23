'use server';

import { Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';

import { clientIp, hash } from '@/lib/analytics';
import { EMAIL_ENABLED, inviteEmail, passwordResetEmail, sendEmail } from '@/lib/email';
import { INVITE_TTL_MINUTES, issueResetToken, TOKEN_TTL_MINUTES } from '@/lib/password-reset';
import { assertCapability } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { SITE_URL } from '@/lib/site';
import { slugify, uniqueSlug } from '@/lib/slug';

export type UserState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  /**
   * The set-password link, returned so it can be copied by hand.
   *
   * Not a fallback for tidiness: on a sandbox sender an invitation to any
   * address but the account owner's is silently refused, and without this the
   * new colleague would simply never hear anything. The admin already created
   * the account, so seeing the link grants nothing they did not already have.
   */
  link?: string;
  emailSent?: boolean;
};

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'an administrator',
  EDITOR: 'an editor',
  AUTHOR: 'a writer',
  READER: 'a reader',
};

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
 * Creates the account and emails an invitation.
 *
 * The account is created with no password at all rather than a random one.
 * `authorize` refuses any account whose hashedPassword is null, so an invite
 * that is never accepted is an account nobody can sign in to — which is the
 * correct state for "invited, has not joined". A random password would be a
 * live credential sitting in the database for an account nobody is watching.
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
      hashedPassword: null,
    },
  });

  const result = await sendInvitation(user.id, user.name, user.email, user.role, admin.name ?? 'An administrator');

  await audit(admin.id, 'user.invite', user.id, {
    role: parsed.data.role,
    emailSent: result.emailSent,
  });
  revalidatePath('/admin/users');

  return {
    ok: true,
    link: result.link,
    emailSent: result.emailSent,
    message: result.emailSent
      ? `Invitation sent to ${parsed.data.email}.`
      : `${parsed.data.name} was added, but the invitation email could not be delivered. Send them the link below.`,
  };
}

/** Issues a fresh token and mails it. Shared by invite and re-invite. */
async function sendInvitation(
  userId: string,
  name: string,
  email: string,
  role: Role,
  invitedBy: string,
): Promise<{ link: string; emailSent: boolean }> {
  const requestHeaders = await headers();
  const { token } = await issueResetToken(userId, hash(clientIp(requestHeaders)), INVITE_TTL_MINUTES);
  const link = `${SITE_URL}/reset-password?token=${token}`;

  const message = inviteEmail(name, invitedBy, ROLE_LABELS[role], link, INVITE_TTL_MINUTES / (24 * 60));
  const sent = await sendEmail({ to: email, ...message });

  // EMAIL_ENABLED is false in development, where sendEmail prints to the
  // console and reports success. Calling that "sent" would be a lie on a
  // screen an admin is about to act on.
  return { link, emailSent: EMAIL_ENABLED && sent.ok };
}

/**
 * Re-sends an invitation. Issuing a new token invalidates the previous one, so
 * a forwarded old email stops working the moment a new one goes out.
 */
export async function resendInviteAction(userId: string): Promise<UserState> {
  let admin;
  try {
    admin = await assertCapability('users.manage');
  } catch {
    return { error: 'Not authorised.' };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, hashedPassword: true },
  });
  if (!user) return { error: 'That account no longer exists.' };
  if (user.hashedPassword) {
    return { error: `${user.name} has already set a password — send a reset instead.` };
  }

  const result = await sendInvitation(
    user.id,
    user.name,
    user.email,
    user.role,
    admin.name ?? 'An administrator',
  );
  await audit(admin.id, 'user.invite.resend', user.id, { emailSent: result.emailSent });

  return {
    ok: true,
    link: result.link,
    emailSent: result.emailSent,
    message: result.emailSent
      ? `Invitation re-sent to ${user.email}.`
      : 'Could not deliver the email. Send them the link below.',
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

/**
 * Sends the person a reset link rather than handing the admin a password.
 *
 * The old version generated a temporary password and printed it on screen for
 * the admin to relay. That means an administrator knows a working credential
 * for someone else's account, it travels through whatever chat app is to hand,
 * and it never expires. A link the person opens themselves keeps the password
 * something only they know.
 */
export async function resetPasswordAction(userId: string): Promise<UserState> {
  let admin;
  try {
    admin = await assertCapability('users.manage');
  } catch {
    return { error: 'Not authorised.' };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) return { error: 'That account no longer exists.' };

  const requestHeaders = await headers();
  const { token } = await issueResetToken(user.id, hash(clientIp(requestHeaders)));
  const link = `${SITE_URL}/reset-password?token=${token}`;

  const message = passwordResetEmail(user.name, link, TOKEN_TTL_MINUTES);
  const sent = await sendEmail({ to: user.email, ...message });
  const emailSent = EMAIL_ENABLED && sent.ok;

  await audit(admin.id, 'user.password.reset', userId, { emailSent });

  return {
    ok: true,
    link,
    emailSent,
    message: emailSent
      ? `Reset link sent to ${user.email}. It expires in ${TOKEN_TTL_MINUTES} minutes.`
      : 'Could not deliver the email. Send them the link below — it expires in an hour.',
  };
}
