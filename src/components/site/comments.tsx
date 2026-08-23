import Link from 'next/link';

import { CommentForm } from '@/components/site/comment-form';
import { getApprovedComments } from '@/lib/queries';
import { currentUser } from '@/lib/permissions';
import { relativeTime } from '@/lib/utils';

type CommentRow = Awaited<ReturnType<typeof getApprovedComments>>[number];

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
  depth = 0,
}: {
  comment: CommentRow;
  replies: Map<string, CommentRow[]>;
  postId: string;
  canReply: boolean;
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
            <p className="truncate text-sm font-medium">{name}</p>
            <time dateTime={comment.createdAt.toISOString()} className="text-xs text-muted">
              {relativeTime(comment.createdAt)}
            </time>
          </div>
        </div>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-fg/90">
          {comment.body}
        </p>
        {canReply && depth < 3 ? (
          <CommentForm postId={postId} parentId={comment.id} compact />
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
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export async function Comments({ postId }: { postId: string }) {
  const [comments, user] = await Promise.all([getApprovedComments(postId), currentUser()]);

  const roots = comments.filter((c) => !c.parentId);
  const replies = new Map<string, CommentRow[]>();
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

      {user ? (
        <div className="mt-4">
          <CommentForm postId={postId} />
        </div>
      ) : (
        <p className="mt-4 rounded-card border border-border bg-surface p-4 text-sm text-muted">
          <Link href="/login" className="font-medium text-accent underline underline-offset-2">
            Sign in
          </Link>{' '}
          to join the discussion. New comments are held for moderation.
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
              canReply={Boolean(user)}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-muted">No comments yet. Be the first.</p>
      )}
    </section>
  );
}
