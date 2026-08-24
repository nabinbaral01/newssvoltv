'use client';

import { Check, Loader2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { updateAccountAction, type AccountState } from './actions';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Card, CardHeader } from '@/components/ui/surface';

const COUNTRIES = [
  ['US', 'United States'], ['GB', 'United Kingdom'], ['CA', 'Canada'], ['AU', 'Australia'],
  ['IN', 'India'], ['DE', 'Germany'], ['FR', 'France'], ['BR', 'Brazil'], ['MX', 'Mexico'],
  ['JP', 'Japan'], ['PH', 'Philippines'], ['NG', 'Nigeria'], ['ZA', 'South Africa'],
  ['NL', 'Netherlands'], ['ES', 'Spain'], ['IT', 'Italy'], ['SE', 'Sweden'], ['PL', 'Poland'],
  ['NP', 'Nepal'], ['SG', 'Singapore'], ['IE', 'Ireland'], ['NZ', 'New Zealand'],
] as const;

const currentYear = new Date().getFullYear();

type Profile = {
  name: string;
  email: string;
  bio: string | null;
  birthYear: number | null;
  gender: string | null;
  country: string | null;
  city: string | null;
};

export function AccountForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = React.useActionState<AccountState, FormData>(
    updateAccountAction,
    {},
  );

  React.useEffect(() => {
    if (state.ok) toast.success('Account updated.');
  }, [state.ok]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Profile" description="How your name appears on comments." />
        <form action={formAction} className="space-y-4 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="name" error={state.fieldErrors?.name}>
              <Input id="name" name="name" defaultValue={profile.name} required />
            </Field>
            <Field label="Email" htmlFor="email" hint="Contact support to change this.">
              <Input id="email" defaultValue={profile.email} disabled />
            </Field>
          </div>

          <Field label="Bio" htmlFor="bio" error={state.fieldErrors?.bio}>
            <Textarea id="bio" name="bio" defaultValue={profile.bio ?? ''} maxLength={400} />
          </Field>

          <fieldset className="rounded-card border border-border bg-elevated p-4">
            {/* The background is what stops the fieldset's own border drawing
                straight through the text — a legend sits in a notch in the
                border, and without a matching fill the line shows behind it. */}
            <legend className="ml-1 bg-elevated px-1.5 text-xs font-bold uppercase tracking-widest text-muted">
              Optional demographics
            </legend>
            <p className="mb-3 text-xs leading-relaxed text-muted">
              Our audience reports use only what readers volunteer here, and always show what
              share of the audience that represents. Clear any field to withdraw it.
            </p>
            {/*
              Two columns before four. Four across at 640px squeezed each
              select until its own value was clipped — "Not specifie" — and a
              country list full of names like "United Kingdom" fares worse.

              Birth year gets a fixed column because it holds four digits and
              was being given the same width as City.
            */}
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-[7rem_repeat(3,minmax(0,1fr))]">
              <Field label="Birth year" htmlFor="birthYear" error={state.fieldErrors?.birthYear}>
                <Input
                  id="birthYear"
                  name="birthYear"
                  type="number"
                  min={currentYear - 110}
                  max={currentYear - 13}
                  defaultValue={profile.birthYear ?? ''}
                />
              </Field>
              <Field label="Gender" htmlFor="gender" className="min-w-0">
                <Select id="gender" name="gender" defaultValue={profile.gender ?? ''}>
                  <option value="">Not specified</option>
                  <option value="FEMALE">Female</option>
                  <option value="MALE">Male</option>
                  <option value="NON_BINARY">Non-binary</option>
                  <option value="PREFER_NOT_TO_SAY">Rather not answer</option>
                </Select>
              </Field>
              <Field label="Country" htmlFor="country" className="min-w-0">
                <Select id="country" name="country" defaultValue={profile.country ?? ''}>
                  <option value="">Not specified</option>
                  {COUNTRIES.map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="City" htmlFor="city" className="min-w-0">
                <Input id="city" name="city" defaultValue={profile.city ?? ''} maxLength={80} />
              </Field>
            </div>
          </fieldset>

          <div className="flex items-center gap-3 border-t border-border pt-4">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Save changes
            </Button>
            {state.ok ? (
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <Check className="size-3.5" aria-hidden /> Saved
              </span>
            ) : null}
          </div>
        </form>
      </Card>

    </div>
  );
}
