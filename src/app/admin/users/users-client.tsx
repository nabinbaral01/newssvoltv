'use client';

import { Check, Copy, KeyRound, Loader2, MailWarning, Send, Trash2, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import {
  changeRoleAction, deleteUserAction, inviteUserAction, resendInviteAction, resetPasswordAction,
  type UserState,
} from './actions';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/overlay';
import { Badge, Card, CardHeader } from '@/components/ui/surface';
import { formatDate, relativeTime } from '@/lib/utils';

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'EDITOR' | 'AUTHOR' | 'READER';
  image: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  postCount: number;
  commentCount: number;
  /** No password set yet — invited, but has never signed in. */
  pendingInvite: boolean;
};

export type AuditRow = {
  id: string;
  action: string;
  entity: string;
  createdAt: string;
  userName: string | null;
};

const ROLE_NOTES: Record<string, string> = {
  ADMIN: 'Everything, including users and settings',
  EDITOR: "Publishes anyone's work, moderates, manages taxonomy",
  AUTHOR: 'Writes and submits their own posts; cannot publish',
  READER: 'No admin access at all',
};

/**
 * Shown when the email could not be delivered.
 *
 * Not decoration: on a sandbox sender every address but the account owner's is
 * refused, so without a copyable link the invited person hears nothing at all
 * and the admin has no way to find out why.
 */
function LinkFallback({ link, label }: { link: string; label: string }) {
  const [copied, setCopied] = React.useState(false);

  return (
    <div className="rounded-card border border-warning/50 bg-warning/10 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold">
        <MailWarning className="size-3.5 text-warning" aria-hidden />
        {label}
      </p>
      <div className="mt-2 flex gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-md border border-border bg-elevated px-2 py-1 font-mono text-[11px]"
          aria-label="Set-password link"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted">
        Send this over a channel you trust. It works once and expires.
      </p>
    </div>
  );
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [state, formAction, pending] = React.useActionState<UserState, FormData>(
    inviteUserAction,
    {},
  );

  React.useEffect(() => {
    if (state.ok && state.message) {
      if (state.emailSent) {
        toast.success(state.message);
        onDone();
      } else {
        // Closing the dialog here would throw the only copy of the link away.
        toast.warning(state.message, { duration: 10_000 });
      }
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, onDone, router]);

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Name" htmlFor="invite-name" error={state.fieldErrors?.name}>
        <Input id="invite-name" name="name" required />
      </Field>
      <Field label="Email" htmlFor="invite-email" error={state.fieldErrors?.email}>
        <Input id="invite-email" name="email" type="email" required />
      </Field>
      <Field label="Role" htmlFor="invite-role">
        <Select id="invite-role" name="role" defaultValue="AUTHOR">
          <option value="AUTHOR">Author</option>
          <option value="EDITOR">Editor</option>
          <option value="ADMIN">Administrator</option>
          <option value="READER">Reader</option>
        </Select>
      </Field>
      <Field label="Bio" htmlFor="invite-bio" hint="Shown on the byline and author page.">
        <Textarea id="invite-bio" name="bio" rows={2} maxLength={400} />
      </Field>
      <p className="text-xs text-muted">
        They get an email with a link to choose their own password. The account cannot be signed
        into until they do, so an invitation nobody accepts leaves nothing usable behind.
      </p>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Send invitation
      </Button>

      {state.link && !state.emailSent ? (
        <LinkFallback link={state.link} label="The invitation email was not delivered" />
      ) : null}
    </form>
  );
}

/**
 * Says out loud where invitations will actually land.
 *
 * Without it, "Invite" looks identical whether mail is configured, sandboxed
 * to one address, or going nowhere at all — and the person finds out days
 * later when a colleague says they never got anything.
 */
function MailStatus({
  driver,
  from,
  smtpUser,
}: {
  driver: 'smtp' | 'resend' | 'console';
  from: string | null;
  smtpUser: string | null;
}) {
  if (driver === 'smtp') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Send className="size-3.5 text-success" aria-hidden />
        Invitations send from <span className="text-fg">{smtpUser}</span> to any address.
      </p>
    );
  }

  const sandboxed = !from || from.includes('resend.dev');

  return (
    <p className="flex items-start gap-1.5 text-xs text-muted">
      <MailWarning className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
      <span>
        {driver === 'console'
          ? 'No mail provider is configured — invitations are printed to the server log, not sent. Copy the link instead.'
          : sandboxed
            ? "Sending from Resend's shared test address, which only delivers to the address that owns the Resend account. Invitations to anyone else will not arrive — copy the link instead."
            : `Invitations send from ${from}.`}
      </span>
    </p>
  );
}

