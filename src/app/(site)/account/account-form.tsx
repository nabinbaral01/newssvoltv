'use client';

import { Check, Download, Loader2, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { deleteAccountAction, updateAccountAction, type AccountState } from './actions';
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
  const [deleteState, deleteAction, deleting] = React.useActionState<AccountState, FormData>(
    deleteAccountAction,
    {},
  );
  const [confirmText, setConfirmText] = React.useState('');

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
            <legend className="px-1 text-xs font-bold uppercase tracking-widest text-muted">
              Optional demographics
            </legend>
            <p className="mb-3 text-xs leading-relaxed text-muted">
              Our audience reports use only what readers volunteer here, and always show what
              share of the audience that represents. Clear any field to withdraw it.
            </p>
            <div className="grid gap-3 sm:grid-cols-4">
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
              <Field label="Gender" htmlFor="gender">
                <Select id="gender" name="gender" defaultValue={profile.gender ?? ''}>
                  <option value="">Not specified</option>
                  <option value="FEMALE">Female</option>
                  <option value="MALE">Male</option>
                  <option value="NON_BINARY">Non-binary</option>
                  <option value="PREFER_NOT_TO_SAY">Rather not answer</option>
                </Select>
              </Field>
              <Field label="Country" htmlFor="country">
                <Select id="country" name="country" defaultValue={profile.country ?? ''}>
                  <option value="">Not specified</option>
                  {COUNTRIES.map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="City" htmlFor="city">
                <Input id="city" name="city" defaultValue={profile.city ?? ''} maxLength={80} />
              </Field>
            </div>
          </fieldset>

          <div className="flex items-center gap-3">
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

      <Card>
        <CardHeader
          title="Your data"
          description="Everything we hold about this account, in one file."
        />
        <div className="space-y-4 p-4">
          <Button asChild variant="outline">
            <a href="/api/account/export" download>
              <Download className="size-4" aria-hidden /> Download my data (JSON)
            </a>
          </Button>

          <div className="rounded-card border border-danger/30 bg-danger/5 p-4">
            <h3 className="text-sm font-semibold text-danger">Delete account</h3>
            <p className="mt-1 text-xs text-muted">
              Permanently removes your account and demographic fields, detaches your comments and
              unlinks every analytics row from you. This cannot be undone.
            </p>
            {deleteState.error ? (
              <p className="mt-2 text-xs text-danger" role="alert">
                {deleteState.error}
              </p>
            ) : null}
            <form action={deleteAction} className="mt-3 flex flex-wrap items-end gap-2">
              <Field label="Type DELETE to confirm" htmlFor="confirm" className="w-52">
                <Input
                  id="confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                />
              </Field>
              <Button
                type="submit"
                variant="danger"
                disabled={confirmText !== 'DELETE' || deleting}
              >
                {deleting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="size-4" aria-hidden />
                )}
                Delete my account
              </Button>
            </form>
          </div>
        </div>
      </Card>
    </div>
  );
}
