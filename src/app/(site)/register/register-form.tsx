'use client';

import { Loader2 } from 'lucide-react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { registerAction, type RegisterState } from './actions';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';

const COUNTRIES = [
  ['US', 'United States'], ['GB', 'United Kingdom'], ['CA', 'Canada'], ['AU', 'Australia'],
  ['IN', 'India'], ['DE', 'Germany'], ['FR', 'France'], ['BR', 'Brazil'], ['MX', 'Mexico'],
  ['JP', 'Japan'], ['PH', 'Philippines'], ['NG', 'Nigeria'], ['ZA', 'South Africa'],
  ['NL', 'Netherlands'], ['ES', 'Spain'], ['IT', 'Italy'], ['SE', 'Sweden'], ['PL', 'Poland'],
  ['NP', 'Nepal'], ['SG', 'Singapore'], ['IE', 'Ireland'], ['NZ', 'New Zealand'],
] as const;

const currentYear = new Date().getFullYear();

export function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [state, formAction, pending] = React.useActionState<RegisterState, FormData>(
    registerAction,
    {},
  );
  const [signingIn, setSigningIn] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  // On success, sign the new account straight in rather than bouncing to login.
  React.useEffect(() => {
    if (!state.ok || signingIn) return;
    // Guards a one-shot follow-up call to the auth endpoint after the server
    // action succeeds; it runs once and is not a render-loop risk.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSigningIn(true);
    const data = new FormData(formRef.current ?? undefined);
    void signIn('credentials', {
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
      redirect: false,
    }).then((res) => {
      if (res?.error) {
        toast.success('Account created — please sign in.');
        router.push('/login');
      } else {
        toast.success('Welcome to Volt V.');
        router.push('/account');
        router.refresh();
      }
    });
  }, [state.ok, signingIn, router]);

  return (
    <div className="space-y-5">
      {googleEnabled ? (
        <>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => signIn('google', { callbackUrl: '/account' })}
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

      <form ref={formRef} action={formAction} className="space-y-4">
        {state.error ? (
          <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">
            {state.error}
          </p>
        ) : null}

        <Field label="Name" htmlFor="name" error={state.fieldErrors?.name}>
          <Input id="name" name="name" autoComplete="name" required />
        </Field>

        <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          hint="At least 8 characters."
          error={state.fieldErrors?.password}
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>

        {/* The honest bit: these three fields are the entire self-declared
            source behind the demographics dashboards, and they are optional. */}
        <fieldset className="rounded-card border border-border bg-surface p-4">
          <legend className="px-1 text-xs font-bold uppercase tracking-widest text-muted">
            Optional — helps our audience reporting
          </legend>
          <p className="mb-3 text-xs leading-relaxed text-muted">
            We report age and gender only from what readers tell us here, alongside the share of
            the audience that has told us anything at all. Leave any of it blank and nothing
            changes about your account.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Birth year" htmlFor="birthYear" error={state.fieldErrors?.birthYear}>
              <Input
                id="birthYear"
                name="birthYear"
                type="number"
                inputMode="numeric"
                min={currentYear - 110}
                max={currentYear - 13}
                placeholder="1994"
              />
            </Field>
            <Field label="Gender" htmlFor="gender">
              <Select id="gender" name="gender" defaultValue="">
                <option value="">Prefer not to say</option>
                <option value="FEMALE">Female</option>
                <option value="MALE">Male</option>
                <option value="NON_BINARY">Non-binary</option>
                <option value="PREFER_NOT_TO_SAY">Rather not answer</option>
              </Select>
            </Field>
            <Field label="Country" htmlFor="country">
              <Select id="country" name="country" defaultValue="">
                <option value="">Not specified</option>
                {COUNTRIES.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </fieldset>

        <Button type="submit" size="lg" className="w-full" disabled={pending || signingIn}>
          {pending || signingIn ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Create account
        </Button>

        <p className="text-xs text-muted">
          By creating an account you agree to our{' '}
          <Link href="/terms" className="underline underline-offset-2 hover:text-fg">
            terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-fg">
            privacy policy
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
