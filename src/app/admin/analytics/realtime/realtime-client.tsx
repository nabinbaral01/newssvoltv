'use client';

import { Monitor, Smartphone, Tablet } from 'lucide-react';
import * as React from 'react';

import { ChartFrame } from '@/components/admin/charts/chart-frame';
import { Card, CardHeader } from '@/components/ui/surface';
import { compactNumber, countryName, flagFor, relativeTime } from '@/lib/utils';

type Snapshot = {
  activeVisitors: number;
  topPaths: { path: string; views: number }[];
  topCountries: { country: string; views: number }[];
  recent: {
    path: string;
    title: string;
    country: string | null;
    city: string | null;
    deviceType: string;
    at: string;
  }[];
};

const DEVICE_ICON: Record<string, React.ElementType> = {
  MOBILE: Smartphone,
  TABLET: Tablet,
  DESKTOP: Monitor,
};

const POLL_MS = 10_000;

export function RealtimeClient({ initial }: { initial: Snapshot }) {
  const [data, setData] = React.useState(initial);
  const [history, setHistory] = React.useState<number[]>([initial.activeVisitors]);
  const [stale, setStale] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch('/api/admin/realtime', { cache: 'no-store' });
        if (!res.ok) throw new Error('poll failed');
        const next = (await res.json()) as Snapshot;
        if (cancelled) return;
        setData(next);
        setStale(false);
        setHistory((values) => [...values, next.activeVisitors].slice(-30));
      } catch {
        // Say so rather than showing a frozen number as if it were live.
        if (!cancelled) setStale(true);
      }
    };

    const timer = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const max = Math.max(...history, 1);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
            <span className="relative flex size-2">
              <span
                className={`absolute inline-flex size-full rounded-full opacity-75 ${stale ? 'bg-warning' : 'animate-ping bg-success'}`}
              />
              <span className={`relative inline-flex size-2 rounded-full ${stale ? 'bg-warning' : 'bg-success'}`} />
            </span>
            Active right now
          </p>
          <p className="mt-2 text-5xl font-semibold tabular-nums">
            {compactNumber(data.activeVisitors)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {stale
              ? 'Connection interrupted — showing the last successful reading.'
              : `Distinct visitors in the last 5 minutes · refreshes every ${POLL_MS / 1000}s`}
          </p>

          {history.length > 1 ? (
            <div className="mt-4 flex h-12 items-end gap-0.5" aria-hidden>
              {history.map((value, index) => (
                <span
                  key={index}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${Math.max(4, (value / max) * 100)}%`,
                    background: 'var(--chart-primary)',
                    opacity: 0.35 + (index / history.length) * 0.65,
                  }}
                />
              ))}
            </div>
          ) : null}
          <p className="mt-1 text-[11px] text-muted">
            {history.length > 1 ? `Last ${history.length} readings` : 'Building history…'}
          </p>
        </Card>

        <ChartFrame title="What they are reading" className="lg:col-span-2">
          <ul className="space-y-2">
            {data.topPaths.map((row) => (
              <li key={row.path} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{row.path}</span>
                <span className="tabular-nums">{row.views}</span>
              </li>
            ))}
            {!data.topPaths.length ? (
              <li className="py-6 text-center text-sm text-muted">Nobody on the site right now.</li>
            ) : null}
          </ul>
        </ChartFrame>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Where they are" description="Last 5 minutes" />
          <ul className="divide-y divide-border">
            {data.topCountries.map((row) => (
              <li key={row.country} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span aria-hidden>{flagFor(row.country)}</span>
                <span className="min-w-0 flex-1 truncate">{countryName(row.country)}</span>
                <span className="tabular-nums text-muted">{row.views}</span>
              </li>
            ))}
            {!data.topCountries.length ? (
              <li className="p-6 text-center text-sm text-muted">No location data yet.</li>
            ) : null}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Live feed" description="Most recent page views" />
          <ul className="divide-y divide-border">
            {data.recent.map((row, index) => {
              const Icon = DEVICE_ICON[row.deviceType] ?? Monitor;
              return (
                <li key={`${row.path}-${index}`} className="flex items-center gap-3 px-4 py-2.5">
                  <Icon className="size-3.5 shrink-0 text-muted" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{row.title}</p>
                    <p className="truncate text-[11px] text-muted">
                      {row.city ? `${row.city}, ` : ''}
                      {row.country ? countryName(row.country) : 'unknown location'}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted">{relativeTime(row.at)}</span>
                </li>
              );
            })}
            {!data.recent.length ? (
              <li className="p-6 text-center text-sm text-muted">Quiet right now.</li>
            ) : null}
          </ul>
        </Card>
      </div>
    </div>
  );
}
