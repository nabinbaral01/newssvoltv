'use client';

import * as React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { Legend, SEQUENTIAL, SERIES } from './chart-frame';
import { cn, compactNumber } from '@/lib/utils';

export type Slice = { label: string; value: number; share?: number };

function DonutTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: { payload?: Slice & { fill?: string } }[];
  total: number;
}) {
  const slice = payload?.[0]?.payload;
  if (!active || !slice) return null;
  return (
    <div className="rounded-card border border-border bg-elevated px-3 py-2 text-xs shadow-xl">
      <p className="flex items-center gap-2 font-medium text-fg">
        <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: slice.fill }} />
        {slice.label}
      </p>
      <p className="mt-0.5 tabular-nums text-muted">
        {compactNumber(slice.value)} · {total ? ((slice.value / total) * 100).toFixed(1) : '0'}%
      </p>
    </div>
  );
}

/**
 * Donut for a small set of parts of a whole (traffic sources, gender).
 * Above six slices this becomes a bar chart instead — a donut cannot carry
 * more categories than the palette has fixed slots.
 */
export function DonutChart({
  data,
  height = 220,
  centreLabel,
}: {
  data: Slice[];
  height?: number;
  centreLabel?: string;
}) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  const slices = data.slice(0, SERIES.length).filter((slice) => slice.value > 0);

  if (!total || !slices.length) {
    return <p className="py-8 text-center text-sm text-muted">No data in this period</p>;
  }

  /*
   * One category is not a part-to-whole. A ring at 100% carries no comparison,
   * and drawing it as an arc leaves a seam where the ends meet that reads as a
   * missing slice — the chart implies a second category that does not exist.
   * The number is the chart here.
   */
  if (slices.length === 1) {
    const only = slices[0];
    return (
      <div className="flex flex-col items-center gap-1 py-6 text-center">
        <p className="text-4xl font-semibold tabular-nums">{compactNumber(only.value)}</p>
        <p className="text-sm text-muted">
          {centreLabel ?? 'total'} — all {only.label.toLowerCase()}
        </p>
        <p className="mt-1 text-xs text-muted">
          Only one category has answered, so there is nothing to compare yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative w-full max-w-56 shrink-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="94%"
              paddingAngle={2}
              stroke="var(--chart-surface)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {slices.map((slice, index) => (
                <Cell key={slice.label} fill={SERIES[index]} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-xl font-semibold tabular-nums">{compactNumber(total)}</p>
            {centreLabel ? <p className="text-[11px] text-muted">{centreLabel}</p> : null}
          </div>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {slices.map((slice, index) => (
          <li key={slice.label} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: SERIES[index] }}
            />
            <span className="min-w-0 flex-1 truncate text-muted">{slice.label}</span>
            <span className="tabular-nums">{compactNumber(slice.value)}</span>
            <span className="w-12 text-right tabular-nums text-muted">
              {total ? ((slice.value / total) * 100).toFixed(1) : '0.0'}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Horizontal bars. `ordinal` uses the sequential ramp because the categories
 * have an inherent order (age bands); nominal categories all take slot 1, since
 * bar length already encodes the value.
 */
export function BarList({
  data,
  ordinal,
  formatValue = compactNumber,
  emptyLabel = 'No data in this period',
  className,
}: {
  data: Slice[];
  ordinal?: boolean;
  formatValue?: (n: number) => string;
  emptyLabel?: string;
  className?: string;
}) {
  const total = data.reduce((sum, row) => sum + row.value, 0);

  // Seven bands all reading 0 is not a distribution, it is the absence of one.
  // Listing them anyway invites the reader to compare bars that mean nothing.
  if (!data.length || total === 0) {
    return <p className={cn('py-6 text-center text-sm text-muted', className)}>{emptyLabel}</p>;
  }

  const max = Math.max(...data.map((row) => row.value), 1);

  return (
    <ul className={cn('space-y-2.5', className)}>
      {data.map((row, index) => {
        const colour = ordinal
          ? SEQUENTIAL[Math.min(SEQUENTIAL.length - 1, Math.floor((index / Math.max(1, data.length - 1)) * (SEQUENTIAL.length - 1)))]
          : SERIES[0];
        return (
          <li key={row.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{row.label}</span>
              <span className="shrink-0 tabular-nums text-muted">
                {formatValue(row.value)}
                <span className="ml-2 text-xs">
                  {total ? (((row.share ?? row.value / total) * 100) || 0).toFixed(1) : '0.0'}%
                </span>
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-elevated">
              {/* A zero draws nothing. The old floor of 1.5% gave every empty
                  band a visible stub, so a category with no data looked like a
                  category with a little — the one thing a bar must never do. */}
              {row.value > 0 ? (
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(1.5, (row.value / max) * 100)}%`,
                    background: colour,
                  }}
                  role="presentation"
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Stacked single bar — used for new vs returning. Two series, both labelled. */
export function SplitBar({ parts }: { parts: { label: string; value: number }[] }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0) || 1;

  return (
    <div>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {parts.map((part, index) => (
          <div
            key={part.label}
            style={{ width: `${(part.value / total) * 100}%`, background: SERIES[index] }}
            role="presentation"
          />
        ))}
      </div>
      <Legend
        className="mt-3"
        items={parts.map((part, index) => ({
          label: `${part.label} — ${((part.value / total) * 100).toFixed(1)}%`,
          colour: SERIES[index],
        }))}
      />
    </div>
  );
}
