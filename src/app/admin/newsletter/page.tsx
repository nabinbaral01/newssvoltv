import type { Metadata } from 'next';

import { NewsletterClient } from './newsletter-client';
import { PageHeader } from '@/components/admin/page-header';
import { StatTile } from '@/components/admin/stat-tile';
import { requireCapability } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { percent } from '@/lib/utils';

export const metadata: Metadata = { title: 'Newsletter' };
export const dynamic = 'force-dynamic';

const DAY = 86_400_000;

/**
 * Clock reads live outside the component: the React Compiler's purity rules
 * treat a server component body as render, and `Date.now()` there is flagged
 * as impure even though the value is only ever used to build a query.
 */
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY);
}

function startOfDayDaysAgo(days: number): Date {
  const date = daysAgo(days);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export default async function NewsletterPage() {
  await requireCapability('newsletter.manage');

  const since = startOfDayDaysAgo(89);

  const [subscribers, total, confirmed, last30, previous30, bySource, daily] = await Promise.all([
    prisma.newsletter.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, email: true, confirmed: true, source: true, createdAt: true, confirmedAt: true },
    }),
    prisma.newsletter.count(),
    prisma.newsletter.count({ where: { confirmed: true } }),
    prisma.newsletter.count({ where: { createdAt: { gte: daysAgo(30) } } }),
    prisma.newsletter.count({
      where: {
        createdAt: { gte: daysAgo(60), lt: daysAgo(30) },
      },
    }),
    prisma.newsletter.groupBy({ by: ['source'], _count: { _all: true }, orderBy: { _count: { source: 'desc' } } }),
    prisma.$queryRaw<{ day: Date; signups: bigint; confirmed: bigint }[]>`
      SELECT date_trunc('day', "createdAt")::date AS day,
             COUNT(*)::bigint AS signups,
             COUNT(*) FILTER (WHERE "confirmed")::bigint AS confirmed
      FROM "Newsletter"
      WHERE "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
  ]);

  const growth = daily.map((row) => ({
    day: row.day.toISOString().slice(0, 10),
    signups: Number(row.signups),
    confirmed: Number(row.confirmed),
  }));

  return (
    <>
      <PageHeader
        title="Newsletter"
        description="Double opt-in: an address is only mailable once it has been confirmed."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total subscribers" value={total.toLocaleString()} />
        <StatTile
          label="Confirmed"
          value={confirmed.toLocaleString()}
          hint={`${percent(confirmed, total)} of the list`}
        />
        <StatTile
          label="Signups (30 days)"
          value={last30.toLocaleString()}
          current={last30}
          previous={previous30}
        />
        <StatTile
          label="Awaiting confirmation"
          value={(total - confirmed).toLocaleString()}
          hint="Sent a confirmation link but never clicked it"
        />
      </div>

      <div className="mt-6">
        <NewsletterClient
          subscribers={subscribers.map((row) => ({
            id: row.id,
            email: row.email,
            confirmed: row.confirmed,
            source: row.source,
            createdAt: row.createdAt.toISOString(),
            confirmedAt: row.confirmedAt?.toISOString() ?? null,
          }))}
          growth={growth}
          sources={bySource.map((row) => ({ label: row.source, value: row._count._all }))}
        />
      </div>
    </>
  );
}
