import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-card border border-border bg-surface', className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-border p-4', className)}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-elevated text-muted',
        accent: 'border-accent/40 bg-accent/10 text-accent',
        volt: 'border-volt/40 bg-volt/10 text-volt',
        success: 'border-success/40 bg-success/10 text-success',
        warning: 'border-warning/40 bg-warning/10 text-warning',
        danger: 'border-danger/40 bg-danger/10 text-danger',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

const STATUS_TONE = {
  DRAFT: 'neutral',
  IN_REVIEW: 'warning',
  SCHEDULED: 'volt',
  PUBLISHED: 'success',
  ARCHIVED: 'neutral',
  PENDING: 'warning',
  APPROVED: 'success',
  SPAM: 'danger',
} as const;

/** Status pill used in every admin table — colour plus the word, never colour alone. */
export function StatusPill({ status }: { status: keyof typeof STATUS_TONE }) {
  return (
    <Badge tone={STATUS_TONE[status]}>
      <span
        aria-hidden
        className="size-1.5 rounded-full bg-current"
      />
      {status.replace('_', ' ').toLowerCase()}
    </Badge>
  );
}

export function Separator({ className }: { className?: string }) {
  return <hr className={cn('border-t border-border', className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-elevated', className)} />;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border px-6 py-14 text-center">
      {icon ? <div className="text-muted">{icon}</div> : null}
      <p className="font-medium">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

/** Section rule used across the public site: label left, "see more" right. */
export function SectionHeading({
  title,
  href,
  colour,
  moreLabel = 'See more',
}: {
  title: string;
  href?: string;
  colour?: string;
  moreLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 border-b-2 pb-2" style={{ borderColor: colour ?? 'var(--accent)' }}>
      <h2 className="headline text-2xl uppercase tracking-tight sm:text-3xl">{title}</h2>
      {href ? (
        <a
          href={href}
          className="shrink-0 text-xs font-semibold uppercase tracking-widest text-muted transition-colors hover:text-accent"
        >
          {moreLabel} →
        </a>
      ) : null}
    </div>
  );
}
