import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

import { clientIp, hash } from '@/lib/analytics';
import { clearMediaReferences, describeUsage, findMediaUsage } from '@/lib/media-usage';
import { assertCapability, can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { POSTS_TAG } from '@/lib/queries';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { deleteStoredFile, storeFile } from '@/lib/storage';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await assertCapability('media.upload');
  } catch {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 });
  }

  const limit = rateLimit(`upload:${user.id}`, 40, 300);
  if (!limit.ok) return tooManyRequests(limit);

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file received.' }, { status: 400 });
  }

  try {
    const stored = await storeFile(file);
    const altText = String(form?.get('altText') ?? '') || null;

    const asset = await prisma.mediaAsset.create({
      data: { ...stored, altText, uploadedById: user.id },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'media.upload',
        entity: 'MediaAsset',
        entityId: asset.id,
        ipHash: hash(clientIp(request.headers)),
      },
    });

    return NextResponse.json({ asset });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed.' },
      { status: 400 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await assertCapability('media.upload');
  } catch {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 });
  }

  const query = request.nextUrl.searchParams.get('q')?.trim();
  const assets = await prisma.mediaAsset.findMany({
    where: query
      ? {
          OR: [
            { filename: { contains: query, mode: 'insensitive' } },
            { altText: { contains: query, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
    take: 60,
  });

  return NextResponse.json({ assets });
}

export async function DELETE(request: NextRequest) {
  let user;
  try {
    user = await assertCapability('media.upload');
  } catch {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { ids?: string[]; force?: boolean }
    | null;
  const ids = body?.ids;
  if (!ids?.length) return NextResponse.json({ error: 'Nothing selected.' }, { status: 400 });

  const assets = await prisma.mediaAsset.findMany({
    where: { id: { in: ids } },
    select: { id: true, url: true, filename: true, uploadedById: true },
  });

  // Authors may only remove their own uploads.
  const deletable = can(user.role, 'media.delete.any')
    ? assets
    : assets.filter((asset) => asset.uploadedById === user.id);

  // A cover image is a URL on the post, not a foreign key, so deleting the
  // library row breaks articles without warning anyone. Check first, and say
  // what would break rather than finding out from a reader.
  const usages = await Promise.all(
    deletable.map(async (asset) => ({ asset, usage: await findMediaUsage(asset.url) })),
  );
  const inUse = usages.filter((entry) => entry.usage.total > 0);

  if (inUse.length && !body?.force) {
    return NextResponse.json(
      {
        error: 'Still in use',
        inUse: inUse.map(({ asset, usage }) => ({
          id: asset.id,
          filename: asset.filename,
          summary: describeUsage(usage),
          covers: usage.covers.map((c) => ({ title: c.title, href: `/${c.categorySlug}/${c.slug}` })),
          inBody: usage.inBody.map((p) => p.title),
          avatars: usage.avatars.map((a) => a.name),
        })),
      },
      { status: 409 },
    );
  }

  let cleared = 0;
  let leftInBody = 0;
  if (body?.force) {
    for (const { asset, usage } of usages) {
      if (!usage.total) continue;
      cleared += (await clearMediaReferences(asset.url)).cleared;
      leftInBody += usage.inBody.length;
    }
  }

  await prisma.mediaAsset.deleteMany({ where: { id: { in: deletable.map((a) => a.id) } } });
  // Now actually removes the object from Blob/S3, not just the row. Until this
  // did, a deleted picture carried on being served from its public URL.
  await Promise.all(deletable.map((asset) => deleteStoredFile(asset.url)));

  for (const asset of deletable) {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: body?.force ? 'media.delete.force' : 'media.delete',
        entity: 'MediaAsset',
        entityId: asset.id,
        diff: { filename: asset.filename },
        ipHash: hash(clientIp(request.headers)),
      },
    });
  }

  // Cover images live in cached pages; without this the article keeps
  // rendering a URL that now 404s.
  if (cleared) {
    revalidateTag(POSTS_TAG, 'max');
    revalidatePath('/');
  }

  return NextResponse.json({
    deleted: deletable.length,
    skipped: assets.length - deletable.length,
    cleared,
    leftInBody,
  });
}
