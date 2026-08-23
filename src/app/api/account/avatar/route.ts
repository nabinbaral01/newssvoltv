import { NextResponse, type NextRequest } from 'next/server';

import { clientIp, hash } from '@/lib/analytics';
import { currentUser } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { deleteStoredFile, storeFile } from '@/lib/storage';

export const runtime = 'nodejs';

/**
 * Avatar upload for anyone with an account.
 *
 * Deliberately separate from /api/admin/media, which is gated on
 * `media.upload` and writes to the shared library. A reader changing their own
 * picture is not the same act as adding an asset the whole newsroom can use in
 * an article, and widening that capability to READER to save a file would hand
 * every signed-up commenter the media library.
 *
 * So this endpoint does one thing: replace the caller's own `image`. It never
 * creates a MediaAsset row, and the id it writes is always the session's.
 */

/** Tighter than the library's 8MB — a face at 400px does not need more. */
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  // Per account, not per IP: this writes to one row that only its owner can
  // touch, so the thing worth limiting is churn on the storage bucket.
  const limit = rateLimit(`avatar:${user.id}`, 10, 600);
  if (!limit.ok) return tooManyRequests(limit);

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No image received.' }, { status: 400 });
  }
  if (!AVATAR_MIME.has(file.type)) {
    return NextResponse.json(
      { error: 'Use a JPEG, PNG, WebP or AVIF image.' },
      { status: 400 },
    );
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: 'Profile pictures must be under 2MB.' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { image: true },
  });

  try {
    const stored = await storeFile(file);

    await prisma.user.update({ where: { id: user.id }, data: { image: stored.url } });

    // Replacing a picture should not leave the old one on the disk forever.
    // Seeded avatars are shared between demo accounts, so only files this
    // endpoint could have written are removed.
    if (existing?.image && existing.image !== stored.url && existing.image.startsWith('/uploads/')) {
      await deleteStoredFile(existing.image);
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'account.avatar',
        entity: 'User',
        entityId: user.id,
        ipHash: hash(clientIp(request.headers)),
      },
    });

    return NextResponse.json({ url: stored.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed.' },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { image: true },
  });

  await prisma.user.update({ where: { id: user.id }, data: { image: null } });

  if (existing?.image?.startsWith('/uploads/')) await deleteStoredFile(existing.image);

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'account.avatar.remove',
      entity: 'User',
      entityId: user.id,
      ipHash: hash(clientIp(request.headers)),
    },
  });

  return NextResponse.json({ ok: true });
}
