'use client';

import { Loader2, MessageSquare, Trash2, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { bulkPostAction, type BulkAction } from './actions';
import { CopyLinkButton } from '@/components/admin/copy-link-button';
import { Button } from '@/components/ui/button';
import { Checkbox, Input, Select } from '@/components/ui/field';
import { StatusPill } from '@/components/ui/surface';
import { compactNumber, formatDate } from '@/lib/utils';

export type PostRow = {
  id: string;
  title: string;
  slug: string;
  status: 'DRAFT' | 'IN_REVIEW' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt: string | null;
  scheduledFor: string | null;
  viewCount: number;
  comments: number;
  authorName: string;
  categoryName: string;
  categorySlug: string;
  contentTypeName: string;
  isFeatured: boolean;
  isTrending: boolean;
  previewToken: string;
  deletedAt: string | null;
  deletedByName: string | null;
};

type Option = { id: string; name: string };

export function PostsTable({
  posts,
  categories,
  contentTypes,
  authors,
  filters,
  canBulkEdit,
  canDelete,
  canPublish,
  inTrash = false,
  isAdmin = false,
}: {
  posts: PostRow[];
  categories: Option[];
  contentTypes: Option[];
  authors: Option[];
  filters: { q: string; status: string; category: string; contentType: string; author: string; from: string; to: string };
  canBulkEdit: boolean;
  canDelete: boolean;
  canPublish: boolean;
  inTrash?: boolean;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [query, setQuery] = React.useState(filters.q);

  const setParam = React.useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value) next.delete(key);
        else next.set(key, value);
      }
      next.delete('page');
      router.push(`${pathname}?${next.toString()}`);
    },
    [pathname, router, searchParams],
  );

  // Debounced search so every keystroke is not a round trip.
  React.useEffect(() => {
    if (query === filters.q) return;
    const timer = window.setTimeout(() => setParam({ q: query || null }), 350);
    return () => window.clearTimeout(timer);
  }, [query, filters.q, setParam]);

  const allSelected = posts.length > 0 && selected.size === posts.length;

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(posts.map((post) => post.id)));

  const runBulk = async (action: BulkAction) => {
    if (!selected.size) return;

    // Deleting is reversible now, so the confirmation says so rather than
    // warning about something that is not true.
    if (action === 'delete') {
      const ok = window.confirm(
        `Move ${selected.size} post(s) to Trash?\n\nThey stay recoverable for 30 days.`,
      );
      if (!ok) return;
    }

    // Purging is the one step with no way back, so a click is not enough.
    if (action === 'purge') {
      const typed = window.prompt(
        `Permanently delete ${selected.size} post(s)?\n\n` +
          'This cannot be undone — comments and revisions go with them.\n' +
          'Type DELETE to confirm.',
      );
      if (typed !== 'DELETE') return;
    }

    setBusy(true);
    const result = await bulkPostAction(action, [...selected]);
    setBusy(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    const verb =
      action === 'delete'
        ? 'moved to Trash'
        : action === 'restore'
          ? 'restored'
          : action === 'purge'
            ? 'permanently deleted'
            : 'updated';
    toast.success(`${result.affected} post(s) ${verb}.`);
    setSelected(new Set());
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <label className="sr-only" htmlFor="post-search">Search posts</label>
          <Input
            id="post-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search headlines…"
          />
        </div>

        <label className="sr-only" htmlFor="filter-status">Status</label>
        <Select id="filter-status" value={filters.status} onChange={(e) => setParam({ status: e.target.value || null })}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="IN_REVIEW">In review</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </Select>

        <label className="sr-only" htmlFor="filter-category">Category</label>
        <Select id="filter-category" value={filters.category} onChange={(e) => setParam({ category: e.target.value || null })}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </Select>

        <label className="sr-only" htmlFor="filter-type">Content type</label>
        <Select id="filter-type" value={filters.contentType} onChange={(e) => setParam({ contentType: e.target.value || null })}>
          <option value="">All formats</option>
          {contentTypes.map((type) => (
            <option key={type.id} value={type.id}>{type.name}</option>
          ))}
        </Select>

        <label className="sr-only" htmlFor="filter-author">Author</label>
        <Select id="filter-author" value={filters.author} onChange={(e) => setParam({ author: e.target.value || null })}>
          <option value="">All authors</option>
          {authors.map((author) => (
            <option key={author.id} value={author.id}>{author.name}</option>
          ))}
        </Select>
      </div>

      <div className="grid gap-2 sm:grid-cols-[auto_auto_1fr] sm:items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted" htmlFor="filter-from">From</label>
          <Input id="filter-from" type="date" value={filters.from} onChange={(e) => setParam({ from: e.target.value || null })} className="w-40" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted" htmlFor="filter-to">To</label>
          <Input id="filter-to" type="date" value={filters.to} onChange={(e) => setParam({ to: e.target.value || null })} className="w-40" />
        </div>
        {Object.values(filters).some(Boolean) ? (
          <button
            type="button"
            onClick={() => router.push(pathname)}
            className="justify-self-start text-xs text-accent hover:underline sm:justify-self-end"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {selected.size ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-card border border-accent/40 bg-accent/10 px-3 py-2 text-sm"
        >
          <span className="font-medium">{selected.size} selected</span>

          {/* Trash offers only the two operations that make sense there. */}
          {inTrash ? (
            <>
              <Button size="sm" onClick={() => runBulk('restore')} disabled={busy}>
                {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Undo2 className="size-3.5" aria-hidden />}
                Restore
              </Button>
              {isAdmin ? (
                <Button size="sm" variant="danger" onClick={() => runBulk('purge')} disabled={busy}>
                  <Trash2 className="size-3.5" aria-hidden />
                  Delete permanently
                </Button>
              ) : (
                <span className="text-xs text-muted">
                  Only an administrator can delete permanently.
                </span>
              )}
            </>
          ) : (
            <>
              {canPublish ? (
                <Button size="sm" variant="secondary" onClick={() => runBulk('publish')} disabled={busy}>
                  Publish
                </Button>
              ) : null}
              {canBulkEdit ? (
                <>
                  <Button size="sm" variant="secondary" onClick={() => runBulk('draft')} disabled={busy}>
                    Back to draft
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => runBulk('archive')} disabled={busy}>
                    Archive
                  </Button>
                </>
              ) : null}
              {canDelete ? (
                <Button size="sm" variant="danger" onClick={() => runBulk('delete')} disabled={busy}>
                  {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Trash2 className="size-3.5" aria-hidden />}
                  Move to Trash
                </Button>
              ) : null}
            </>
          )}
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted hover:text-fg">
            Clear selection
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[52rem] text-sm">
          <caption className="sr-only">Posts, filtered by the controls above</caption>
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="w-10 p-3">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all posts" />
              </th>
              <th scope="col" className="p-3 font-medium">Title</th>
              <th scope="col" className="p-3 font-medium">Author</th>
              <th scope="col" className="p-3 font-medium">Section</th>
              <th scope="col" className="p-3 font-medium">Status</th>
              <th scope="col" className="p-3 font-medium">Date</th>
              <th scope="col" className="p-3 text-right font-medium">Views</th>
              <th scope="col" className="p-3 text-right font-medium">Comments</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="border-b border-border/60 last:border-0 hover:bg-elevated/50">
                <td className="p-3">
                  <Checkbox
                    checked={selected.has(post.id)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selected);
                      if (checked) next.add(post.id);
                      else next.delete(post.id);
                      setSelected(next);
                    }}
                    aria-label={`Select ${post.title}`}
                  />
                </td>
                <td className="max-w-80 p-3">
                  <Link href={`/admin/posts/${post.id}`} className="line-clamp-2 font-medium hover:text-accent">
                    {post.title}
                  </Link>
                  <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                    {post.isFeatured ? <span className="text-accent">Hero</span> : null}
                    {post.isTrending ? <span className="text-accent">Trending</span> : null}
                    {post.status === 'PUBLISHED' ? (
                      <Link href={`/${post.categorySlug}/${post.slug}`} target="_blank" className="hover:text-fg">
                        View →
                      </Link>
                    ) : null}
                  </span>
                </td>
                <td className="p-3 text-muted">{post.authorName}</td>
                <td className="p-3 text-xs text-muted">
                  {post.categoryName}
                  <span className="block">{post.contentTypeName}</span>
                </td>
                <td className="p-3"><StatusPill status={post.status} /></td>
                <td className="p-3 text-xs text-muted">
                  {post.deletedAt
                    ? `deleted ${formatDate(post.deletedAt)}${post.deletedByName ? ` by ${post.deletedByName}` : ''}`
                    : post.publishedAt
                    ? formatDate(post.publishedAt)
                    : post.scheduledFor
                      ? `→ ${formatDate(post.scheduledFor)}`
                      : '—'}
                </td>
                <td className="p-3 text-right tabular-nums">{compactNumber(post.viewCount)}</td>
                <td className="p-3 text-right tabular-nums text-muted">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="size-3" aria-hidden />
                      {post.comments}
                    </span>
                    <CopyLinkButton post={post} />
                  </span>
                </td>
              </tr>
            ))}
            {!posts.length ? (
              <tr>
                <td colSpan={8} className="p-10 text-center text-muted">
                  No posts match those filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
