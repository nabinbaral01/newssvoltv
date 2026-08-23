'use client';

import Link from 'next/link';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { readConsent, signalsRefusal, writeConsent } from '@/lib/consent';

/**
 * Defaults to essential-only: nothing analytics-related fires until someone
 * presses accept. A browser sending DNT or GPC is never asked at all — the
 * refusal is already on the record.
 */
export function CookieConsent() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (signalsRefusal()) return;
    if (readConsent()) return;
    const timer = window.setTimeout(() => setVisible(true), 900);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const decide = (value: 'all' | 'essential') => {
    writeConsent(value);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/98 p-4 backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-muted">
          We use essential cookies to run the site. With your consent we also measure which
          articles get read, using our own first-party analytics — no third-party ad trackers,
          and IP addresses are hashed, never stored.{' '}
          <Link href="/privacy" className="text-accent underline underline-offset-2">
            Read the policy
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={() => decide('essential')}>
            Essential only
          </Button>
          <Button onClick={() => decide('all')}>Accept analytics</Button>
        </div>
      </div>
    </div>
  );
}
