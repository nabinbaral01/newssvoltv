'use client';

import { ArrowUpDown } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { BarList } from '@/components/admin/charts/basic-charts';
import { ChartFrame } from '@/components/admin/charts/chart-frame';
import { Input } from '@/components/ui/field';
import type { PostPerformance } from '@/lib/analytics-queries';
import { cn, compactNumber, formatDuration } from '@/lib/utils';

type Ranked = { label: string; value: number; avgDurationSeconds: number };

type SortKey = 'pageViews' | 'visitors' | 'avgDurationSeconds' | 'avgScrollPercent' | 'comments';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'pageViews', label: 'Views' },
  { key: 'visitors', label: 'Visitors' },
  { key: 'avgDurationSeconds', label: 'Avg. time' },
  { key: 'avgScrollPercent', label: 'Scroll depth' },
  { key: 'comments', label: 'Comments' },
];

export function ContentClient({
  posts,
  authors,
  categories,
  contentTypes,
}: {
  posts: PostPerformance[];
  authors: Ranked[];
  categories: Ranked[];
  contentTypes: Ranked[];
}) {
  const [sort, setSort] = React.useState<SortKey>('pageViews');
  const [query, setQuery] = React.useState('');

  const rows = React.useMemo(() => {
    const filtered = query
      ? posts.filter((post) =>
          `${post.title} ${post.authorName} ${post.categoryName}`.toLowerCase().includes(query.toLowerCase()),
        )
      : posts;
    return [...filtered].sort((a, b) => b[sort] - a[sort]);
  }, [posts, sort, query]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartFrame
          title="Categories"
          description="First axis — the verticals"
          csvName="volt-analytics-categories"
          columns={[
            { key: 'label', label: 'Category' },
            { key: 'value', label: 'Views', align: 'right' },
            { key: 'avgTime', label: 'Avg. time', align: 'right' },
          ]}
          rows={categories.map((row) => ({
            label: row.label,
            value: row.value,
            avgTime: formatDuration(row.avgDurationSeconds),
          }))}
        >
          <BarList data={categories} formatValue={compactNumber} />
        </ChartFrame>

        <ChartFrame
          title="Content types"
          description="Second axis — the formats"
          csvName="volt-analytics-content-types"
          columns={[
            { key: 'label', label: 'Content type' },
            { key: 'value', label: 'Views', align: 'right' },
            { key: 'avgTime', label: 'Avg. time', align: 'right' },
          ]}
          rows={contentTypes.map((row) => ({
            label: row.label,
            value: row.value,
            avgTime: formatDuration(row.avgDurationSeconds),
          }))}
        >
          <BarList data={contentTypes} formatValue={compactNumber} />
        </ChartFrame>

        <ChartFrame
          title="Author leaderboard"
          description="Views on posts published by each writer"
          csvName="volt-analytics-authors"
          columns={[
            { key: 'label', label: 'Author' },
            { key: 'value', label: 'Views', align: 'right' },
            { key: 'avgTime', label: 'Avg. time', align: 'right' },
          ]}
          rows={authors.map((row) => ({
            label: row.label,
            value: row.value,
            avgTime: formatDuration(row.avgDurationSeconds),
          }))}
        >
          <BarList data={authors.slice(0, 10)} formatValue={compactNumber} />
        </ChartFrame>
      </div>

      <ChartFrame
        title="Every post"
        description={`${rows.length} posts with recorded traffic in this period`}
        csvName="volt-analytics-posts"
        columns={[
          { key: 'title', label: 'Title' },
          { key: 'category', label: 'Category' },
          { key: 'contentType', label: 'Content type' },
          { key: 'author', label: 'Author' },
          { key: 'pageViews', label: 'Views', align: 'right' },
          { key: 'visitors', label: 'Visitors', align: 'right' },
          { key: 'avgTime', label: 'Avg. time', align: 'right' },
          { key: 'scroll', label: 'Scroll %', align: 'right' },
          { key: 'comments', label: 'Comments', align: 'right' },
        ]}
        rows={rows.map((post) => ({
          title: post.title,
          category: post.categoryName,
          contentType: post.contentTypeName,
          author: post.authorName,
          pageViews: post.pageViews,
          visitors: post.visitors,
          avgTime: formatDuration(post.avgDurationSeconds),
          scroll: post.avgScrollPercent.toFixed(0),
          comments: post.comments,
        }))}
        actions={
          <div className="w-44">
            <label className="sr-only" htmlFor="content-search">Search posts</label>
            <Input
              id="content-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter…"
              className="h-7 text-xs"
            />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Post</th>
                {SORTS.map((option) => (
                  <th key={option.key} scope="col" className="py-2 pr-3 text-right font-medium">
                    <button
                      type="button"
                      onClick={() => setSort(option.key)}
                      aria-pressed={sort === option.key}
                      className={cn(
                        'inline-flex items-center gap-1 hover:text-fg',
                        sort === option.key && 'text-accent',
                      )}
                    >
                      {option.label}
                      <ArrowUpDown className="size-3" aria-hidden />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 60).map((post, index) => (
                <tr key={post.id} className="border-b border-border/60 last:border-0">
                  <td className="max-w-96 py-2 pr-3">
                    <span className="mr-2 tabular-nums text-muted">{index + 1}</span>
                    <Link
                      href={`/${post.categorySlug}/${post.slug}`}
                      target="_blank"
                      className="hover:text-accent"
                    >
                      {post.title}
                    </Link>
                    <span className="block text-[11px] text-muted">
                      {post.categoryName} · {post.contentTypeName} · {post.authorName}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{compactNumber(post.pageViews)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-muted">{compactNumber(post.visitors)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-muted">
                    {formatDuration(post.avgDurationSeconds)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-muted">
                    {post.avgScrollPercent.toFixed(0)}%
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-muted">{post.comments}</td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted">
                    No posts recorded traffic in this period.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {rows.length > 60 ? (
            <p className="mt-3 text-xs text-muted">
              Showing the top 60. Export the CSV for the full list.
            </p>
          ) : null}
        </div>
      </ChartFrame>
    </div>
  );
}
