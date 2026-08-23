import { AlertTriangle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ResetPasswordForm } from './reset-form';
import { Button } from '@/components/ui/button';
import { Wordmark } from '@/components/site/wordmark';
import { checkResetToken } from '@/lib/password-reset';

export const metadata: Metadata = {
  title: 'Set a new password',
  robots: { index: false, follow: false },
};

// The token is checked per request; nothing about this page may be cached.
export const dynamic = 'force-dynamic';

const REASONS = {
  expired: 'That link has expired. Reset links are valid for one hour.',
  used: 'That link has already been used. Each one works only once.',
  unknown: 'That link is not valid. It may have been mistyped or superseded by a newer one.',
} as const;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const check = token ? await checkResetToken(token) : ({ valid: false, reason: 'unknown' } as const);

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="text-center">
        <Wordmark as="plain" className="text-4xl" />
        <h1 className="headline mt-4 text-3xl uppercase">
          {check.valid ? 'Set a new password' : 'Link not usable'}
        </h1>
      </div>

      <div className="mt-8">
        {check.valid ? (
          <ResetPasswordForm token={token!} email={check.email} />
        ) : (
          <div className="rounded-card border border-warning/40 bg-warning/10 p-5 text-center">
            <AlertTriangle className="mx-auto size-8 text-warning" aria-hidden />
            <p className="mt-3 text-sm leading-relaxed text-fg">{REASONS[check.reason]}</p>
            <Button asChild className="mt-4 w-full">
              <Link href="/forgot-password">Request a new link</Link>
            </Button>
            <p className="mt-3 text-xs text-muted">
              Your password has not been changed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
