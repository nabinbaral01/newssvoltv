'use client';

import { Loader2, ShieldAlert, Trash2, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { moderateComments, type ModerationAction } from './actions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/field';
import { StatusPill } from '@/components/ui/surface';
import { cn, relativeTime } from '@/lib/utils';

export type CommentRow = {
  id: string;
  body: string;
  status: 'PENDING' | 'APPROVED' | 'SPAM';
  createdAt: string;
  authorName: string;
  postTitle: string;
  postHref: string;
  isReply: boolean;
};

/**
 * Comments publish on arrival, so there is no queue to work through — the
 * default view is what readers can actually see. PENDING only ever appears
 * for rows written before that change.
 */
const FILTERS = [
  { key: 'APPROVED', label: 'Live' },
  { key: 'SPAM', label: 'Spam' },
  { key: '', label: 'All' },
] as const;

export function CommentsClient({
  comments,
  status,
  counts,
  canDelete,
}: {
  comments: CommentRow[];
  status: string;
  counts: Record<string, number>;
  /** Deleting is irreversible, so it is an administrator's call alone. */
  canDelete: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);

  const run = async (action: ModerationAction, ids: string[]) => {
    if (
      action === 'delete' &&
      !window.confirm(
        `Permanently delete ${ids.length} comment(s)? This cannot be undone — marking them as spam hides them and keeps the record.`,
      )
    ) {
      return;
    }
    setBusy(true);
    const result = await moderateComments(action, ids);
    setBusy(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `${result.affected} comment(s) ${
        action === 'delete' ? 'deleted' : action === 'spam' ? 'marked as spam' : 'restored'
      }.`,
    );
    setSelected(new Set());
    router.refresh();
  };

  const setStatus = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set('status', next);
    else params.delete('status');
    router.push(`${pathname}?${params.toString()}`);
  };

  const allSelected = comments.length > 0 && selected.size === comments.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter by status">
        {FILTERS.map((filter) => (
          <button
            key={filter.key || 'all'}
            type="button"
            onClick={() => setStatus(filter.key)}
            aria-pressed={status === filter.key}
            className={cn(
              'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
              status === filter.key
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border text-muted hover:text-fg',
            )}
          >
            {filter.label}
            {filter.key ? (
              <span className="ml-1.5 tabular-nums text-muted">{counts[filter.key] ?? 0}</span>
            ) : null}
          </button>
        ))}
      </div>

      {selected.size ? (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-card border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <Button size="sm" variant="secondary" onClick={() => run('spam', [...selected])} disabled={busy}>
            <ShieldAlert className="size-3.5" aria-hidden /> Mark as spam
          </Button>
          <Button size="sm" variant="secondary" onClick={() => run('restore', [...selected])} disabled={busy}>
            <Undo2 className="size-3.5" aria-hidden /> Restore
          </Button>
          {canDelete ? (
            <Button size="sm" variant="danger" onClick={() => run('delete', [...selected])} disabled={busy}>
              {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Trash2 className="size-3.5" aria-hidden />}
              Delete
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-card border border-border bg-surface">
        <div className="flex items-center gap-3 border-b border-border p-3">
          <Checkbox
            checked={allSelected}
            onCheckedChange={() => setSelected(allSelected ? new Set() : new Set(comments.map((c) => c.id)))}
            aria-label="Select all comments"
          />
          <span className="text-xs uppercase tracking-wide text-muted">
            {comments.length} shown
          </span>
        </div>

        <ul className="divide-y divide-border">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3 p-3">
              <Checkbox
                checked={selected.has(comment.id)}
                onCheckedChange={(checked) => {
                  const next = new Set(selected);
                  if (checked) next.add(comment.id);
                  else next.delete(comment.id);
                  setSelected(next);
                }}
                aria-label={`Select comment by ${comment.authorName}`}
                className="mt-1"
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="font-medium text-fg">{comment.authorName}</span>
                  <span aria-hidden>·</span>
                  <span>{relativeTime(comment.createdAt)}</span>
                  {comment.isReply ? <span className="text-accent">reply</span> : null}
                  <StatusPill status={comment.status} />
                </div>

                <p className="mt-1.5 whitespace-pre-line text-sm">{comment.body}</p>

                <p className="mt-1.5 truncate text-xs text-muted">
                  on{' '}
                  <Link href={comment.postHref} className="text-accent hover:underline" target="_blank">
                    {comment.postTitle}
                  </Link>
                </p>
              </div>

              <div className="flex shrink-0 flex-col gap-1">
                {comment.status === 'SPAM' ? (
                  <button
                    type="button"
                    onClick={() => run('restore', [comment.id])}
                    className="rounded border border-border p-1.5 text-success hover:border-success"
                    aria-label="Restore"
                    title="Restore to the site"
                  >
                    <Undo2 className="size-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => run('spam', [comment.id])}
                    className="rounded border border-border p-1.5 text-warning hover:border-warning"
                    aria-label="Mark as spam"
                    title="Hide from the site — keeps the record"
                  >
                    <ShieldAlert className="size-3.5" />
                  </button>
                )}
                {canDelete ? (
                <button
                  type="button"
                  onClick={() => run('delete', [comment.id])}
                  className="rounded border border-border p-1.5 text-danger hover:border-danger"
                  aria-label="Delete permanently"
                  title="Delete permanently — marking as spam keeps the record"
                >
                  <Trash2 className="size-3.5" />
                </button>
                ) : null}
              </div>
            </li>
          ))}

          {!comments.length ? (
            <li className="p-10 text-center text-sm text-muted">
              Nothing in this queue. Good moderating.
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
