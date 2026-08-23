'use client';

import * as React from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { BarList } from '@/components/admin/charts/basic-charts';
import { CHART_PRIMARY, ChartFrame, downloadCsv } from '@/components/admin/charts/chart-frame';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Badge, Card, CardHeader } from '@/components/ui/surface';
import { formatDate } from '@/lib/utils';

type Subscriber = {
  id: string;
  email: string;
  confirmed: boolean;
  source: string;
  createdAt: string;
  confirmedAt: string | null;
};

export function NewsletterClient({
  subscribers,
  growth,
  sources,
}: {
  subscribers: Subscriber[];
  growth: { day: string; signups: number; confirmed: number }[];
  sources: { label: string; value: number }[];
}) {
  const [query, setQuery] = React.useState('');

  const filtered = subscribers.filter((row) =>
    row.email.toLowerCase().includes(query.toLowerCase()),
  );

  // Cumulative, because a subscriber list is a running total, not a daily flow.
  const cumulative = React.useMemo(
    () =>
      growth.reduce<{ day: string; total: number; signups: number }[]>((rows, point) => {
        const previous = rows[rows.length - 1]?.total ?? 0;
        rows.push({ day: point.day, total: previous + point.signups, signups: point.signups });
        return rows;
      }, []),
    [growth],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartFrame
            title="List growth"
            description="Cumulative subscribers over the last 90 days"
            csvName="volt-newsletter-growth"
            columns={[
              { key: 'day', label: 'Day' },
              { key: 'signups', label: 'New', align: 'right' },
              { key: 'total', label: 'Running total', align: 'right' },
            ]}
            rows={cumulative}
          >
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={cumulative} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <defs>
                  <linearGradient id="subsArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_PRIMARY} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART_PRIMARY} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="2 4" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--chart-grid)' }}
                  minTickGap={30}
                  tickFormatter={(value: string) => formatDate(value, { day: 'numeric', month: 'short', year: undefined })}
                />
                <YAxis
                  tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={46}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  labelFormatter={(value) => formatDate(String(value))}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Subscribers"
                  stroke={CHART_PRIMARY}
                  strokeWidth={2}
                  fill="url(#subsArea)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartFrame>
        </div>

        <ChartFrame
          title="Where they signed up"
          csvName="volt-newsletter-sources"
          columns={[
            { key: 'label', label: 'Source' },
            { key: 'value', label: 'Subscribers', align: 'right' },
          ]}
          rows={sources}
        >
          <BarList data={sources} />
        </ChartFrame>
      </div>

      <Card>
        <CardHeader
          title="Subscribers"
          description={`${filtered.length} shown of ${subscribers.length} most recent`}
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadCsv(
                  'volt-subscribers',
                  [
                    { key: 'email', label: 'Email' },
                    { key: 'confirmed', label: 'Confirmed' },
                    { key: 'source', label: 'Source' },
                    { key: 'createdAt', label: 'Signed up' },
                    { key: 'confirmedAt', label: 'Confirmed at' },
                  ],
                  filtered.map((row) => ({
                    email: row.email,
                    confirmed: row.confirmed ? 'yes' : 'no',
                    source: row.source,
                    createdAt: row.createdAt,
                    confirmedAt: row.confirmedAt ?? '',
                  })),
                )
              }
            >
              Export CSV
            </Button>
          }
        />

        <div className="p-3">
          <label className="sr-only" htmlFor="subscriber-search">Search subscribers</label>
          <Input
            id="subscriber-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search email addresses…"
          />
        </div>

        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="p-3 font-medium">Email</th>
                <th scope="col" className="p-3 font-medium">Status</th>
                <th scope="col" className="p-3 font-medium">Source</th>
                <th scope="col" className="p-3 font-medium">Signed up</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-border/60 last:border-0">
                  <td className="p-3 font-mono text-xs">{row.email}</td>
                  <td className="p-3">
                    {row.confirmed ? (
                      <Badge tone="success">confirmed</Badge>
                    ) : (
                      <Badge tone="warning">unconfirmed</Badge>
                    )}
                  </td>
                  <td className="p-3 text-xs text-muted">{row.source}</td>
                  <td className="p-3 text-xs text-muted">{formatDate(row.createdAt)}</td>
                </tr>
              ))}
              {!filtered.length ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted">No matching subscribers.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
