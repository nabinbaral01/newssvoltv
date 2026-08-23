'use client';

import { Loader2 } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { BarList, DonutChart } from '@/components/admin/charts/basic-charts';
import { ChartFrame } from '@/components/admin/charts/chart-frame';
import { CoverageBadge } from '@/components/admin/charts/coverage';
import { Select } from '@/components/ui/field';
import { AGE_BUCKETS, GENDER_LABELS } from '@/lib/analytics';
import type { DemographicReport } from '@/lib/analytics-queries';
import { cn, compactNumber, countryName } from '@/lib/utils';

const SOURCES = [
  { key: 'self', label: 'Self-declared' },
  { key: 'survey', label: 'Survey' },
  { key: 'panel', label: 'Panel (GA4)' },
] as const;

type SourceKey = (typeof SOURCES)[number]['key'];

function orderAge(report: DemographicReport) {
  const byBucket = new Map(report.buckets.map((bucket) => [bucket.bucket, bucket]));
  return AGE_BUCKETS.map((bucket) => ({
    label: bucket,
    value: byBucket.get(bucket)?.value ?? 0,
    share: byBucket.get(bucket)?.share ?? 0,
  }));
}

function orderGender(report: DemographicReport) {
  return report.buckets
    .map((bucket) => ({
      label: GENDER_LABELS[bucket.bucket] ?? bucket.bucket,
      value: bucket.value,
      share: bucket.share,
    }))
    .sort((a, b) => b.value - a.value);
}

export function DemographicsClient({
  age,
  gender,
  survey,
  panel,
  categories,
  countries,
  filters,
}: {
  age: DemographicReport;
  gender: DemographicReport;
  survey: { age: DemographicReport; gender: DemographicReport };
  panel: { age: DemographicReport; gender: DemographicReport };
  categories: { id: string; name: string }[];
  countries: string[];
  filters: { categoryId: string; country: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [source, setSource] = React.useState<SourceKey>('self');
  const [pending, startTransition] = React.useTransition();

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  };

  const ageReport = source === 'self' ? age : source === 'survey' ? survey.age : panel.age;
  const genderReport = source === 'self' ? gender : source === 'survey' ? survey.gender : panel.gender;

  const ageRows = orderAge(ageReport);
  const genderRows = orderGender(genderReport);

  const isPanel = source === 'panel';
  const valueLabel = isPanel ? 'share of panel (%)' : source === 'survey' ? 'responses' : 'page views';

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Where these numbers come from</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
          Age and gender are not carried by web traffic. HTTP requests contain no such field, and
          inferring them from browsing behaviour is unreliable and, in the UK and EU, regulated
          profiling. There are exactly three legitimate sources, and this screen keeps them
          separate rather than blending them into one confident-looking number.
        </p>

        <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label="Demographic source">
          {SOURCES.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSource(option.key)}
              aria-pressed={source === option.key}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                source === option.key
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-muted hover:text-fg',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cross-tabs only make sense for data we hold per-visit. */}
      <div className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-4">
        <div className="min-w-40">
          <label htmlFor="demo-category" className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Cross-tabulate by category
          </label>
          <Select
            id="demo-category"
            value={filters.categoryId}
            disabled={isPanel}
            onChange={(e) => setFilter('categoryId', e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </Select>
        </div>

        <div className="min-w-40">
          <label htmlFor="demo-country" className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Country
          </label>
          <Select
            id="demo-country"
            value={filters.country}
            disabled={isPanel}
            onChange={(e) => setFilter('country', e.target.value)}
          >
            <option value="">All countries</option>
            {countries.map((code) => (
              <option key={code} value={code}>{countryName(code)}</option>
            ))}
          </Select>
        </div>

        {pending ? (
          <span className="flex items-center gap-1.5 pb-2 text-xs text-muted">
            <Loader2 className="size-3.5 animate-spin" aria-hidden /> Recalculating…
          </span>
        ) : null}

        {isPanel ? (
          <p className="pb-2 text-xs text-warning">
            Panel data is modelled at the audience level and cannot be filtered by your own
            dimensions.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartFrame
          title="Age distribution"
          description={`Ordered bands — the ramp runs light to dark with age. Values are ${valueLabel}.`}
          csvName="volt-analytics-age"
          columns={[
            { key: 'label', label: 'Age band' },
            { key: 'value', label: isPanel ? 'Share %' : 'Count', align: 'right' },
            { key: 'share', label: 'Share', align: 'right' },
          ]}
          rows={ageRows.map((row) => ({
            label: row.label,
            value: row.value,
            share: `${(row.share * 100).toFixed(1)}%`,
          }))}
          note={
            <CoverageBadge
              source={ageReport.source}
              known={ageReport.known}
              total={ageReport.total}
              sampleSize={ageReport.sampleSize}
              marginOfError={ageReport.marginOfError}
            />
          }
        >
          <BarList
            data={ageRows}
            ordinal
            formatValue={(n) => (isPanel ? `${n.toFixed(1)}%` : compactNumber(n))}
            emptyLabel="Nobody in this segment has told us their age."
          />
        </ChartFrame>

        <ChartFrame
          title="Gender"
          description={`Self-reported categories, including a decline-to-answer option. Values are ${valueLabel}.`}
          csvName="volt-analytics-gender"
          columns={[
            { key: 'label', label: 'Gender' },
            { key: 'value', label: isPanel ? 'Share %' : 'Count', align: 'right' },
            { key: 'share', label: 'Share', align: 'right' },
          ]}
          rows={genderRows.map((row) => ({
            label: row.label,
            value: row.value,
            share: `${(row.share * 100).toFixed(1)}%`,
          }))}
          note={
            <CoverageBadge
              source={genderReport.source}
              known={genderReport.known}
              total={genderReport.total}
              sampleSize={genderReport.sampleSize}
              marginOfError={genderReport.marginOfError}
            />
          }
        >
          {genderRows.length ? (
            <DonutChart data={genderRows} centreLabel={isPanel ? 'panel %' : valueLabel} />
          ) : (
            <p className="py-8 text-center text-sm text-muted">
              No gender data for this segment.
            </p>
          )}
        </ChartFrame>
      </div>

      <div className="rounded-card border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">How to raise coverage</h2>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted">
          <li>
            <strong className="text-fg">Ask more readers.</strong> The registration and account
            forms carry the optional fields today. Coverage is a function of how many people have
            accounts and how many of those answered.
          </li>
          <li>
            <strong className="text-fg">Run a poll.</strong> A one-question site poll reaches
            logged-out readers and is reported here as a projection with its margin of error.
          </li>
          <li>
            <strong className="text-fg">Buy panel data.</strong> GA4 Demographics or a provider
            like Comscore gives audience-level shares. Useful for a sense-check, useless for
            cross-tabs, and never per-visitor.
          </li>
        </ul>
      </div>
    </div>
  );
}
