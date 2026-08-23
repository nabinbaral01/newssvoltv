import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';

import { Sparkline } from '@/components/admin/charts/time-series';
import { cn } from '@/lib/utils';

/**
 * KPI tile: the number, its movement against the previous period, and a
 * sparkline for shape. `invert` marks metrics where down is good (bounce rate),
 * so the arrow and the tone stay meaningful rather than mechanical.
 */
export function StatTile({
  label,
  value,
  previous,
  current,
  spark,
  invert,
  hint,
}: {
  label: string;
  value: string;
  current?: number;
  previous?: number;
  spark?: number[];
  invert?: boolean;
  hint?: string;
}) {
  const hasDelta =
    current != null && previous != null && Number.isFinite(current) && Number.isFinite(previous);
  const delta = hasDelta && previous !== 0 ? (current - previous) / Math.abs(previous) : null;
  const rising = delta != null && delta > 0.0005;
  const falling = delta != null && delta < -0.0005;
  const good = invert ? falling : rising;
  const bad = invert ? rising : falling;

  const Icon = rising ? ArrowUpRight : falling ? ArrowDownRight : ArrowRight;

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
        {spark?.length ? <Sparkline values={spark} className="h-7 w-20 shrink-0" /> : null}
      </div>

      {delta != null ? (
        <p
          className={cn(
            'mt-1.5 flex items-center gap-1 text-xs tabular-nums',
            good ? 'text-success' : bad ? 'text-danger' : 'text-muted',
          )}
        >
          <Icon className="size-3.5" aria-hidden />
          {`${delta > 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`}
          <span className="text-muted">vs previous period</span>
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-muted">{hint ?? 'No comparison available'}</p>
      )}
    </div>
  );
}
