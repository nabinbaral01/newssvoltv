'use client';

import { Loader2, MailCheck } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { requestResetAction, type ForgotState } from './actions';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

export function ForgotPasswordForm() {
  const [state, formAction, pending] = React.useActionState<ForgotState, FormData>(
    requestResetAction,
    {},
  );

  if (state.sent) {
    return (
      <div className="rounded-card border border-border bg-surface p-5 text-center">
        <MailCheck className="mx-auto size-8 text-accent" aria-hidden />
        <h2 className="headline mt-3 text-2xl uppercase">Check your inbox</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          If that address has an account with a password, a reset link is on its way. It works
          once and expires in an hour.
        </p>
        <p className="mt-3 text-xs text-muted">
          Nothing arrived? Check spam, then{' '}
          <Link href="/forgot-password" className="text-accent underline underline-offset-2">
            try again
          </Link>
          .
        </p>
        <Button asChild variant="outline" className="mt-4 w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} method="post" className="space-y-4">
      {state.error ? (
        <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}

      <Field
        label="Email"
        htmlFor="email"
        hint="We'll send a link to this address if it has an account."
        error={state.fieldErrors?.email}
      >
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Send reset link
      </Button>

      <p className="text-center text-sm text-muted">
        Remembered it?{' '}
        <Link href="/login" className="text-accent underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </form>
  );
}
