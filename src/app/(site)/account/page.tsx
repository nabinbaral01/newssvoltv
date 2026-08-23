import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AccountForm } from './account-form';
import { AvatarPicker } from '@/components/avatar-picker';
import { bylineTitle, initials } from '@/lib/byline';
import { getFollowedAuthors } from '@/lib/queries';
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
      image: true,
      createdAt: true,
      role: true,
      _count: { select: { comments: true } },
    },
  });
  if (!user) redirect('/login');

  const following = await getFollowedAuthors(session.id);

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

      {/* Every account gets a picture — it is the one thing a reader can
          change about how they appear, on their comments. Bylines, links and
          the public author page stay with people who actually write. */}
      <section className="mt-6 rounded-card border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Profile picture</h2>
        <p className="mt-0.5 text-xs text-muted">
          Shown beside your comments{canAdmin ? ' and on your author page' : ''}.
        </p>
        <div className="mt-4">
          <AvatarPicker name={user.name} image={user.image} />
        </div>
      </section>

      {following.length ? (
        <section className="mt-6 rounded-card border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">Writers you follow</h2>
          <p className="mt-0.5 text-xs text-muted">
            Their latest story, so following actually gets you something.
          </p>
          <ul className="mt-4 divide-y divide-border">
            {following.map((author) => (
              <li key={author.slug} className="flex items-center gap-3 py-3">
                <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-elevated text-xs font-bold text-accent">
                  {author.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={author.image} alt="" className="size-full object-cover" />
                  ) : (
                    initials(author.name)
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/author/${author.slug}`}
                    className="text-sm font-medium hover:text-accent"
                  >
                    {author.name}
                  </Link>
                  <p className="text-[11px] uppercase tracking-widest text-muted">
                    {bylineTitle(author)}
                  </p>
                </div>
                {author.posts[0] ? (
                  <Link
                    href={`/${author.posts[0].category.slug}/${author.posts[0].slug}`}
                    className="hidden max-w-xs truncate text-xs text-muted hover:text-accent sm:block"
                  >
                    {author.posts[0].title}
                  </Link>
                ) : (
                  <span className="hidden text-xs text-muted sm:block">No stories yet</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
