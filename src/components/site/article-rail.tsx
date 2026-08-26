'use client';

import { ReactionKind } from '@prisma/client';
import { Bookmark, Check, MessageSquare, ThumbsUp, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { toggleFollowAction } from '@/app/(site)/author/follow-actions';
import { toggleReactionAction } from '@/app/(site)/[category]/reaction-actions';
import { cn } from '@/lib/utils';

/**
 * Like, save and jump-to-comments, beside the article.
 *
 * The counts arrive from the server render, which is ISR-cached and shared by
 * everyone. Whether *this* reader has already liked or saved cannot come that
 * way — it would leak one person's state to every visitor — so it is fetched
 * once after mount. Anonymous visitors get an instant empty answer that never
 * touches the database, which is most of the traffic.
 *
 * Until that answer lands the buttons render in their neutral state rather
 * than a skeleton: they are usable immediately, and the only cost of a late
 * correction is a filled icon appearing a moment later.
 */
export function ArticleRail({
  postId,
  authorId,
  authorName,
  initialLikes,
  commentCount,
  orientation = 'vertical',
  className,
}: {
  postId: string;
  authorId: string;
  authorName: string;
  initialLikes: number;
  commentCount: number;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}) {
  const router = useRouter();
  const [likes, setLikes] = React.useState(initialLikes);
  const [liked, setLiked] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [following, setFollowing] = React.useState(false);
  // Hidden until we know: showing "Follow" on your own article and then
  // removing it a moment later is worse than showing it a moment late.
  const [isAuthor, setIsAuthor] = React.useState<boolean | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/posts/reactions?postId=${encodeURIComponent(postId)}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            liked?: boolean;
            saved?: boolean;
            following?: boolean;
            isAuthor?: boolean;
          } | null,
        ) => {
          if (cancelled || !data) return;
          setLiked(Boolean(data.liked));
          setSaved(Boolean(data.saved));
          setFollowing(Boolean(data.following));
          setIsAuthor(Boolean(data.isAuthor));
        },
      )
      .catch(() => {
        // Not worth an error message: the buttons still work, they just start
        // from the neutral state.
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  function toggle(kind: ReactionKind) {
    const wasLike = kind === ReactionKind.LIKE;
    const before = { liked, saved, likes };

    // Optimistic: a spinner on a one-bit change reads as broken.
    if (wasLike) {
      setLiked(!liked);
      setLikes((n) => n + (liked ? -1 : 1));
    } else {
      setSaved(!saved);
    }

    startTransition(async () => {
      const result = await toggleReactionAction(postId, kind);

      if (result.needsSignIn || result.error) {
        // Roll back state *and* count together, so a refusal never leaves a
        // wrong number on screen.
        setLiked(before.liked);
        setSaved(before.saved);
        setLikes(before.likes);

        if (result.needsSignIn) {
          toast.info(result.error ?? 'Sign in first.', {
            action: {
              label: 'Sign in',
              onClick: () =>
                router.push(`/login?next=${encodeURIComponent(location.pathname)}`),
            },
          });
        } else {
          toast.error(result.error ?? 'Something went wrong.');
        }
        return;
      }

      // Trust the server's count over the guess — someone else may have liked
      // it in the meantime.
      if (wasLike) {
        setLiked(Boolean(result.active));
        if (typeof result.count === 'number') setLikes(result.count);
      } else {
        setSaved(Boolean(result.active));
        toast.success(result.active ? 'Saved to your account.' : 'Removed from saved.');
      }
    });
  }

  function toggleFollow() {
    const before = following;
    setFollowing(!following);

    startTransition(async () => {
      const result = await toggleFollowAction(authorId);

      if (result.needsSignIn || result.error) {
        setFollowing(before);
        if (result.needsSignIn) {
          toast.info(result.error ?? 'Sign in to follow writers.', {
            action: {
              label: 'Sign in',
              onClick: () => router.push(`/login?next=${encodeURIComponent(location.pathname)}`),
            },
          });
        } else {
          toast.error(result.error ?? 'Something went wrong.');
        }
        return;
      }

      setFollowing(Boolean(result.following));
      toast.success(
        result.following ? `Following ${authorName}.` : `Unfollowed ${authorName}.`,
      );
    });
  }

  /**
   * Puts the cursor in the composer, not just the thread on screen.
   *
   * A jump link leaves the reader looking at other people's comments with one
   * more scroll to go; the point of pressing this is to write something. If
   * the box is not there — nobody is signed in — the scroll still happens and
   * they land on the sign-in prompt, which is the right next step anyway.
   */
  function openComposer() {
    document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const box = document.getElementById('comment-root');
    if (box instanceof HTMLTextAreaElement) {
      // After the smooth scroll settles, or focus fights it.
      window.setTimeout(() => box.focus({ preventScroll: true }), 450);
    }
  }

  const vertical = orientation === 'vertical';

  const button = cn(
    'group grid place-items-center rounded-full border transition-colors',
    'size-11 border-border bg-surface text-muted',
    'hover:border-accent hover:text-accent focus-visible:border-accent',
    'disabled:opacity-60',
  );

  return (
    <div
      className={cn(
        'flex items-center',
        vertical ? 'flex-col gap-4' : 'flex-wrap gap-3',
        className,
      )}
    >
      <div className={cn('flex items-center', vertical ? 'flex-col gap-1' : 'gap-1.5')}>
        <button
          type="button"
          onClick={() => toggle(ReactionKind.LIKE)}
          disabled={pending}
          aria-pressed={liked}
          aria-label={liked ? 'Remove your like' : 'Like this story'}
          className={cn(button, liked && 'border-accent text-accent')}
        >
          <ThumbsUp className={cn('size-5', liked && 'fill-current')} aria-hidden />
        </button>
        <span className="text-[11px] tabular-nums text-muted" aria-live="polite">
          {likes.toLocaleString()}
        </span>
      </div>

      <div className={cn('flex items-center', vertical ? 'flex-col gap-1' : 'gap-1.5')}>
        <button
          type="button"
          onClick={() => toggle(ReactionKind.SAVE)}
          disabled={pending}
          aria-pressed={saved}
          aria-label={saved ? 'Remove from saved' : 'Save this story'}
          className={cn(button, saved && 'border-accent text-accent')}
        >
          <Bookmark className={cn('size-5', saved && 'fill-current')} aria-hidden />
        </button>
        <span className="text-[11px] text-muted">{saved ? 'Saved' : 'Save'}</span>
      </div>

      {isAuthor === false ? (
        <div className={cn('flex items-center', vertical ? 'flex-col gap-1' : 'gap-1.5')}>
          <button
            type="button"
            onClick={toggleFollow}
            disabled={pending}
            aria-pressed={following}
            aria-label={following ? `Unfollow ${authorName}` : `Follow ${authorName}`}
            className={cn(button, following && 'border-accent text-accent')}
          >
            {following ? (
              <Check className="size-5" aria-hidden />
            ) : (
              <UserPlus className="size-5" aria-hidden />
            )}
          </button>
          <span className="text-[11px] text-muted">{following ? 'Following' : 'Follow'}</span>
        </div>
      ) : null}

      <div className={cn('flex items-center', vertical ? 'flex-col gap-1' : 'gap-1.5')}>
        <button
          type="button"
          onClick={openComposer}
          aria-label={`Write a comment (${commentCount} so far)`}
          className={button}
        >
          <MessageSquare className="size-5" aria-hidden />
        </button>
        <span className="text-[11px] tabular-nums text-muted">{commentCount}</span>
      </div>
    </div>
  );
}
