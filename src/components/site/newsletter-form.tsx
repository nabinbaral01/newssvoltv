'use client';

import { Check, Loader2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function NewsletterForm({
  source = 'footer',
  className,
  compact,
}: {
  source?: string;
  className?: string;
  compact?: boolean;
}) {
  const [state, setState] = React.useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [message, setMessage] = React.useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');
    setState('busy');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
      setState('done');
      setMessage(data.message ?? 'Check your inbox to confirm.');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Something went wrong');
    }
  }

  if (state === 'done') {
    return (
      <p className={cn('flex items-center gap-2 text-sm text-success', className)} role="status">
        <Check className="size-4" aria-hidden /> {message}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className={cn('space-y-2', className)}>
      <div className={cn('flex gap-2', compact ? 'flex-col sm:flex-row' : 'flex-col sm:flex-row')}>
        <label className="sr-only" htmlFor={`newsletter-${source}`}>
          Email address
        </label>
        <input
          id={`newsletter-${source}`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="h-10 flex-1 rounded-md border border-border bg-elevated px-3 text-sm outline-none transition-colors focus:border-accent"
        />
        <Button type="submit" size="lg" className="h-10 shrink-0" disabled={state === 'busy'}>
          {state === 'busy' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Subscribe
        </Button>
      </div>
      {state === 'error' ? (
        <p className="text-xs text-danger" role="alert">
          {message}
        </p>
      ) : (
        <p className="text-xs text-muted">
          Double opt-in. One email a week, unsubscribe in a click.{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-fg">
            Privacy policy
          </Link>
          .
        </p>
      )}
    </form>
  );
}
