'use client';

import * as React from 'react';

import { DonutChart, type Slice } from '@/components/admin/charts/basic-charts';
import { ChartFrame } from '@/components/admin/charts/chart-frame';
import { TimeSeriesChart, type MetricKey } from '@/components/admin/charts/time-series';
import type { SeriesPoint } from '@/lib/analytics-queries';
import { compactNumber, formatDuration } from '@/lib/utils';

/** Client island: the metric switch is local state, the data is server-fetched. */
export function TrafficChart({
  series,
  comparison,
  rangeLabel,
}: {
  series: SeriesPoint[];
  comparison: SeriesPoint[];
  rangeLabel: string;
}) {
  const [metric, setMetric] = React.useState<MetricKey>('pageViews');

  const rows = series.map((point) => ({
    day: point.day,
    pageViews: point.pageViews,
    visitors: point.visitors,
    sessions: point.sessions,
    bounceRate: `${(point.bounceRate * 100).toFixed(1)}%`,
    avgTime: formatDuration(point.avgDurationSeconds),
  }));

  return (
    <ChartFrame
      title="Traffic"
      description={`${rangeLabel}, compared with the preceding period of equal length`}
      csvName="volt-traffic"
      columns={[
        { key: 'day', label: 'Day' },
        { key: 'pageViews', label: 'Page views', align: 'right' },
        { key: 'visitors', label: 'Visitors', align: 'right' },
        { key: 'sessions', label: 'Sessions', align: 'right' },
        { key: 'bounceRate', label: 'Bounce rate', align: 'right' },
        { key: 'avgTime', label: 'Avg. time', align: 'right' },
      ]}
      rows={rows}
    >
      <TimeSeriesChart
        data={series}
        comparison={comparison}
        metric={metric}
        onMetricChange={setMetric}
      />
    </ChartFrame>
  );
}

export function SourceDonut({ slices }: { slices: Slice[] }) {
  return (
    <ChartFrame
      title="Traffic sources"
      description="Where sessions started"
      csvName="volt-traffic-sources"
      columns={[
        { key: 'label', label: 'Source' },
        { key: 'value', label: 'Sessions', align: 'right' },
      ]}
      rows={slices.map((s) => ({ label: s.label, value: s.value }))}
    >
      <DonutChart data={slices} centreLabel="sessions" />
    </ChartFrame>
  );
}

export function LiveCounter({ initial }: { initial: number }) {
  const [count, setCount] = React.useState(initial);
  const [pulse, setPulse] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch('/api/admin/realtime', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setCount(data.activeVisitors ?? 0);
        setPulse(true);
        window.setTimeout(() => setPulse(false), 600);
      } catch {
        /* transient failure: keep the last value rather than flashing zero */
      }
    };

    const timer = window.setInterval(tick, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
        <span className="relative flex size-2">
          <span
            className={`absolute inline-flex size-full rounded-full bg-success opacity-75 ${pulse ? 'animate-ping' : ''}`}
          />
          <span className="relative inline-flex size-2 rounded-full bg-success" />
        </span>
        Active right now
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{compactNumber(count)}</p>
      <p className="mt-1.5 text-xs text-muted">Readers in the last 5 minutes · refreshes every 10s</p>
    </div>
  );
}
