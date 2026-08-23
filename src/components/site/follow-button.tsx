'use client';

import { Check, Loader2, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { toggleFollowAction } from '@/app/(site)/author/follow-actions';
import { Button } from '@/components/ui/button';

/**
 * Optimistic follow toggle.
 *
 * The count moves before the round trip because the alternative — a spinner on
 * a one-bit change — makes the page feel broken on a slow connection. A failed
 * request puts both the state and the count back exactly as they were, so an
 * optimistic update never leaves a wrong number on screen.
 */
export function FollowButton({
  authorId,
  authorName,
  initialFollowing,
  initialFollowers,
}: {
  authorId: string;
  authorName: string;
  initialFollowing: boolean;
  initialFollowers: number;
}) {
  const router = useRouter();
  const [following, setFollowing] = React.useState(initialFollowing);
  const [followers, setFollowers] = React.useState(initialFollowers);
  const [pending, startTransition] = React.useTransition();

  function toggle() {
    const previous = { following, followers };
    setFollowing(!following);
    setFollowers((n) => n + (following ? -1 : 1));

    startTransition(async () => {
      const result = await toggleFollowAction(authorId);

      if (result.needsSignIn) {
        setFollowing(previous.following);
        setFollowers(previous.followers);
        toast.info('Sign in to follow writers.', {
          action: {
            label: 'Sign in',
            onClick: () => router.push(`/login?next=${encodeURIComponent(location.pathname)}`),
          },
        });
        return;
      }

      if (result.error) {
        setFollowing(previous.following);
        setFollowers(previous.followers);
        toast.error(result.error);
        return;
      }

      // Trust the server's count over the guess — another reader may have
      // followed in the meantime.
      setFollowing(Boolean(result.following));
      if (typeof result.followers === 'number') setFollowers(result.followers);
    });
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        size="sm"
        variant={following ? 'outline' : 'primary'}
        onClick={toggle}
        disabled={pending}
        aria-pressed={following}
        aria-label={following ? `Unfollow ${authorName}` : `Follow ${authorName}`}
      >
        {pending ? (
          <Loader2 className="mr-1.5 size-4 animate-spin" />
        ) : following ? (
          <Check className="mr-1.5 size-4" />
        ) : (
          <UserPlus className="mr-1.5 size-4" />
        )}
        {following ? 'Following' : 'Follow'}
      </Button>

      <span className="text-xs text-muted" aria-live="polite">
        {followers.toLocaleString()} {followers === 1 ? 'follower' : 'followers'}
      </span>
    </div>
  );
}
