'use client';

import { Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { resetPasswordAction, type ResetState } from './actions';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { cn } from '@/lib/utils';

/** Length is the only rule enforced server-side; this is guidance, not a gate. */
function strength(password: string): { score: number; label: string; tone: string } {
  if (!password) return { score: 0, label: '', tone: 'bg-border' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^\w\s]/.test(password)) score++;

  if (score <= 2) return { score, label: 'Weak', tone: 'bg-danger' };
  if (score === 3) return { score, label: 'Fair', tone: 'bg-warning' };
  if (score === 4) return { score, label: 'Good', tone: 'bg-accent' };
  return { score, label: 'Strong', tone: 'bg-success' };
}

export function ResetPasswordForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [state, formAction, pending] = React.useActionState<ResetState, FormData>(
    resetPasswordAction,
    {},
  );
  const [password, setPassword] = React.useState('');
  const [visible, setVisible] = React.useState(false);

  const meter = strength(password);

  if (state.ok) {
    return (
      <div className="rounded-card border border-border bg-surface p-5 text-center">
        <Check className="mx-auto size-8 text-success" aria-hidden />
        <h2 className="headline mt-3 text-2xl uppercase">Password changed</h2>
        <p className="mt-2 text-sm text-muted">
          You can sign in with your new password now. The old reset link no longer works.
        </p>
        <Button
          className="mt-4 w-full"
          onClick={async () => {
            const result = await signIn('credentials', { email, password, redirect: false });
            router.push(result?.error ? '/login' : '/account');
            router.refresh();
          }}
        >
          Continue to your account
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} method="post" className="space-y-4">
      <input type="hidden" name="token" value={token} />

      {state.error ? (
        <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">
          <p>{state.error}</p>
          <Link href="/forgot-password" className="mt-1 inline-block underline underline-offset-2">
            Request a new link
          </Link>
        </div>
      ) : null}

      <p className="text-sm text-muted">
        Setting a new password for <span className="font-medium text-fg">{email}</span>
      </p>

      <Field
        label="New password"
        htmlFor="password"
        hint="At least 8 characters."
        error={state.fieldErrors?.password}
      >
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={visible ? 'text' : 'password'}
            autoComplete="new-password"
            minLength={8}
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-fg"
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>

      {password ? (
        <div>
          <div className="flex gap-1" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={cn('h-1 flex-1 rounded-full', i < meter.score ? meter.tone : 'bg-border')}
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">
            Strength: <span className="text-fg">{meter.label}</span>
          </p>
        </div>
      ) : null}

      <Field label="Confirm password" htmlFor="confirm" error={state.fieldErrors?.confirm}>
        <Input
          id="confirm"
          name="confirm"
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          required
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Set new password
      </Button>
    </form>
  );
}
