import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';

import { clientIp, hash } from '@/lib/analytics';
import { prisma } from '@/lib/prisma';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email().max(254),
  source: z.string().max(64).default('footer'),
});

export async function POST(request: NextRequest) {
  const limit = rateLimit(`newsletter:${hash(clientIp(request.headers))}`, 5, 600);
  if (!limit.ok) return tooManyRequests(limit);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.newsletter.findUnique({ where: { email } });

  if (existing?.confirmed) {
    // Same response either way — subscription status is not ours to disclose.
    return NextResponse.json({ message: 'You are on the list. Thanks for reading.' });
  }

  const confirmToken = crypto.randomUUID();
  await prisma.newsletter.upsert({
    where: { email },
    create: { email, source: parsed.data.source, confirmToken },
    update: { confirmToken, source: parsed.data.source },
  });

  // Double opt-in: the confirmation email is sent by whichever ESP you wire up
  // here. The token is already stored, so /api/newsletter/confirm works today.
  return NextResponse.json({
    message: 'Almost there — check your inbox to confirm.',
    ...(process.env.NODE_ENV === 'development' ? { devConfirmUrl: `/api/newsletter/confirm?token=${confirmToken}` } : {}),
  });
}
