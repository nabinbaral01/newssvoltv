'use server';

import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';
import { z } from 'zod';

import { clientIp, hash } from '@/lib/analytics';
import { passwordChangedEmail, sendEmail } from '@/lib/email';
import { checkResetToken, consumeResetToken } from '@/lib/password-reset';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

export type ResetState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

const schema = z
  .object({
    token: z.string().min(16),
    password: z.string().min(8, 'Use at least 8 characters.').max(200),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'The two passwords do not match.',
    path: ['confirm'],
  });

export async function resetPasswordAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const requestHeaders = await headers();
  const ipHash = hash(clientIp(requestHeaders));

  // Guards against brute-forcing the token space from one source.
  const limit = rateLimit(`reset-submit:${ipHash}`, 10, 900);
  if (!limit.ok) {
    return { error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.` };
  }

  const parsed = schema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? 'form')] ??= issue.message;
    }
    if (fieldErrors.token) return { error: 'That reset link is not valid.' };
    return { fieldErrors };
  }

  const check = await checkResetToken(parsed.data.token);
  if (!check.valid) {
    return {
      error:
        check.reason === 'expired'
          ? 'That link has expired. Request a new one.'
          : check.reason === 'used'
            ? 'That link has already been used. Request a new one.'
            : 'That reset link is not valid.',
    };
  }

  await consumeResetToken(check.tokenId, check.userId, await bcrypt.hash(parsed.data.password, 10));

  await prisma.auditLog.create({
    data: {
      userId: check.userId,
      action: 'password.reset.completed',
      entity: 'User',
      entityId: check.userId,
      ipHash,
    },
  });

  // Tells the real owner if someone else got through the flow.
  const message = passwordChangedEmail(check.name);
  await sendEmail({ to: check.email, ...message });

  return { ok: true };
}
