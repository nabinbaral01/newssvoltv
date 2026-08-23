'use server';

import { headers } from 'next/headers';
import { z } from 'zod';

import { clientIp, hash } from '@/lib/analytics';
import { passwordResetEmail, sendEmail } from '@/lib/email';
import { issueResetToken, TOKEN_TTL_MINUTES } from '@/lib/password-reset';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { SITE_URL } from '@/lib/site';

export type ForgotState = { sent?: boolean; error?: string; fieldErrors?: Record<string, string> };

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

/**
 * Always reports success.
 *
 * Saying "no account with that address" would turn this form into a free
 * account-enumeration oracle, so the response is identical whether or not the
 * address exists. The rate limit is keyed on IP for the same reason — keying it
 * on the email would leak existence through timing and 429s.
 */
export async function requestResetAction(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const requestHeaders = await headers();
  const ipHash = hash(clientIp(requestHeaders));

  const limit = rateLimit(`reset-request:${ipHash}`, 5, 900);
  if (!limit.ok) {
    return { error: `Too many requests. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.` };
  }

  const parsed = schema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { fieldErrors: { email: 'Enter a valid email address.' } };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, name: true, email: true, hashedPassword: true },
  });

  // A Google-only account has no password to reset. Still reported as sent.
  if (user?.hashedPassword) {
    const { token } = await issueResetToken(user.id, ipHash);
    const url = `${SITE_URL}/reset-password?token=${token}`;
    const message = passwordResetEmail(user.name, url, TOKEN_TTL_MINUTES);

    const result = await sendEmail({ to: user.email, ...message });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: result.ok ? 'password.reset.requested' : 'password.reset.send_failed',
        entity: 'User',
        entityId: user.id,
        ipHash,
      },
    });
  }

  return { sent: true };
}
