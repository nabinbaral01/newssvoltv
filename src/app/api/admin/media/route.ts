import { NextResponse, type NextRequest } from 'next/server';

import { clientIp, hash } from '@/lib/analytics';
import { assertCapability, can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
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

  const ids = (await request.json().catch(() => null))?.ids as string[] | undefined;
  if (!ids?.length) return NextResponse.json({ error: 'Nothing selected.' }, { status: 400 });

  const assets = await prisma.mediaAsset.findMany({
    where: { id: { in: ids } },
    select: { id: true, url: true, uploadedById: true },
  });

  // Authors may only remove their own uploads.
  const deletable = can(user.role, 'media.delete.any')
    ? assets
    : assets.filter((asset) => asset.uploadedById === user.id);

  await prisma.mediaAsset.deleteMany({ where: { id: { in: deletable.map((a) => a.id) } } });
  await Promise.all(deletable.map((asset) => deleteStoredFile(asset.url)));

  return NextResponse.json({ deleted: deletable.length, skipped: assets.length - deletable.length });
}
