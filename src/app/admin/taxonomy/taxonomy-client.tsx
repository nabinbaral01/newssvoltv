'use client';

import { ChevronDown, ChevronUp, Loader2, Merge, Pencil, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import {
  deleteCategoryAction, deleteTagAction, mergeTagsAction, renameTagAction,
  reorderCategoriesAction, saveCategoryAction, type TaxonomyState,
} from './actions';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/overlay';
import { Badge, Card, CardHeader } from '@/components/ui/surface';

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  colour: string;
  parentId: string | null;
  order: number;
  isActive: boolean;
  postCount: number;
};

export type TagRow = { id: string; name: string; slug: string; useCount: number };

function CategoryForm({
  category,
  categories,
  onDone,
}: {
  category?: CategoryRow;
  categories: CategoryRow[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = React.useActionState<TaxonomyState, FormData>(
    saveCategoryAction,
    {},
  );

  React.useEffect(() => {
    if (state.ok) {
      toast.success(category ? 'Category updated.' : 'Category created.');
      onDone();
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, category, onDone, router]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={category?.id ?? ''} />

      <Field label="Name" htmlFor="cat-name" error={state.fieldErrors?.name}>
        <Input id="cat-name" name="name" defaultValue={category?.name} required />
      </Field>

      <Field label="Slug" htmlFor="cat-slug" hint="Leave blank to derive it from the name.">
        <Input id="cat-slug" name="slug" defaultValue={category?.slug} />
      </Field>

      <Field label="Description" htmlFor="cat-description">
        <Textarea id="cat-description" name="description" defaultValue={category?.description ?? ''} rows={2} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Accent colour" htmlFor="cat-colour" error={state.fieldErrors?.colour}>
          <div className="flex gap-2">
            <Input id="cat-colour" name="colour" defaultValue={category?.colour ?? '#00E88F'} className="font-mono" />
            <input
              type="color"
              aria-label="Pick colour"
              defaultValue={category?.colour ?? '#00E88F'}
              onChange={(e) => {
                const field = document.getElementById('cat-colour') as HTMLInputElement | null;
                if (field) field.value = e.target.value.toUpperCase();
              }}
              className="h-9 w-12 shrink-0 rounded border border-border bg-elevated"
            />
          </div>
        </Field>

        <Field label="Order" htmlFor="cat-order">
          <Input id="cat-order" name="order" type="number" min={0} defaultValue={category?.order ?? 0} />
        </Field>
      </div>

      <Field label="Parent" htmlFor="cat-parent" hint="Optional. One level of nesting only.">
        <Select id="cat-parent" name="parentId" defaultValue={category?.parentId ?? ''}>
          <option value="">None — top level</option>
          {categories
            .filter((c) => c.id !== category?.id && !c.parentId)
            .map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
        </Select>
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="isActive" defaultChecked={category?.isActive ?? true} value="on" />
        Active — appears in navigation
      </label>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {category ? 'Save category' : 'Create category'}
      </Button>
    </form>
  );
}

export function TaxonomyClient({
  categories,
  tags,
}: {
  categories: CategoryRow[];
  tags: TagRow[];
}) {
  const router = useRouter();
  // Optimistic ordering only. Null means "use the server's order", so a refresh
  // after a successful reorder is authoritative rather than fighting local state.
  const [optimisticOrder, setOptimisticOrder] = React.useState<string[] | null>(null);
  const [editing, setEditing] = React.useState<CategoryRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [tagQuery, setTagQuery] = React.useState('');
  const [selectedTags, setSelectedTags] = React.useState<Set<string>>(new Set());
  const [mergeTarget, setMergeTarget] = React.useState('');

  const byId = new Map(categories.map((c) => [c.id, c]));
  const order = optimisticOrder ?? categories.map((c) => c.id);
  const ordered = order.map((id) => byId.get(id)).filter(Boolean) as CategoryRow[];

  /** Keyboard-operable reordering — drag is a nice-to-have, arrows are the API. */
  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOptimisticOrder(next);
    const result = await reorderCategoriesAction(next);
    if (result.error) {
      setOptimisticOrder(null);
      toast.error(result.error);
    } else {
      setOptimisticOrder(null);
      router.refresh();
    }
  };

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(tagQuery.toLowerCase()),
  );

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader
          title="Categories"
          description="The first taxonomy axis — the verticals in the mega-menu."
          action={
            <Dialog open={creating} onOpenChange={setCreating}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4" /> New
                </Button>
              </DialogTrigger>
              <DialogContent title="New category">
                <CategoryForm categories={categories} onDone={() => setCreating(false)} />
              </DialogContent>
            </Dialog>
          }
        />

        <ul className="divide-y divide-border">
          {ordered.map((category, index) => (
            <li key={category.id} className="flex items-center gap-3 p-3">
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full"
                style={{ background: category.colour }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {category.name}
                  {!category.isActive ? <Badge className="ml-2">hidden</Badge> : null}
                </p>
                <p className="truncate text-xs text-muted">
                  /{category.slug} · {category.postCount} post{category.postCount === 1 ? '' : 's'}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${category.name} up`}
                  className="rounded border border-border p-1 text-muted hover:text-fg disabled:opacity-30"
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === ordered.length - 1}
                  aria-label={`Move ${category.name} down`}
                  className="rounded border border-border p-1 text-muted hover:text-fg disabled:opacity-30"
                >
                  <ChevronDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(category)}
                  aria-label={`Edit ${category.name}`}
                  className="rounded border border-border p-1 text-muted hover:text-accent"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`Delete “${category.name}”?`)) return;
                    const result = await deleteCategoryAction(category.id);
                    if (result.error) toast.error(result.error);
                    else {
                      toast.success('Category deleted.');
                      router.refresh();
                    }
                  }}
                  aria-label={`Delete ${category.name}`}
                  className="rounded border border-border p-1 text-muted hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent title={`Edit ${editing?.name ?? ''}`}>
            {editing ? (
              <CategoryForm
                category={editing}
                categories={categories}
                onDone={() => setEditing(null)}
              />
            ) : null}
          </DialogContent>
        </Dialog>
      </Card>

      <Card>
        <CardHeader
          title="Tags"
          description="Granular topics. Far more of these than categories, by design."
          action={<Badge>{tags.length}</Badge>}
        />

        <div className="space-y-3 p-3">
          <Field label="Search tags" htmlFor="tag-filter">
            <Input
              id="tag-filter"
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
              placeholder="Filter…"
            />
          </Field>

          {selectedTags.size > 1 ? (
            <div className="space-y-2 rounded-card border border-accent/40 bg-accent/10 p-3">
              <p className="text-xs font-medium">
                Merge {selectedTags.size} tags into one
              </p>
              <Select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)}>
                <option value="">Keep which tag?</option>
                {[...selectedTags].map((id) => (
                  <option key={id} value={id}>{tags.find((t) => t.id === id)?.name}</option>
                ))}
              </Select>
              <Button
                size="sm"
                disabled={!mergeTarget || busy}
                onClick={async () => {
                  setBusy(true);
                  const result = await mergeTagsAction(mergeTarget, [...selectedTags]);
                  setBusy(false);
                  if (result.error) toast.error(result.error);
                  else {
                    toast.success('Tags merged.');
                    setSelectedTags(new Set());
                    setMergeTarget('');
                    router.refresh();
                  }
                }}
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Merge className="size-3.5" aria-hidden />}
                Merge
              </Button>
            </div>
          ) : null}

          <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto">
            {filteredTags.map((tag) => (
              <li key={tag.id} className="flex items-center gap-2 py-2">
                <Checkbox
                  checked={selectedTags.has(tag.id)}
                  onCheckedChange={(checked) => {
                    const next = new Set(selectedTags);
                    if (checked) next.add(tag.id);
                    else next.delete(tag.id);
                    setSelectedTags(next);
                  }}
                  aria-label={`Select ${tag.name}`}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{tag.name}</span>
                <span className="shrink-0 tabular-nums text-xs text-muted">{tag.useCount}</span>
                <button
                  type="button"
                  onClick={async () => {
                    const name = window.prompt('Rename tag', tag.name);
                    if (!name || name === tag.name) return;
                    const result = await renameTagAction(tag.id, name);
                    if (result.error) toast.error(result.error);
                    else {
                      toast.success('Tag renamed.');
                      router.refresh();
                    }
                  }}
                  aria-label={`Rename ${tag.name}`}
                  className="rounded border border-border p-1 text-muted hover:text-accent"
                >
                  <Pencil className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`Delete the tag “${tag.name}”?`)) return;
                    const result = await deleteTagAction(tag.id);
                    if (result.error) toast.error(result.error);
                    else {
                      toast.success('Tag deleted.');
                      router.refresh();
                    }
                  }}
                  aria-label={`Delete ${tag.name}`}
                  className="rounded border border-border p-1 text-muted hover:text-danger"
                >
                  <Trash2 className="size-3" />
                </button>
              </li>
            ))}
            {!filteredTags.length ? (
              <li className="py-8 text-center text-sm text-muted">No tags match that.</li>
            ) : null}
          </ul>
        </div>
      </Card>
    </div>
  );
}
