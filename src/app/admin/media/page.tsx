import type { Metadata } from 'next';

import { MediaClient, type MediaRow } from './media-client';
import { PageHeader } from '@/components/admin/page-header';
import { requireCapability } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { MEDIA_DRIVER } from '@/lib/storage';

export const metadata: Metadata = { title: 'Media' };
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ q?: string }> };

export default async function MediaPage({ searchParams }: Props) {
  await requireCapability('media.upload');
  const { q = '' } = await searchParams;

  const assets = await prisma.mediaAsset.findMany({
    where: q
      ? {
          OR: [
            { filename: { contains: q, mode: 'insensitive' } },
            { altText: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
    take: 120,
    include: { uploadedBy: { select: { name: true } } },
  });

  // "Used in" is resolved by matching the URL against post covers and body
  // text — the same check that tells you whether a file is safe to delete.
  const urls = assets.map((asset) => asset.url);
  const usage = urls.length
    ? await prisma.post.findMany({
        where: {
          OR: [
            { coverImage: { in: urls } },
            { ogImage: { in: urls } },
            ...urls.map((url) => ({ bodyText: { contains: url } })),
          ],
        },
        select: {
          title: true,
          slug: true,
          coverImage: true,
          ogImage: true,
          body: true,
          category: { select: { slug: true } },
        },
      })
    : [];

  const usageByUrl = new Map<string, { title: string; href: string }[]>();
  for (const post of usage) {
    const serialised = JSON.stringify(post.body ?? '');
    for (const url of urls) {
      if (post.coverImage === url || post.ogImage === url || serialised.includes(url)) {
        const list = usageByUrl.get(url) ?? [];
        list.push({ title: post.title, href: `/${post.category.slug}/${post.slug}` });
        usageByUrl.set(url, list);
      }
    }
  }

  const rows: MediaRow[] = assets.map((asset) => ({
    id: asset.id,
    url: asset.url,
    filename: asset.filename,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    sizeBytes: asset.sizeBytes,
    altText: asset.altText,
    createdAt: asset.createdAt.toISOString(),
    uploadedBy: asset.uploadedBy?.name ?? null,
    usedIn: usageByUrl.get(asset.url) ?? [],
  }));

  const missingAlt = rows.filter((row) => !row.altText).length;

  return (
    <>
      <PageHeader
        title="Media"
        description={
          <>
            {rows.length} file{rows.length === 1 ? '' : 's'} · storage driver:{' '}
            <code className="rounded bg-elevated px-1">{MEDIA_DRIVER}</code>
            {missingAlt ? ` · ${missingAlt} missing alt text` : ''}
          </>
        }
      />
      <MediaClient assets={rows} query={q} />
    </>
  );
}
