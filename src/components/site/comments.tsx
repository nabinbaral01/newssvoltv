import { CommentThread, type ThreadComment } from '@/components/site/comment-thread';
import { currentUser } from '@/lib/permissions';
import { getApprovedComments } from '@/lib/queries';

/**
 * Server half of the comment section: reads the thread once so the markup
 * arrives with the page, then hands it to a client component that can refresh
 * itself after someone posts. See comment-thread.tsx for why that split exists.
 */
export async function Comments({ postId }: { postId: string }) {
  const [comments, user] = await Promise.all([getApprovedComments(postId), currentUser()]);

  const initial: ThreadComment[] = comments.map((comment) => ({
    ...comment,
    createdAt: comment.createdAt.toISOString(),
  }));

  return <CommentThread postId={postId} initial={initial} signedIn={Boolean(user)} />;
}
