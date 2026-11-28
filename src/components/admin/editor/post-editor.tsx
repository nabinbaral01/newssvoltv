'use client';

import {
  ChevronDown, Eye, History, ImagePlus, Loader2, Save, Star, Trash2, Upload, X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { TipTapEditor } from './tiptap-editor';
import {
  autosaveAction, deletePostAction, restoreRevisionAction, savePostAction,
  type PostActionState,
} from '@/app/admin/posts/actions';
import { CopyLinkButton } from '@/components/admin/copy-link-button';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { Badge, StatusPill } from '@/components/ui/surface';
import { emptyDoc } from '@/lib/content';
import { slugify } from '@/lib/slug';
import { cn, formatDateTime, relativeTime } from '@/lib/utils';

const AUTOSAVE_MS = 15_000;

/** Covers are shown at most 1600px wide (16:9, 1600x900 is the house size). */
const COVER_MAX_WIDTH = 1600;
/** Already small and the right width? Upload it untouched. */
const COVER_KEEP_BYTES = 400 * 1024;

/**
 * Shrinks a cover in the browser before it is uploaded. A pasted image arrives
 * as an uncompressed PNG, often several megabytes, which would slow every page
 * the cover appears on. Anything wider than 1600px or heavier than 400 KB is
 * redrawn at no more than 1600px wide and saved as WebP. If the browser cannot
 * decode or re-encode it, the original is uploaded unchanged.
 */
async function optimiseCover(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, COVER_MAX_WIDTH / bitmap.width);
    if (scale === 1 && file.size <= COVER_KEEP_BYTES) {
      bitmap.close();
      return file;
    }
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.85),
    );
    // Some browsers fall back to PNG when WebP encoding is unsupported; keep
    // whichever is smaller so optimising never makes a file bigger.
    if (!blob || blob.size >= file.size) return file;
    const base = (file.name || 'cover').replace(/\.[^.]+$/, '') || 'cover';
    const ext = blob.type === 'image/webp' ? 'webp' : 'png';
    return new File([blob], `${base === 'image' ? 'cover' : base}.${ext}`, { type: blob.type });
  } catch {
    return file;
  }
}

export type EditorPost = {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  body: unknown;
  coverImage: string;
  coverAlt: string;
  categoryId: string;
  contentTypeId: string;
  status: string;
  publishedAt: string;
  scheduledFor: string;
  isFeatured: boolean;
  isTrending: boolean;
  isEditorPick: boolean;
  rating: string;
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
  tagIds: string[];
  previewToken: string;
  authorName?: string;
  viewCount?: number;
};

type Option = { id: string; name: string; slug: string };
type TagOption = { id: string; name: string; slug: string };
type Revision = { id: string; title: string; note: string | null; createdAt: string; authorName: string | null };

function Panel({
  title,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <section className="rounded-card border border-border bg-surface">
      <h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-widest text-muted hover:text-fg"
        >
          {title}
          {badge}
          <ChevronDown className={cn('ml-auto size-4 transition-transform', !open && '-rotate-90')} aria-hidden />
        </button>
      </h2>
      {open ? <div className="space-y-3 border-t border-border p-3">{children}</div> : null}
    </section>
  );
}

/** Google-style SERP preview so SEO fields are judged in context. */
function SerpPreview({ title, description, slug, categorySlug }: {
  title: string; description: string; slug: string; categorySlug: string;
}) {
  return (
    <div className="rounded border border-border bg-elevated p-3">
      <p className="truncate text-[11px] text-muted">voltv.example › {categorySlug} › {slug || 'slug'}</p>
      <p className="mt-0.5 line-clamp-2 text-[15px] leading-snug text-[#7aa7ff]">
        {title || 'Your headline will appear here'}
      </p>
      <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted">
        {description || 'The meta description is what shows under the link. Write it deliberately.'}
      </p>
    </div>
  );
}

function CharCounter({ value, min, max }: { value: string; min: number; max: number }) {
  const length = value.length;
  const tone = length === 0 ? 'text-muted' : length < min || length > max ? 'text-warning' : 'text-success';
  return (
    <span className={cn('tabular-nums', tone)}>
      {length}/{max}
      {length > max ? ' — will be truncated' : length && length < min ? ' — a little short' : ''}
    </span>
  );
}

