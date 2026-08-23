import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AccountForm } from './account-form';
import { currentUser } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Your account',
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const session = await currentUser();
  if (!session) redirect('/login?next=/account');

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      name: true,
      email: true,
      bio: true,
      birthYear: true,
      gender: true,
      country: true,
      city: true,
      createdAt: true,
      role: true,
      _count: { select: { comments: true } },
    },
  });
  if (!user) redirect('/login');

  const canAdmin = ['ADMIN', 'EDITOR', 'AUTHOR'].includes(user.role);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="border-b-2 border-accent pb-4">
        <h1 className="headline text-4xl uppercase">Your account</h1>
        <p className="mt-1 text-sm text-muted">
          Member since {formatDate(user.createdAt)} · {user._count.comments}{' '}
          {user._count.comments === 1 ? 'comment' : 'comments'}
          {canAdmin ? (
            <>
              {' '}
              ·{' '}
              <Link href="/admin" className="text-accent underline underline-offset-2">
                Open admin panel
              </Link>
            </>
          ) : null}
        </p>
      </header>

      <div className="mt-6">
        <AccountForm
          profile={{
            name: user.name,
            email: user.email,
            bio: user.bio,
            birthYear: user.birthYear,
            gender: user.gender,
            country: user.country,
            city: user.city,
          }}
        />
      </div>
    </div>
  );
}
