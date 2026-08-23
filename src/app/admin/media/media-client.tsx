'use client';

import { AlertTriangle, Loader2, Search, Trash2, Upload } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox, Input } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/surface';
import { cn, formatDate } from '@/lib/utils';

/** What the server sends back when a delete would break something. */
type UsageConflict = {
  id: string;
  filename: string;
  summary: string;
  covers: { title: string; href: string }[];
  inBody: string[];
  avatars: string[];
};

export type MediaRow = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  altText: string | null;
  createdAt: string;
  uploadedBy: string | null;
  usedIn: { title: string; href: string }[];
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaClient({ assets, query }: { assets: MediaRow[]; query: string }) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [conflicts, setConflicts] = React.useState<UsageConflict[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [search, setSearch] = React.useState(query);
  const [dragging, setDragging] = React.useState(false);
  const [detail, setDetail] = React.useState<MediaRow | null>(null);

  React.useEffect(() => {
    if (search === query) return;
    const timer = window.setTimeout(() => {
      router.push(search ? `/admin/media?q=${encodeURIComponent(search)}` : '/admin/media');
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search, query, router]);

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (!list.length) return;
    setUploading(true);
    let failed = 0;
    for (const file of list) {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/admin/media', { method: 'POST', body });
      if (!res.ok) failed += 1;
    }
    setUploading(false);
    if (failed) toast.error(`${failed} file(s) failed to upload.`);
    else toast.success(`${list.length} file(s) uploaded.`);
    router.refresh();
  };

  const remove = async (force = false) => {
    if (!selected.size) return;
    if (!force && !window.confirm(`Delete ${selected.size} file(s)?`)) return;

    const res = await fetch('/api/admin/media', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selected], force }),
    });
    const data = await res.json();

    // 409: the files are still on the site somewhere. Say where, rather than
    // deleting and letting an editor discover the gap from a reader.
    if (res.status === 409) {
      setConflicts(data.inUse ?? []);
      return;
    }
    if (!res.ok) {
      toast.error(data.error ?? 'Delete failed.');
      return;
    }

    const notes: string[] = [];
    if (data.skipped) notes.push(`${data.skipped} skipped (not yours)`);
    if (data.cleared) notes.push(`${data.cleared} reference(s) cleared`);
    if (data.leftInBody) {
      notes.push(`${data.leftInBody} article(s) still embed it — edit those by hand`);
    }
    toast.success(
      `${data.deleted} file(s) deleted${notes.length ? ` · ${notes.join(' · ')}` : ''}.`,
    );

    setConflicts([]);
    setSelected(new Set());
    router.refresh();
  };

  return (
    <div
      className={cn('space-y-3 rounded-card', dragging && 'outline-2 outline-dashed outline-accent')}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void upload(e.dataTransfer.files);
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-md border border-border bg-elevated px-3 focus-within:border-accent">
          <Search className="size-4 shrink-0 text-muted" aria-hidden />
          <label className="sr-only" htmlFor="media-search">Search media</label>
          <input
            id="media-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search filenames and alt text…"
            className="h-full flex-1 bg-transparent text-sm outline-none"
          />
        </div>

        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg hover:opacity-90">
          {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
          Upload
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              const files = e.target.files;
              e.target.value = '';
              if (files) void upload(files);
            }}
          />
        </label>

        {selected.size ? (
          <Button variant="danger" onClick={() => void remove(false)}>
            <Trash2 className="size-4" aria-hidden /> Delete {selected.size}
          </Button>
        ) : null}
      </div>

      {conflicts.length ? (
        <div className="rounded-card border border-warning/50 bg-warning/10 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">
                {conflicts.length === 1
                  ? 'This file is still on the site'
                  : `${conflicts.length} of these files are still on the site`}
              </h3>
              <p className="mt-0.5 text-xs text-muted">
                Deleting removes the picture from every page below. Cover images and profile
                pictures are cleared automatically; anything embedded in an article body has to be
                edited by hand.
              </p>

              <ul className="mt-3 space-y-3">
                {conflicts.map((conflict) => (
                  <li key={conflict.id} className="text-xs">
                    <p className="font-medium">
                      {conflict.filename}
                      <span className="ml-2 font-normal text-muted">{conflict.summary}</span>
                    </p>
                    <ul className="mt-1 space-y-0.5 pl-3 text-muted">
                      {conflict.covers.map((cover) => (
                        <li key={cover.href}>
                          cover ·{' '}
                          <Link href={cover.href} target="_blank" className="hover:text-accent">
                            {cover.title}
                          </Link>
                        </li>
                      ))}
                      {conflict.inBody.map((title) => (
                        <li key={title}>in article body · {title}</li>
                      ))}
                      {conflict.avatars.map((name) => (
                        <li key={name}>profile picture · {name}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="danger" size="sm" onClick={() => void remove(true)}>
                  Delete anyway
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConflicts([])}>
                  Keep them
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-muted">Drag files anywhere on this panel to upload them.</p>

      {assets.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {assets.map((asset) => (
            <li key={asset.id} className="group relative overflow-hidden rounded-card border border-border bg-surface">
              <div className="absolute left-2 top-2 z-10">
                <Checkbox
                  checked={selected.has(asset.id)}
                  onCheckedChange={(checked) => {
                    const next = new Set(selected);
                    if (checked) next.add(asset.id);
                    else next.delete(asset.id);
                    setSelected(next);
                  }}
                  aria-label={`Select ${asset.filename}`}
                  className="bg-bg/80"
                />
              </div>

              <button
                type="button"
                onClick={() => setDetail(asset)}
                className="block w-full text-left"
                aria-label={`Details for ${asset.filename}`}
              >
                <div className="aspect-square w-full bg-elevated">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset.url} alt={asset.altText ?? ''} className="size-full object-cover" loading="lazy" />
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-medium">{asset.filename}</p>
                  <p className="truncate text-[11px] text-muted">
                    {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ''}
                    {formatBytes(asset.sizeBytes)}
                  </p>
                  {asset.usedIn.length ? (
                    <p className="mt-0.5 text-[11px] text-accent">used in {asset.usedIn.length}</p>
                  ) : (
                    <p className="mt-0.5 text-[11px] text-muted">unused</p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Nothing in the library yet"
          description="Upload an image, or drag a few onto this panel."
        />
      )}

      {detail ? (
        <div
          role="dialog"
          aria-label={`Details for ${detail.filename}`}
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-card border border-border bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={detail.url} alt={detail.altText ?? ''} className="max-h-80 w-full bg-elevated object-contain" />
            <div className="space-y-2 p-4 text-sm">
              <p className="font-medium">{detail.filename}</p>
              <dl className="grid grid-cols-2 gap-2 text-xs text-muted">
                <div><dt className="inline">Type: </dt><dd className="inline">{detail.mimeType}</dd></div>
                <div><dt className="inline">Size: </dt><dd className="inline">{formatBytes(detail.sizeBytes)}</dd></div>
                <div><dt className="inline">Dimensions: </dt><dd className="inline">{detail.width ?? '?'}×{detail.height ?? '?'}</dd></div>
                <div><dt className="inline">Uploaded: </dt><dd className="inline">{formatDate(detail.createdAt)}{detail.uploadedBy ? ` by ${detail.uploadedBy}` : ''}</dd></div>
              </dl>
              <p className="text-xs">
                <span className="text-muted">Alt text: </span>
                {detail.altText || <span className="text-warning">none set</span>}
              </p>
              <Input readOnly value={detail.url} onFocus={(e) => e.currentTarget.select()} />
              <div>
                <p className="text-xs font-medium">Used in</p>
                {detail.usedIn.length ? (
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {detail.usedIn.map((use) => (
                      <li key={use.href}>
                        <a href={use.href} className="text-accent hover:underline" target="_blank" rel="noreferrer">
                          {use.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-muted">Nothing references this file.</p>
                )}
              </div>
              <Button variant="outline" onClick={() => setDetail(null)} className="w-full">
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
