import type { Metadata } from 'next';

import { LocationClient } from './location-client';
import { DateRangePicker } from '@/components/admin/date-range-picker';
import { PageHeader } from '@/components/admin/page-header';
import { getCountryTotals, getNewVsReturning, parseRange, RANGE_LABELS } from '@/lib/analytics-queries';

export const metadata: Metadata = { title: 'Location' };
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ preset?: string; from?: string; to?: string }> };

export default async function LocationPage({ searchParams }: Props) {
  const params = await searchParams;
  const range = parseRange(params);

  const [countries, newVsReturning] = await Promise.all([
    getCountryTotals(range),
    getNewVsReturning(range),
  ]);

  const rangeQuery = new URLSearchParams(
    Object.entries(params).filter(([, value]) => Boolean(value)) as [string, string][],
  ).toString();

  return (
    <>
      <PageHeader
        title="Audience · Location"
        description={`${RANGE_LABELS[range.preset]} · ${countries.length} countries with recorded traffic.`}
      >
        <DateRangePicker
          preset={range.preset}
          from={range.from.toISOString().slice(0, 10)}
          to={range.to.toISOString().slice(0, 10)}
        />
      </PageHeader>

      <LocationClient
        countries={countries.map((row) => ({
          code: row.value,
          pageViews: row.pageViews,
          visitors: row.visitors,
          sessions: row.sessions,
          bounceRate: row.bounceRate,
          avgDurationSeconds: row.avgDurationSeconds,
          share: row.share,
        }))}
        newVsReturning={newVsReturning}
        rangeQuery={rangeQuery}
      />
    </>
  );
}
