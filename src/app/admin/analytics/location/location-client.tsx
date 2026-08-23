'use client';

import { ChevronRight, Loader2 } from 'lucide-react';
import * as React from 'react';

import { Choropleth } from '@/components/admin/charts/choropleth';
import { ChartFrame } from '@/components/admin/charts/chart-frame';
import { SplitBar } from '@/components/admin/charts/basic-charts';
import { compactNumber, countryName, flagFor, formatDuration } from '@/lib/utils';

export type CountryRow = {
  code: string;
  pageViews: number;
  visitors: number;
  sessions: number;
  bounceRate: number;
  avgDurationSeconds: number;
  share: number;
};

export type CityRow = {
  city: string;
  pageViews: number;
  visitors: number;
  sessions: number;
  bounceRate: number;
  avgDurationSeconds: number;
};

export function LocationClient({
  countries,
  newVsReturning,
  rangeQuery,
}: {
  countries: CountryRow[];
  newVsReturning: { new: number; returning: number; sessions: number };
  rangeQuery: string;
}) {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [cities, setCities] = React.useState<CityRow[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!selected) {
      // Clearing the drill-down when the selection is dropped: a sync with the
      // map, which is the external system this effect exists to follow.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCities(null);
      return;
    }
    let cancelled = false;
    // Fetch-on-select: the spinner has to go up before the request goes out.
    setLoading(true);
    fetch(`/api/admin/analytics/cities?country=${selected}&${rangeQuery}`)
      .then((res) => (res.ok ? res.json() : { cities: [] }))
      .then((data) => {
        if (!cancelled) setCities(data.cities ?? []);
      })
      .catch(() => !cancelled && setCities([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selected, rangeQuery]);

  const tableRows = countries.map((row) => ({
    country: countryName(row.code),
    code: row.code,
    pageViews: row.pageViews,
    visitors: row.visitors,
    sessions: row.sessions,
    bounceRate: `${(row.bounceRate * 100).toFixed(1)}%`,
    avgTime: formatDuration(row.avgDurationSeconds),
    share: `${(row.share * 100).toFixed(1)}%`,
  }));

  return (
    <div className="space-y-4">
      <ChartFrame
        title="Where readers are"
        description="Derived from the request IP at the edge. The IP itself is hashed and never stored."
        csvName="volt-analytics-location"
        columns={[
          { key: 'country', label: 'Country' },
          { key: 'code', label: 'Code' },
          { key: 'pageViews', label: 'Page views', align: 'right' },
          { key: 'visitors', label: 'Visitors', align: 'right' },
          { key: 'sessions', label: 'Sessions', align: 'right' },
          { key: 'bounceRate', label: 'Bounce rate', align: 'right' },
          { key: 'avgTime', label: 'Avg. time', align: 'right' },
        ]}
        rows={tableRows}
        note="Click a country to drill into its cities."
      >
        <Choropleth
          data={countries.map((row) => ({ code: row.code, value: row.pageViews }))}
          selected={selected}
          onSelect={setSelected}
        />
      </ChartFrame>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="rounded-card border border-border bg-surface">
            <div className="border-b border-border p-4">
              <h2 className="text-sm font-semibold">Countries</h2>
              <p className="mt-0.5 text-xs text-muted">
                {selected
                  ? `Showing cities in ${countryName(selected)} — click the row again to go back.`
                  : 'Click a row to drill into cities.'}
              </p>
            </div>

            <div className="max-h-[30rem] overflow-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th scope="col" className="p-3 font-medium">Country</th>
                    <th scope="col" className="p-3 text-right font-medium">Visitors</th>
                    <th scope="col" className="p-3 text-right font-medium">Views</th>
                    <th scope="col" className="p-3 text-right font-medium">Avg. time</th>
                    <th scope="col" className="p-3 text-right font-medium">Bounce</th>
                    <th scope="col" className="p-3 text-right font-medium">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {countries.map((row) => (
                    <React.Fragment key={row.code}>
                      <tr
                        className={
                          selected === row.code
                            ? 'border-b border-border bg-elevated'
                            : 'border-b border-border/60 hover:bg-elevated/50'
                        }
                      >
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => setSelected(selected === row.code ? null : row.code)}
                            className="flex items-center gap-2 text-left hover:text-accent"
                            aria-expanded={selected === row.code}
                          >
                            <ChevronRight
                              className={`size-3.5 shrink-0 transition-transform ${selected === row.code ? 'rotate-90' : ''}`}
                              aria-hidden
                            />
                            <span aria-hidden>{flagFor(row.code)}</span>
                            {countryName(row.code)}
                          </button>
                        </td>
                        <td className="p-3 text-right tabular-nums">{compactNumber(row.visitors)}</td>
                        <td className="p-3 text-right tabular-nums">{compactNumber(row.pageViews)}</td>
                        <td className="p-3 text-right tabular-nums text-muted">
                          {formatDuration(row.avgDurationSeconds)}
                        </td>
                        <td className="p-3 text-right tabular-nums text-muted">
                          {(row.bounceRate * 100).toFixed(1)}%
                        </td>
                        <td className="p-3 text-right tabular-nums text-muted">
                          {(row.share * 100).toFixed(1)}%
                        </td>
                      </tr>

                      {selected === row.code ? (
                        <tr className="border-b border-border">
                          <td colSpan={6} className="bg-bg/40 p-0">
                            {loading ? (
                              <p className="flex items-center justify-center gap-2 p-4 text-xs text-muted">
                                <Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading cities…
                              </p>
                            ) : cities?.length ? (
                              <table className="w-full text-xs">
                                <caption className="sr-only">Cities in {countryName(row.code)}</caption>
                                <tbody>
                                  {cities.map((city) => (
                                    <tr key={city.city} className="border-b border-border/40 last:border-0">
                                      <td className="py-2 pl-10 pr-3">{city.city}</td>
                                      <td className="p-2 text-right tabular-nums">{compactNumber(city.visitors)}</td>
                                      <td className="p-2 text-right tabular-nums">{compactNumber(city.pageViews)}</td>
                                      <td className="p-2 text-right tabular-nums text-muted">
                                        {formatDuration(city.avgDurationSeconds)}
                                      </td>
                                      <td className="p-2 text-right tabular-nums text-muted">
                                        {(city.bounceRate * 100).toFixed(1)}%
                                      </td>
                                      <td className="p-2" />
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p className="p-4 text-xs text-muted">
                                No city-level data for this country in the selected period.
                              </p>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <ChartFrame title="New vs returning" description="Across all locations">
          <SplitBar
            parts={[
              { label: 'New', value: newVsReturning.new },
              { label: 'Returning', value: newVsReturning.returning },
            ]}
          />
          <p className="mt-3 text-xs text-muted">
            {newVsReturning.sessions.toLocaleString()} sessions in the selected period.
          </p>
        </ChartFrame>
      </div>
    </div>
  );
}
