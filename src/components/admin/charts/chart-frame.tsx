'use client';

import { Download, Table2 } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/** Fixed categorical order. Slots are assigned in sequence and never cycled. */
export const SERIES = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
] as const;

/** Sequential ramp for magnitude (choropleth, ordinal age bands). */
export const SEQUENTIAL = [
  'var(--seq-1)',
  'var(--seq-2)',
  'var(--seq-3)',
  'var(--seq-4)',
  'var(--seq-5)',
] as const;

export const CHART_PRIMARY = 'var(--chart-primary)';
export const CHART_COMPARE = 'var(--chart-compare)';

export type TableColumn = { key: string; label: string; align?: 'left' | 'right' };

export function downloadCsv(filename: string, columns: TableColumn[], rows: Record<string, unknown>[]) {
  const escape = (value: unknown) => {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [
    columns.map((c) => escape(c.label)).join(','),
    ...rows.map((row) => columns.map((c) => escape(row[c.key])).join(',')),
  ].join('\n');

  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Standard wrapper for every chart: title, optional note, a table view so the
 * numbers are never colour-only, and CSV export.
 */
export function ChartFrame({
  title,
  description,
  note,
  columns,
  rows,
  csvName,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  note?: React.ReactNode;
  columns?: TableColumn[];
  rows?: Record<string, unknown>[];
  csvName?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = React.useState(false);
  const hasTable = Boolean(columns?.length && rows);

  return (
    <section className={cn('rounded-card border border-border bg-surface', className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          {hasTable ? (
            <>
              <button
                type="button"
                onClick={() => setShowTable((v) => !v)}
                aria-pressed={showTable}
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted transition-colors hover:border-accent hover:text-accent"
              >
                <Table2 className="size-3" aria-hidden />
                {showTable ? 'Chart' : 'Table'}
              </button>
              <button
                type="button"
                onClick={() => downloadCsv(csvName ?? title.toLowerCase().replace(/\s+/g, '-'), columns!, rows!)}
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted transition-colors hover:border-accent hover:text-accent"
              >
                <Download className="size-3" aria-hidden />
                CSV
              </button>
            </>
          ) : null}
        </div>
      </header>

      <div className="p-4">
        {showTable && hasTable ? (
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border text-left">
                  {columns!.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={cn(
                        'py-2 pr-3 text-xs font-medium uppercase tracking-wide text-muted',
                        column.align === 'right' && 'text-right',
                      )}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows!.map((row, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    {columns!.map((column) => (
                      <td
                        key={column.key}
                        className={cn('py-1.5 pr-3', column.align === 'right' && 'text-right tabular-nums')}
                      >
                        {String(row[column.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
        {/* A div, not a p: callers pass rich notes (the coverage badge is a
            block element), and a div inside a p is invalid HTML that React
            recovers from by throwing away the server render. */}
        {note ? <div className="mt-3 text-xs leading-relaxed text-muted">{note}</div> : null}
      </div>
    </section>
  );
}

/** Legend swatches. Present whenever there are two or more series. */
export function Legend({
  items,
  className,
}: {
  items: { label: string; colour: string; dashed?: boolean }[];
  className?: string;
}) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-muted">
          <span
            aria-hidden
            className="inline-block h-0.5 w-4 rounded-full"
            style={
              item.dashed
                ? {
                    backgroundImage: `repeating-linear-gradient(90deg, ${item.colour} 0 4px, transparent 4px 7px)`,
                  }
                : { background: item.colour }
            }
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
