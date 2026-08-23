'use client';

import { Loader2 } from 'lucide-react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

export function LoginForm({
  googleEnabled,
  next = '/account',
}: {
  googleEnabled: boolean;
  next?: string;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const data = new FormData(event.currentTarget);
    const result = await signIn('credentials', {
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
      redirect: false,
    });

    setBusy(false);
    if (result?.error) {
      // Deliberately vague: never confirm whether an address exists.
      setError('That email and password combination did not work.');
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {googleEnabled ? (
        <>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => signIn('google', { callbackUrl: next })}
          >
            Continue with Google
          </Button>
          <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      ) : null}

      {/* method="post" matters: if the client bundle ever fails to hydrate, the
          browser falls back to a native submit. A GET form would put the
          password in the URL and the browser history. */}
      <form onSubmit={onSubmit} method="post" className="space-y-4">
        {error ? (
          <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>

        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>

        <p className="text-right text-xs">
          <Link href="/forgot-password" className="text-muted underline underline-offset-2 hover:text-accent">
            Forgot your password?
          </Link>
        </p>

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Sign in
        </Button>
      </form>
    </div>
  );
}
