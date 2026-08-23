'use client';

import Link from 'next/link';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/overlay';
import { Wordmark } from '@/components/site/wordmark';

const DISMISS_KEY = 'volt:signup-dismissed';
const DISMISS_DAYS = 30;

/**
 * Fires after roughly two screens of scrolling, once per 30 days, and never to
 * someone who is already signed in. Dismissible with escape, the close button
 * or the backdrop — an account prompt is not worth trapping a reader in.
 */
export function SignupModal({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (signedIn) return;

    try {
      const until = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
      if (until > Date.now()) return;
    } catch {
      return; // storage blocked: treat as dismissed rather than nagging
    }

    const onScroll = () => {
      if (window.scrollY > window.innerHeight * 2) {
        setOpen(true);
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [signedIn]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(
        DISMISS_KEY,
        String(Date.now() + DISMISS_DAYS * 86_400_000),
      );
    } catch {
      /* nothing to remember it with — the modal simply reappears next visit */
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : dismiss())}>
      <DialogContent
        title="Read Volt V your way"
        description="Free account. Follow the verticals you care about, comment on stories and pick up where you left off."
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-card border border-border bg-elevated p-3">
            <Wordmark as="plain" className="text-2xl" />
            <p className="text-xs text-muted">
              No paywall. We ask for an email address and, optionally, your age range and
              country — that last part is what keeps our audience reporting honest.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg" className="flex-1">
              <Link href="/register">Create free account</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="flex-1">
              <Link href="/login">I already have one</Link>
            </Button>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="w-full text-center text-xs text-muted underline underline-offset-2 hover:text-fg"
          >
            Not now — keep reading
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