export function UsersClient({
  users,
  auditLog,
  currentUserId,
  emailDriver,
  emailFrom,
  smtpUser,
}: {
  users: UserRow[];
  auditLog: AuditRow[];
  currentUserId: string;
  emailDriver: 'smtp' | 'resend' | 'console';
  emailFrom: string | null;
  smtpUser: string | null;
}) {
  const router = useRouter();
  const [inviting, setInviting] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [fallback, setFallback] = React.useState<{ link: string; label: string } | null>(null);

  const act = async (id: string, fn: () => Promise<UserState>) => {
    setBusy(id);
    const result = await fn();
    setBusy(null);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    if (result.link && !result.emailSent) {
      // Undeliverable: keep the link on screen rather than in a toast that
      // vanishes before it can be copied.
      setFallback({ link: result.link, label: result.message ?? 'Email not delivered' });
      toast.warning(result.message ?? 'Email not delivered.');
    } else {
      setFallback(null);
      toast.success(result.message ?? 'Done.');
    }
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Accounts"
          description={`${users.length} total`}
          action={
            <Dialog open={inviting} onOpenChange={setInviting}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="size-4" /> Invite
                </Button>
              </DialogTrigger>
              <DialogContent title="Invite someone">
                <InviteForm onDone={() => setInviting(false)} />
              </DialogContent>
            </Dialog>
          }
        />

        <div className="border-b border-border px-4 py-3">
          <MailStatus driver={emailDriver} from={emailFrom} smtpUser={smtpUser} />
        </div>

        {fallback ? (
          <div className="border-b border-border p-4">
            <LinkFallback link={fallback.link} label={fallback.label} />
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="p-3 font-medium">Person</th>
                <th scope="col" className="p-3 font-medium">Role</th>
                <th scope="col" className="p-3 text-right font-medium">Posts</th>
                <th scope="col" className="p-3 text-right font-medium">Comments</th>
                <th scope="col" className="p-3 font-medium">Last seen</th>
                <th scope="col" className="p-3 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border/60 last:border-0">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-elevated text-xs font-bold text-accent">
                        {user.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={user.image} alt="" className="size-full object-cover" />
                        ) : (
                          user.name.slice(0, 1).toUpperCase()
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {user.name}
                          {user.id === currentUserId ? <Badge className="ml-2">you</Badge> : null}
                          {user.pendingInvite ? (
                            <Badge tone="warning" className="ml-2">invited</Badge>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-muted">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <label className="sr-only" htmlFor={`role-${user.id}`}>Role for {user.name}</label>
                    <Select
                      id={`role-${user.id}`}
                      value={user.role}
                      disabled={busy === user.id}
                      onChange={(e) =>
                        act(user.id, () => changeRoleAction(user.id, e.target.value as UserRow['role']))
                      }
                      className="w-32"
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="EDITOR">Editor</option>
                      <option value="AUTHOR">Author</option>
                      <option value="READER">Reader</option>
                    </Select>
                    <span className="mt-1 block text-[11px] text-muted">{ROLE_NOTES[user.role]}</span>
                  </td>
                  <td className="p-3 text-right tabular-nums">{user.postCount}</td>
                  <td className="p-3 text-right tabular-nums text-muted">{user.commentCount}</td>
                  <td className="p-3 text-xs text-muted">
                    {user.lastLoginAt
                      ? relativeTime(user.lastLoginAt)
                      : user.pendingInvite
                        ? 'not accepted yet'
                        : 'never'}
                    <span className="block">joined {formatDate(user.createdAt)}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      {user.pendingInvite ? (
                        <button
                          type="button"
                          disabled={busy === user.id}
                          onClick={() => act(user.id, () => resendInviteAction(user.id))}
                          aria-label={`Resend invitation to ${user.name}`}
                          title="Resend invitation"
                          className="rounded border border-border p-1.5 text-muted hover:text-accent disabled:opacity-30"
                        >
                          <Send className="size-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => act(user.id, () => resetPasswordAction(user.id))}
                        aria-label={`Reset password for ${user.name}`}
                        title="Reset password"
                        className="rounded border border-border p-1.5 text-muted hover:text-accent"
                      >
                        <KeyRound className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={user.id === currentUserId}
                        onClick={() => {
                          if (!window.confirm(`Delete ${user.name}'s account?`)) return;
                          void act(user.id, () => deleteUserAction(user.id));
                        }}
                        aria-label={`Delete ${user.name}`}
                        title="Delete account"
                        className="rounded border border-border p-1.5 text-muted hover:text-danger disabled:opacity-30"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Recent activity" description="From the audit log" />
        <ul className="divide-y divide-border">
          {auditLog.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <code className="shrink-0 rounded bg-elevated px-1.5 py-0.5 text-[11px]">{entry.action}</code>
              <span className="min-w-0 flex-1 truncate text-muted">
                {entry.userName ?? 'system'} · {entry.entity}
              </span>
              <span className="shrink-0 text-xs text-muted">{relativeTime(entry.createdAt)}</span>
            </li>
          ))}
          {!auditLog.length ? (
            <li className="p-6 text-center text-sm text-muted">Nothing logged yet.</li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
