import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * Subject access request, self-service. Includes the demographic fields and a
 * count of the analytics rows linked to the account — but not the hashed
 * visitor identifiers themselves, which are not reversible to a person.
 */
export async function GET() {
  const session = await currentUser();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const [user, comments, pageViewCount, sessionCount, newsletter] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        bio: true,
        image: true,
        socialLinks: true,
        birthYear: true,
        gender: true,
        country: true,
        city: true,
        createdAt: true,
        lastLoginAt: true,
      },
    }),
    prisma.comment.findMany({
      where: { userId: session.id },
      select: {
        body: true,
        status: true,
        createdAt: true,
        post: { select: { title: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.pageView.count({ where: { userId: session.id } }),
    prisma.visitSession.count({ where: { userId: session.id } }),
    prisma.newsletter.findFirst({
      where: { email: session.email ?? '' },
      select: { email: true, confirmed: true, source: true, createdAt: true },
    }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    account: user,
    comments,
    newsletter,
    analytics: {
      note:
        'Page views are stored against a salted hash of a first-party cookie. Rows linked to this account are counted here; the identifiers themselves cannot be reversed to a person.',
      pageViewsLinkedToAccount: pageViewCount,
      sessionsLinkedToAccount: sessionCount,
      rawEventRetentionMonths: 14,
    },
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="volt-v-data-${session.id}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
