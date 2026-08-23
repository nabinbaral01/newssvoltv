import type { Metadata } from 'next';

import { ProfileClient } from './profile-client';
import { PageHeader } from '@/components/admin/page-header';
import { can, requireCapability } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = { title: 'Your profile' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  // Any role that can reach the admin panel has a byline to maintain — an
  // AUTHOR needs this page exactly as much as an editor does.
  const session = await requireCapability('admin.access');

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      name: true,
      email: true,
      slug: true,
      title: true,
      bio: true,
      image: true,
      role: true,
      socialLinks: true,
      staffOrder: true,
      _count: { select: { posts: { where: { status: 'PUBLISHED', deletedAt: null } } } },
    },
  });
  if (!user) return null;

  return (
    <>
      <PageHeader
        title="Your profile"
        description="This is your byline. It appears on every story you write, on your author page and on the masthead."
      />

      <ProfileClient
        profile={{
          name: user.name,
          email: user.email,
          slug: user.slug,
          title: user.title,
          bio: user.bio,
          image: user.image,
          role: user.role,
          staffOrder: user.staffOrder,
          socialLinks: (user.socialLinks ?? {}) as Record<string, string>,
          publishedCount: user._count.posts,
        }}
        canEditSlug={can(user.role, 'users.manage')}
      />
    </>
  );
}
