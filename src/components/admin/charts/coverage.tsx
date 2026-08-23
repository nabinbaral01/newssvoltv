import { AlertTriangle, Info } from 'lucide-react';

import { cn, percent } from '@/lib/utils';

const SOURCE_COPY = {
  SELF_DECLARED: {
    label: 'Self-declared',
    detail: 'From the optional birth year and gender fields on reader accounts.',
    tone: 'success' as const,
  },
  SURVEY: {
    label: 'Survey',
    detail: 'Projected from an on-site poll. A sample, with a margin of error.',
    tone: 'warning' as const,
  },
  PANEL: {
    label: 'Third-party panel',
    detail: 'Modelled and sampled by the provider. Never per-visitor.',
    tone: 'volt' as const,
  },
};

export type DemographicSourceKey = keyof typeof SOURCE_COPY;

/**
 * The component that keeps the demographics screen honest.
 *
 * Age and gender are not observable from web traffic. Every figure on this
 * screen therefore travels with (a) which of the three legitimate sources it
 * came from and (b) how much of the audience it actually covers. A 7% sample
 * must never be able to look like a census.
 */
export function CoverageBadge({
  source,
  known,
  total,
  sampleSize,
  marginOfError,
  className,
}: {
  source: DemographicSourceKey;
  known: number;
  total: number;
  sampleSize?: number;
  marginOfError?: number;
  className?: string;
}) {
  const copy = SOURCE_COPY[source];
  const coverage = total ? known / total : 0;
  const thin = source === 'SELF_DECLARED' && coverage < 0.25;

  return (
    <div
      className={cn(
        'rounded-card border p-3 text-xs leading-relaxed',
        thin ? 'border-warning/40 bg-warning/10' : 'border-border bg-elevated',
        className,
      )}
    >
      <p className="flex flex-wrap items-center gap-1.5 font-medium">
        {thin ? (
          <AlertTriangle className="size-3.5 shrink-0 text-warning" aria-hidden />
        ) : (
          <Info className="size-3.5 shrink-0 text-muted" aria-hidden />
        )}
        <span>Source: {copy.label}</span>
        {source === 'PANEL' ? null : (
          <>
            <span aria-hidden className="text-muted">·</span>
            <span className={thin ? 'text-warning' : 'text-fg'}>
              covers {percent(known, total)} of traffic
            </span>
          </>
        )}
      </p>

      <p className="mt-1 text-muted">{copy.detail}</p>

      {source === 'SELF_DECLARED' ? (
        <p className="mt-1 text-muted">
          {known.toLocaleString()} of {total.toLocaleString()} page views in this period came from a
          signed-in reader who answered.{' '}
          {thin ? (
            <strong className="text-warning">
              Treat the shape as indicative, not as the audience.
            </strong>
          ) : null}
        </p>
      ) : null}

      {source === 'SURVEY' && sampleSize ? (
        <p className="mt-1 text-muted">
          {sampleSize.toLocaleString()} responses
          {marginOfError ? ` · ±${(marginOfError * 100).toFixed(1)} points at 95% confidence` : ''}.
        </p>
      ) : null}

      {source === 'PANEL' ? (
        <p className="mt-1 text-muted">
          Shares are modelled by the provider from their signed-in panel and projected to the whole
          internet. They are not measurements of <em>this</em> audience and cannot be cross-tabbed
          against your own dimensions.
        </p>
      ) : null}
    </div>
  );
}

/** Inline coverage chip for placing next to an individual figure. */
export function CoverageChip({ known, total }: { known: number; total: number }) {
  const coverage = total ? known / total : 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
        coverage < 0.25
          ? 'border-warning/40 bg-warning/10 text-warning'
          : 'border-border bg-elevated text-muted',
      )}
      title={`${known.toLocaleString()} of ${total.toLocaleString()} page views have this attribute`}
    >
      {percent(known, total)} coverage
    </span>
  );
}
