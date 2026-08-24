'use client';

import Link from 'next/link';
import * as React from 'react';

import { CommentForm } from '@/components/site/comment-form';
import { relativeTime } from '@/lib/utils';

/**
 * The thread, rendered from server data but able to refresh itself.
 *
 * The article route is ISR-cached, which is correct for an article and wrong
 * for a comment written five seconds ago: revalidatePath marks the page stale,
 * but the next request is still served the previous render, so the author
 * reloads and cannot find their own comment. Making the route dynamic would
 * fix that by charging every reader for something only commenters need. So the
 * server render stays cached, and posting triggers one refetch.
 */
export type ThreadComment = {
  id: string;
  body: string;
  createdAt: string;
  parentId: string | null;
  guestName: string | null;
  user: { name: string; image: string | null; slug: string } | null;
};

function Avatar({ name, image }: { name: string; image?: string | null }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-elevated text-xs font-bold text-accent">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="size-full object-cover" />
      ) : (
        name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

function CommentNode({
  comment,
  replies,
  postId,
  canReply,
  onPosted,
  depth = 0,
}: {
  comment: ThreadComment;
  replies: Map<string, ThreadComment[]>;
  postId: string;
  canReply: boolean;
  onPosted: () => void;
  depth?: number;
}) {
  const name = comment.user?.name ?? comment.guestName ?? 'Reader';
  const children = replies.get(comment.id) ?? [];

  return (
    <li className={depth > 0 ? 'ml-4 border-l border-border pl-4 sm:ml-6 sm:pl-6' : ''}>
      <article className="py-4">
        <div className="flex items-center gap-2">
          <Avatar name={name} image={comment.user?.image} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {comment.user?.slug ? (
                <Link href={`/author/${comment.user.slug}`} className="hover:text-accent">
                  {name}
                </Link>
              ) : (
                name
              )}
            </p>
            <time dateTime={comment.createdAt} className="text-xs text-muted">
              {relativeTime(comment.createdAt)}
            </time>
          </div>
        </div>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-fg/90">
          {comment.body}
        </p>
        {canReply && depth < 3 ? (
          <CommentForm postId={postId} parentId={comment.id} compact onPosted={onPosted} />
        ) : null}
      </article>
      {children.length ? (
        <ul>
          {children.map((child) => (
            <CommentNode
              key={child.id}
              comment={child}
              replies={replies}
              postId={postId}
              canReply={canReply}
              onPosted={onPosted}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function CommentThread({
  postId,
  initial,
  signedIn,
}: {
  postId: string;
  initial: ThreadComment[];
  signedIn: boolean;
}) {
  const [comments, setComments] = React.useState(initial);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?postId=${encodeURIComponent(postId)}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = (await res.json()) as { comments: ThreadComment[] };
      setComments(data.comments);
    } catch {
      // A failed refresh is not worth an error message: the comment is saved,
      // and the next page load will show it.
    }
  }, [postId]);

  const roots = comments.filter((c) => !c.parentId);
  const replies = new Map<string, ThreadComment[]>();
  for (const comment of comments) {
    if (!comment.parentId) continue;
    const list = replies.get(comment.parentId) ?? [];
    list.push(comment);
    replies.set(comment.parentId, list);
  }

  return (
    <section id="comments" className="mt-12 border-t border-border pt-8">
      <h2 className="headline text-2xl uppercase">
        {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
      </h2>

      {signedIn ? (
        <div className="mt-4">
          <CommentForm postId={postId} onPosted={refresh} />
        </div>
      ) : (
        <p className="mt-4 rounded-card border border-border bg-surface p-4 text-sm text-muted">
          <Link href="/login" className="font-medium text-accent underline underline-offset-2">
            Sign in
          </Link>{' '}
          to join the discussion.
        </p>
      )}

      {roots.length ? (
        <ul className="mt-4 divide-y divide-border">
          {roots.map((comment) => (
            <CommentNode
              key={comment.id}
              comment={comment}
              replies={replies}
              postId={postId}
              canReply={signedIn}
              onPosted={refresh}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-muted">No comments yet. Be the first.</p>
      )}
    </section>
  );
}
