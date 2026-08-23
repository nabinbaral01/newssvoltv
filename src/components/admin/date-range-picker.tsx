'use client';

import { CalendarDays } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlay';
import { cn } from '@/lib/utils';

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
] as const;

/**
 * One picker, shared by every analytics view. State lives in the URL so a
 * dashboard link always carries its period with it.
 */
export function DateRangePicker({
  preset,
  from,
  to,
}: {
  preset: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [customFrom, setCustomFrom] = React.useState(from);
  const [customTo, setCustomTo] = React.useState(to);
  const [open, setOpen] = React.useState(false);

  const apply = (params: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(params)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    next.delete('page');
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      <div className="flex items-center rounded-md border border-border bg-surface p-0.5" role="group" aria-label="Date range">
        {PRESETS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => apply({ preset: option.key, from: null, to: null })}
            aria-pressed={preset === option.key}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              preset === option.key ? 'bg-elevated text-accent' : 'text-muted hover:text-fg',
            )}
          >
            {option.label}
          </button>
        ))}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-pressed={preset === 'custom'}
              className={cn(
                'flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                preset === 'custom' ? 'bg-elevated text-accent' : 'text-muted hover:text-fg',
              )}
            >
              <CalendarDays className="size-3.5" aria-hidden />
              Custom
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="range-from">From</Label>
                <Input
                  id="range-from"
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="range-to">To</Label>
                <Input
                  id="range-to"
                  type="date"
                  value={customTo}
                  min={customFrom}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={() => {
                  setOpen(false);
                  apply({ preset: 'custom', from: customFrom, to: customTo });
                }}
              >
                Apply range
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
