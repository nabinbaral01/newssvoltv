'use client';

import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';

export function CommentForm({
  postId,
  parentId,
  compact,
}: {
  postId: string;
  parentId?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = React.useState(!compact);
  const [busy, setBusy] = React.useState(false);
  const [body, setBody] = React.useState('');

  if (compact && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-xs font-semibold uppercase tracking-widest text-muted hover:text-accent"
      >
        Reply
      </button>
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, parentId, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not post that comment.');
      setBody('');
      if (compact) setOpen(false);
      toast.success(data.message ?? 'Comment submitted for moderation.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={compact ? 'mt-3' : ''}>
      <label className="sr-only" htmlFor={`comment-${parentId ?? 'root'}`}>
        {parentId ? 'Write a reply' : 'Write a comment'}
      </label>
      <Textarea
        id={`comment-${parentId ?? 'root'}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={compact ? 2 : 3}
        maxLength={4000}
        required
        placeholder={parentId ? 'Write a reply…' : 'Add to the discussion…'}
      />
      <div className="mt-2 flex items-center gap-2">
        <Button type="submit" size="sm" disabled={busy || !body.trim()}>
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
          {parentId ? 'Reply' : 'Post comment'}
        </Button>
        {compact ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        ) : null}
        <span className="text-xs text-muted">Held for moderation before it appears.</span>
      </div>
    </form>
  );
}
