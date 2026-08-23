'use client';

import * as React from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { CHART_COMPARE, CHART_PRIMARY, Legend } from './chart-frame';
import { compactNumber, formatDate, formatDuration } from '@/lib/utils';

export type MetricKey = 'pageViews' | 'visitors' | 'sessions' | 'bounceRate' | 'avgDurationSeconds';

export const METRICS: Record<MetricKey, { label: string; format: (n: number) => string }> = {
  pageViews: { label: 'Page views', format: compactNumber },
  visitors: { label: 'Visitors', format: compactNumber },
  sessions: { label: 'Sessions', format: compactNumber },
  bounceRate: { label: 'Bounce rate', format: (n) => `${(n * 100).toFixed(1)}%` },
  avgDurationSeconds: { label: 'Avg. time on page', format: (n) => formatDuration(n) },
};

type Point = { day: string } & Partial<Record<MetricKey, number>>;

function TooltipCard({
  active,
  payload,
  label,
  metric,
  comparing,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number }[];
  label?: string;
  metric: MetricKey;
  comparing: boolean;
}) {
  if (!active || !payload?.length) return null;
  const current = payload.find((p) => p.dataKey === 'current')?.value ?? 0;
  const previous = payload.find((p) => p.dataKey === 'previous')?.value;
  const format = METRICS[metric].format;

  return (
    <div className="rounded-card border border-border bg-elevated px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-fg">{label ? formatDate(label) : ''}</p>
      <p className="mt-1 flex items-center gap-2 text-fg">
        <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: CHART_PRIMARY }} />
        {METRICS[metric].label}: <span className="font-semibold tabular-nums">{format(current)}</span>
      </p>
      {comparing && previous != null ? (
        <p className="mt-0.5 flex items-center gap-2 text-muted">
          <span
            aria-hidden
            className="inline-block h-0.5 w-2.5"
            style={{ backgroundImage: `repeating-linear-gradient(90deg, ${CHART_COMPARE} 0 3px, transparent 3px 6px)` }}
          />
          Previous: <span className="tabular-nums">{format(previous)}</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * The traffic chart. One measure at a time on a single axis — a second y-scale
 * would let two unrelated series imply a relationship they do not have. The
 * period comparison is the same measure shifted, so it shares the axis legally.
 */
export function TimeSeriesChart({
  data,
  comparison,
  metric,
  onMetricChange,
  height = 280,
}: {
  data: Point[];
  comparison?: Point[];
  metric: MetricKey;
  onMetricChange?: (metric: MetricKey) => void;
  height?: number;
}) {
  const comparing = Boolean(comparison?.length);

  const merged = data.map((point, index) => ({
    day: point.day,
    current: point[metric] ?? 0,
    previous: comparing ? (comparison![index]?.[metric] ?? 0) : undefined,
  }));

  const format = METRICS[metric].format;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {onMetricChange ? (
          <div className="flex flex-wrap gap-1" role="group" aria-label="Metric">
            {(Object.keys(METRICS) as MetricKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onMetricChange(key)}
                aria-pressed={metric === key}
                className={
                  metric === key
                    ? 'rounded border border-accent bg-accent/10 px-2 py-1 text-[11px] font-medium text-accent'
                    : 'rounded border border-border px-2 py-1 text-[11px] text-muted hover:border-accent hover:text-accent'
                }
              >
                {METRICS[key].label}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        {comparing ? (
          <Legend
            items={[
              { label: 'Selected period', colour: CHART_PRIMARY },
              { label: 'Previous period', colour: CHART_COMPARE, dashed: true },
            ]}
          />
        ) : null}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={merged} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="voltArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_PRIMARY} stopOpacity={0.28} />
              <stop offset="100%" stopColor={CHART_PRIMARY} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--chart-grid)' }}
            minTickGap={28}
            tickFormatter={(value: string) => formatDate(value, { day: 'numeric', month: 'short', year: undefined })}
          />
          <YAxis
            tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(value: number) => format(value)}
          />
          <Tooltip
            cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1, strokeDasharray: '3 3' }}
            content={<TooltipCard metric={metric} comparing={comparing} />}
          />
          <Area
            type="monotone"
            dataKey="current"
            stroke="none"
            fill="url(#voltArea)"
            isAnimationActive={false}
          />
          {comparing ? (
            <Line
              type="monotone"
              dataKey="previous"
              stroke={CHART_COMPARE}
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
              name="Previous period"
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="current"
            stroke={CHART_PRIMARY}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--chart-surface)' }}
            isAnimationActive={false}
            name="Selected period"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Bare trend line for the KPI tiles. No axes, no tooltip — it is a texture. */
export function Sparkline({
  values,
  className,
  positive = true,
}: {
  values: number[];
  className?: string;
  positive?: boolean;
}) {
  if (values.length < 2) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 26 - ((value - min) / span) * 24;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label={`Trend: ${values.length} data points, ${positive ? 'latest ' : ''}${values[values.length - 1]}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke={CHART_PRIMARY}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
