import { Role } from '@prisma/client';
import { forbidden, redirect } from 'next/navigation';

import { auth } from '@/auth';

/**
 * The permission matrix, in one place.
 *
 *   ADMIN   everything, including users, settings and deletes
 *   EDITOR  publishes anyone's work, moderates comments, manages taxonomy
 *   AUTHOR  writes and submits their own posts; cannot publish
 *   READER  no admin access at all
 */
export const CAPABILITIES = {
  'admin.access': [Role.ADMIN, Role.EDITOR, Role.AUTHOR],
  'post.create': [Role.ADMIN, Role.EDITOR, Role.AUTHOR],
  'post.edit.own': [Role.ADMIN, Role.EDITOR, Role.AUTHOR],
  'post.edit.any': [Role.ADMIN, Role.EDITOR],
  'post.publish': [Role.ADMIN, Role.EDITOR],
  'post.delete': [Role.ADMIN, Role.EDITOR],
  'comment.moderate': [Role.ADMIN, Role.EDITOR],
  'taxonomy.manage': [Role.ADMIN, Role.EDITOR],
  'media.upload': [Role.ADMIN, Role.EDITOR, Role.AUTHOR],
  'media.delete.any': [Role.ADMIN, Role.EDITOR],
  'analytics.view': [Role.ADMIN, Role.EDITOR],
  'newsletter.manage': [Role.ADMIN, Role.EDITOR],
  'users.manage': [Role.ADMIN],
  'settings.manage': [Role.ADMIN],
} as const;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: Role | undefined | null, capability: Capability): boolean {
  if (!role) return false;
  return (CAPABILITIES[capability] as readonly Role[]).includes(role);
}

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: Role;
  slug: string;
};

export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  return (session?.user as SessionUser | undefined) ?? null;
}

/** Server-component guard: bounces anonymous users to login, others to 403. */
export async function requireCapability(capability: Capability): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=/admin`);
  if (!can(user.role, capability)) forbidden();
  return user;
}

/** Route-handler / server-action guard: throws instead of redirecting. */
export async function assertCapability(capability: Capability): Promise<SessionUser> {
  const user = await currentUser();
  if (!user || !can(user.role, capability)) {
    throw new Error('Not authorised');
  }
  return user;
}
