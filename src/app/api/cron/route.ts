import { PostStatus } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { NAV_TAG, POSTS_TAG } from '@/lib/queries';
import { pruneResetTokens } from '@/lib/password-reset';
import { pruneRawEvents, rebuildRollups } from '../../../../scripts/rollup.mts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Scheduled maintenance, in one authenticated endpoint.
 *
 *   ?job=rollup     rebuild the last few days of DailyMetric (nightly)
 *   ?job=publish    release SCHEDULED posts whose time has come (every 5 min)
 *   ?job=retention  delete raw events past the retention window (weekly)
 *   ?job=all        all three, in that order
 *
 * Vercel Cron sends the Authorization header from CRON_SECRET; anything else
 * has to present it explicitly.
 */
function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';

  const header = request.headers.get('authorization');
  if (header === `Bearer ${secret}`) return true;
  return request.nextUrl.searchParams.get('secret') === secret;
}

/** Releases scheduled posts. Idempotent: re-running publishes nothing twice. */
async function publishScheduled() {
  const due = await prisma.post.findMany({
    where: { status: PostStatus.SCHEDULED, scheduledFor: { lte: new Date() } },
    select: { id: true, slug: true, scheduledFor: true, category: { select: { slug: true } } },
  });

  for (const post of due) {
    await prisma.post.update({
      where: { id: post.id },
      data: {
        status: PostStatus.PUBLISHED,
        publishedAt: post.scheduledFor ?? new Date(),
        scheduledFor: null,
      },
    });
    revalidatePath(`/${post.category.slug}/${post.slug}`);
    revalidatePath(`/${post.category.slug}`);
  }

  if (due.length) {
    // A route handler is not a Server Action, so this is revalidateTag, not
    // updateTag — there is no own-write to read back here.
    revalidateTag(POSTS_TAG, 'max');
    revalidateTag(NAV_TAG, 'max');
    revalidatePath('/');
    revalidatePath('/sitemap.xml', 'page');
    revalidatePath('/rss.xml', 'page');

    await prisma.auditLog.create({
      data: {
        action: 'post.publish.scheduled',
        entity: 'Post',
        entityId: due[0].id,
        diff: { published: due.map((post) => post.slug) },
      },
    });
  }

  return { published: due.length, slugs: due.map((post) => post.slug) };
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
  }

  const job = request.nextUrl.searchParams.get('job') ?? 'all';
  const days = Number(request.nextUrl.searchParams.get('days') ?? 3);
  const started = Date.now();
  const results: Record<string, unknown> = {};

  try {
    if (job === 'publish' || job === 'all') {
      results.publish = await publishScheduled();
    }

    if (job === 'rollup' || job === 'all') {
      const to = new Date();
      const from = new Date(to.getTime() - days * 86_400_000);
      results.rollup = { days, rows: await rebuildRollups(prisma, { from, to }) };
    }

    if (job === 'retention' || job === 'all') {
      results.retention = {
        ...(await pruneRawEvents(prisma, 14)),
        resetTokens: await pruneResetTokens(),
      };
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Job failed', results },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, job, ms: Date.now() - started, results });
}