export function PostEditor({
  post,
  categories,
  contentTypes,
  tags,
  revisions = [],
  canPublish,
  canDelete,
}: {
  post: EditorPost;
  categories: Option[];
  contentTypes: Option[];
  tags: TagOption[];
  revisions?: Revision[];
  canPublish: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = React.useActionState<PostActionState, FormData>(
    savePostAction,
    {},
  );

  const [draft, setDraft] = React.useState<EditorPost>(post);
  const [newTags, setNewTags] = React.useState<string[]>([]);
  const [tagQuery, setTagQuery] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(Boolean(post.slug));
  const [lastSaved, setLastSaved] = React.useState<string | null>(null);
  const [autosaving, setAutosaving] = React.useState(false);
  const dirtyRef = React.useRef(false);

  const set = <K extends keyof EditorPost>(key: K, value: EditorPost[K]) => {
    dirtyRef.current = true;
    setDraft((current) => ({ ...current, [key]: value }));
  };

  // Slug follows the headline until an editor takes it over. Derived at render
  // rather than synced in an effect — the effect version renders one frame with
  // a stale slug and shows it in the SEO preview.
  const effectiveSlug = slugTouched ? draft.slug : slugify(draft.title);

  React.useEffect(() => {
    if (state.ok) {
      // Reacting to a completed server action, not deriving state from props.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastSaved(state.savedAt ?? new Date().toISOString());
      dirtyRef.current = false;
      toast.success('Post saved.');
      if (!post.id && state.id) router.replace(`/admin/posts/${state.id}`);
      else router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, post.id, router]);

  // Autosave only ever touches an existing post — creating one needs a category
  // and a content type, which is a decision, not a background action.
  React.useEffect(() => {
    if (!post.id) return;
    const timer = window.setInterval(async () => {
      if (!dirtyRef.current) return;
      setAutosaving(true);
      const result = await autosaveAction(post.id!, draft.title, draft.body);
      setAutosaving(false);
      if ('savedAt' in result) {
        setLastSaved(result.savedAt);
        dirtyRef.current = false;
      }
    }, AUTOSAVE_MS);
    return () => window.clearInterval(timer);
  }, [post.id, draft.title, draft.body]);

  // Warn before losing unsaved work.
  React.useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const selectedContentType = contentTypes.find((t) => t.id === draft.contentTypeId);
  const isReview = selectedContentType?.slug === 'reviews';
  const selectedCategory = categories.find((c) => c.id === draft.categoryId);

  const matchingTags = tags
    .filter((tag) => tag.name.toLowerCase().includes(tagQuery.toLowerCase()))
    .filter((tag) => !draft.tagIds.includes(tag.id))
    .slice(0, 8);

  const exactExists = tags.some((tag) => tag.name.toLowerCase() === tagQuery.trim().toLowerCase());

  const payload = {
    title: draft.title,
    slug: effectiveSlug,
    excerpt: draft.excerpt,
    body: draft.body,
    coverImage: draft.coverImage,
    coverAlt: draft.coverAlt,
    categoryId: draft.categoryId,
    contentTypeId: draft.contentTypeId,
    status: draft.status,
    publishedAt: draft.publishedAt || null,
    scheduledFor: draft.scheduledFor || null,
    isFeatured: draft.isFeatured,
    isTrending: draft.isTrending,
    isEditorPick: draft.isEditorPick,
    rating: isReview ? draft.rating : '',
    metaTitle: draft.metaTitle,
    metaDescription: draft.metaDescription,
    ogImage: draft.ogImage,
    tagIds: draft.tagIds,
    newTags,
  };

  const [coverBusy, setCoverBusy] = React.useState(false);
  const [coverDragging, setCoverDragging] = React.useState(false);
  const coverInputRef = React.useRef<HTMLInputElement>(null);

  async function uploadCover(original: File) {
    if (!original.type.startsWith('image/')) {
      toast.error('That is not an image.');
      return;
    }
    setCoverBusy(true);
    try {
      const file = await optimiseCover(original);
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/admin/media', { method: 'POST', body });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? 'Cover upload failed.');
        return;
      }
      const data = await res.json();
      set('coverImage', data.asset.url);
      if (!draft.ogImage) set('ogImage', data.asset.url);
      toast.success('Cover added.');
    } finally {
      setCoverBusy(false);
    }
  }

  /** Paste from the clipboard: "Copy image" on any web page, or a screenshot. */
  function onCoverPaste(event: React.ClipboardEvent) {
    const file = Array.from(event.clipboardData.files).find((f) => f.type.startsWith('image/'));
    if (file) {
      event.preventDefault();
      void uploadCover(file);
      return;
    }
    // "Copy image address" puts a URL on the clipboard, not the picture itself.
    const text = event.clipboardData.getData('text/plain');
    if (/^https?:\/\//i.test(text.trim())) {
      event.preventDefault();
      toast.error('That is the image address. Right-click the picture and choose "Copy image" instead.');
    }
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={post.id ?? ''} />
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">
            {post.id ? (
              <>
                Editing · {draft.authorName ? `by ${draft.authorName} · ` : ''}
                {lastSaved ? `saved ${relativeTime(lastSaved)}` : 'no changes saved yet'}
                {autosaving ? ' · autosaving…' : ''}
              </>
            ) : (
              'New post'
            )}
          </p>
        </div>

        {post.id ? (
          <>
            <CopyLinkButton
              variant="button"
              post={{
                status: draft.status,
                slug: effectiveSlug,
                categorySlug: selectedCategory?.slug ?? '',
                previewToken: post.previewToken,
              }}
            />
            <Button asChild variant="outline" size="sm">
              <Link href={`/preview/${effectiveSlug}?token=${post.previewToken}`} target="_blank">
                <Eye className="size-4" /> Preview
              </Link>
            </Button>
          </>
        ) : null}

        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          Save
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <div>
            <label htmlFor="post-title" className="sr-only">Headline</label>
            <input
              id="post-title"
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Write the headline"
              className="headline w-full bg-transparent text-3xl uppercase leading-tight outline-none placeholder:text-muted/50 sm:text-4xl"
            />
            {state.fieldErrors?.title ? (
              <p className="mt-1 text-xs text-danger">{state.fieldErrors.title}</p>
            ) : null}
          </div>

          <Field
            label="Standfirst"
            htmlFor="post-excerpt"
            hint="Shown under the headline and used as the fallback meta description."
          >
            <Textarea
              id="post-excerpt"
              value={draft.excerpt}
              onChange={(e) => set('excerpt', e.target.value)}
              rows={2}
              maxLength={400}
            />
          </Field>

          <TipTapEditor value={draft.body ?? emptyDoc()} onChange={(doc) => set('body', doc)} />
        </div>

        <aside className="space-y-3">
          <Panel title="Status & visibility" badge={<StatusPill status={draft.status as 'DRAFT'} />}>
            <Field label="Status" htmlFor="post-status">
              <Select
                id="post-status"
                value={draft.status}
                onChange={(e) => set('status', e.target.value)}
              >
                <option value="DRAFT">Draft</option>
                <option value="IN_REVIEW">In review</option>
                {canPublish ? <option value="SCHEDULED">Scheduled</option> : null}
                {canPublish ? <option value="PUBLISHED">Published</option> : null}
                <option value="ARCHIVED">Archived</option>
              </Select>
            </Field>

            {!canPublish ? (
              <p className="text-xs text-muted">
                Your role can write and submit for review. An editor publishes.
              </p>
            ) : null}

            {draft.status === 'SCHEDULED' ? (
              <Field
                label="Publish at"
                htmlFor="post-scheduled"
                error={state.fieldErrors?.scheduledFor}
              >
                <Input
                  id="post-scheduled"
                  type="datetime-local"
                  value={draft.scheduledFor}
                  onChange={(e) => set('scheduledFor', e.target.value)}
                />
              </Field>
            ) : null}

            {draft.status === 'PUBLISHED' ? (
              <Field label="Published at" htmlFor="post-published" hint="Leave blank to stamp now.">
                <Input
                  id="post-published"
                  type="datetime-local"
                  value={draft.publishedAt}
                  onChange={(e) => set('publishedAt', e.target.value)}
                />
              </Field>
            ) : null}

            {post.id && canDelete ? (
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm('Delete this post permanently?')) return;
                  const result = await deletePostAction(post.id!);
                  if (result.error) toast.error(result.error);
                  else {
                    toast.success('Post deleted.');
                    router.push('/admin/posts');
                  }
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded border border-danger/40 py-1.5 text-xs text-danger hover:bg-danger/10"
              >
                <Trash2 className="size-3.5" aria-hidden /> Delete post
              </button>
            ) : null}
          </Panel>

          <Panel title="Taxonomy">
            <Field label="Category" htmlFor="post-category" error={state.fieldErrors?.categoryId}>
              <Select
                id="post-category"
                value={draft.categoryId}
                onChange={(e) => set('categoryId', e.target.value)}
              >
                <option value="">Choose a vertical…</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </Select>
            </Field>

            <Field
              label="Content type"
              htmlFor="post-content-type"
              hint="The second axis: a post is Movies × Review, not just Movie Reviews."
              error={state.fieldErrors?.contentTypeId}
            >
              <Select
                id="post-content-type"
                value={draft.contentTypeId}
                onChange={(e) => set('contentTypeId', e.target.value)}
              >
                <option value="">Choose a format…</option>
                {contentTypes.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </Select>
            </Field>
          </Panel>

          <Panel title="Tags" badge={<Badge>{draft.tagIds.length + newTags.length}</Badge>}>
            <div className="flex flex-wrap gap-1.5">
              {draft.tagIds.map((id) => {
                const tag = tags.find((t) => t.id === id);
                if (!tag) return null;
                return (
                  <span key={id} className="inline-flex items-center gap-1 rounded-full border border-border bg-elevated px-2 py-0.5 text-xs">
                    {tag.name}
                    <button
                      type="button"
                      aria-label={`Remove ${tag.name}`}
                      onClick={() => set('tagIds', draft.tagIds.filter((t) => t !== id))}
                      className="text-muted hover:text-danger"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                );
              })}
              {newTags.map((name) => (
                <span key={name} className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs text-accent">
                  {name}
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() => setNewTags(newTags.filter((t) => t !== name))}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>

            <Field label="Add a tag" htmlFor="tag-search">
              <Input
                id="tag-search"
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  const name = tagQuery.trim();
                  if (!name) return;
                  const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
                  if (existing) {
                    if (!draft.tagIds.includes(existing.id)) set('tagIds', [...draft.tagIds, existing.id]);
                  } else if (!newTags.includes(name)) {
                    setNewTags([...newTags, name]);
                    dirtyRef.current = true;
                  }
                  setTagQuery('');
                }}
                placeholder="Type to search, Enter to create"
              />
            </Field>

            {tagQuery ? (
              <ul className="max-h-40 space-y-0.5 overflow-y-auto">
                {matchingTags.map((tag) => (
                  <li key={tag.id}>
                    <button
                      type="button"
                      onClick={() => {
                        set('tagIds', [...draft.tagIds, tag.id]);
                        setTagQuery('');
                      }}
                      className="w-full rounded px-2 py-1 text-left text-xs hover:bg-elevated"
                    >
                      {tag.name}
                    </button>
                  </li>
                ))}
                {!exactExists && tagQuery.trim() ? (
                  <li className="px-2 py-1 text-xs text-muted">
                    Press Enter to create “{tagQuery.trim()}”
                  </li>
                ) : null}
              </ul>
            ) : null}
          </Panel>

          <Panel title="Cover image">
            {/* One target for every way an image arrives: click to browse,
                drop a file, or paste (Ctrl+V) an image copied from a web page.
                It is focusable so a paste reaches it after a click. */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Cover image: click to choose, drop a file, or paste an image"
              aria-busy={coverBusy}
              onClick={() => !coverBusy && coverInputRef.current?.click()}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !coverBusy) {
                  e.preventDefault();
                  coverInputRef.current?.click();
                }
              }}
              onPaste={onCoverPaste}
              onDragOver={(e) => {
                e.preventDefault();
                setCoverDragging(true);
              }}
              onDragLeave={() => setCoverDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setCoverDragging(false);
                const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'));
                if (file) void uploadCover(file);
              }}
              className={cn(
                'group relative grid aspect-video w-full cursor-pointer place-items-center overflow-hidden rounded border text-xs text-muted outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40',
                coverDragging ? 'border-accent bg-accent/10' : draft.coverImage ? 'border-border' : 'border-dashed border-border hover:border-accent',
              )}
            >
              {draft.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.coverImage} alt="" className="absolute inset-0 size-full object-cover" />
              ) : null}

              <div
                className={cn(
                  'relative z-10 flex flex-col items-center gap-1 px-3 text-center',
                  draft.coverImage &&
                    !coverBusy &&
                    !coverDragging &&
                    'rounded bg-black/70 px-3 py-2 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100',
                  draft.coverImage && (coverBusy || coverDragging) && 'rounded bg-black/70 px-3 py-2 text-white',
                )}
              >
                {coverBusy ? (
                  <>
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                    <span>Uploading…</span>
                  </>
                ) : coverDragging ? (
                  <span className="font-semibold text-accent">Drop to use as cover</span>
                ) : (
                  <>
                    <ImagePlus className="size-5" aria-hidden />
                    <span className="font-medium">
                      {draft.coverImage ? 'Replace cover' : 'Click, drop or paste an image'}
                    </span>
                    <span className="text-[11px] opacity-80">
                      Copy an image, click here, press Ctrl + V
                    </span>
                  </>
                )}
              </div>
            </div>

            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void uploadCover(file);
              }}
            />

            <button
              type="button"
              disabled={coverBusy}
              onClick={() => coverInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-1.5 rounded border border-border py-1.5 text-xs hover:border-accent hover:text-accent disabled:opacity-50"
            >
              <Upload className="size-3.5" aria-hidden /> Upload cover
            </button>

            <Field
              label="Alt text"
              htmlFor="cover-alt"
              hint="Describe the image. Required for anyone using a screen reader."
            >
              <Input
                id="cover-alt"
                value={draft.coverAlt}
                onChange={(e) => set('coverAlt', e.target.value)}
              />
            </Field>
          </Panel>

          <Panel title="SEO" defaultOpen={false}>
            <SerpPreview
              title={draft.metaTitle || draft.title}
              description={draft.metaDescription || draft.excerpt}
              slug={effectiveSlug}
              categorySlug={selectedCategory?.slug ?? 'category'}
            />

            <Field
              label="URL slug"
              htmlFor="post-slug"
              hint="Keyword-led and stable. Changing it after publication breaks inbound links."
              error={state.fieldErrors?.slug}
            >
              <Input
                id="post-slug"
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set('slug', slugify(e.target.value));
                }}
              />
            </Field>

            <Field
              label="Meta title"
              htmlFor="meta-title"
              hint={<CharCounter value={draft.metaTitle || draft.title} min={40} max={60} />}
            >
              <Input
                id="meta-title"
                value={draft.metaTitle}
                onChange={(e) => set('metaTitle', e.target.value)}
                placeholder={draft.title}
              />
            </Field>

            <Field
              label="Meta description"
              htmlFor="meta-description"
              hint={<CharCounter value={draft.metaDescription || draft.excerpt} min={120} max={155} />}
            >
              <Textarea
                id="meta-description"
                value={draft.metaDescription}
                onChange={(e) => set('metaDescription', e.target.value)}
                rows={3}
                placeholder={draft.excerpt}
              />
            </Field>

            <Field label="Social share image" htmlFor="og-image" hint="Defaults to the cover image.">
              <Input
                id="og-image"
                value={draft.ogImage}
                onChange={(e) => set('ogImage', e.target.value)}
                placeholder={draft.coverImage}
              />
            </Field>
          </Panel>

          <Panel title="Placement" defaultOpen={false}>
            <p className="text-xs leading-relaxed text-muted">
              Manual flags, deliberately. They beat a ranking algorithm until there is enough
              traffic to rank on.
            </p>
            {([
              ['isFeatured', 'Hero slot', 'Top of the homepage'],
              ['isTrending', 'Trending bar', 'The strip under the header'],
              ['isEditorPick', "Editor's pick", 'The picks carousel'],
            ] as const).map(([key, label, hint]) => (
              <label key={key} className="flex items-start gap-2">
                <Checkbox
                  checked={draft[key]}
                  onCheckedChange={(checked) => set(key, checked === true)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm">{label}</span>
                  <span className="block text-xs text-muted">{hint}</span>
                </span>
              </label>
            ))}
          </Panel>

          {isReview ? (
            <Panel title="Review score">
              <Field
                label="Rating out of 10"
                htmlFor="post-rating"
                hint="Shown as stars on the article and in the NewsArticle schema."
              >
                <div className="flex items-center gap-2">
                  <Input
                    id="post-rating"
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    value={draft.rating}
                    onChange={(e) => set('rating', e.target.value)}
                  />
                  <Star className="size-4 shrink-0 fill-accent text-accent" aria-hidden />
                </div>
              </Field>
            </Panel>
          ) : null}

          {revisions.length ? (
            <Panel title="Revision history" defaultOpen={false} badge={<Badge>{revisions.length}</Badge>}>
              <ul className="space-y-1.5">
                {revisions.map((revision) => (
                  <li key={revision.id} className="flex items-start gap-2 text-xs">
                    <History className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{revision.note ?? 'edit'}</p>
                      <p className="text-muted">
                        {formatDateTime(revision.createdAt)}
                        {revision.authorName ? ` · ${revision.authorName}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm('Restore this revision? The current draft is snapshotted first.')) return;
                        const result = await restoreRevisionAction(revision.id);
                        if (result.error) toast.error(result.error);
                        else {
                          toast.success('Revision restored.');
                          router.refresh();
                        }
                      }}
                      className="shrink-0 text-accent hover:underline"
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </aside>
      </div>
    </form>
  );
}
