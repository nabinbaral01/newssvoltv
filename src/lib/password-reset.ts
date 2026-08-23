import crypto from 'node:crypto';

import { prisma } from './prisma';

/**
 * Password reset tokens.
 *
 * Rules this module exists to enforce:
 *   - the plaintext token is generated once, emailed, and never stored
 *   - only its SHA-256 hash goes in the database
 *   - a token is single-use and expires
 *   - issuing a new one invalidates every outstanding one for that account
 *   - lookups are constant-time by hash, so there is no timing side channel
 */

export const TOKEN_TTL_MINUTES = 60;

/**
 * Invitations get a much longer window than a reset. A reset is answering a
 * request someone made seconds ago; an invitation lands in a colleague's inbox
 * and may sit there over a weekend. An hour would mean most invites are dead
 * before they are opened, and the mitigation for the longer life is the same:
 * single use, invalidated by the next issue, and useless once the password is
 * set.
 */
export const INVITE_TTL_MINUTES = 7 * 24 * 60;

/** URL-safe, 256 bits of entropy. */
function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/** Unsalted SHA-256 is right here: the input is already high-entropy random. */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Issues a reset token, returning the plaintext exactly once.
 * Any outstanding tokens for the account are consumed first, so an older email
 * cannot still be used after a newer one is requested.
 */
export async function issueResetToken(
  userId: string,
  ipHash?: string,
  ttlMinutes: number = TOKEN_TTL_MINUTES,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: { userId, tokenHash: hashToken(token), expiresAt, ipHash },
    }),
  ]);

  return { token, expiresAt };
}

export type TokenCheck =
  | { valid: true; userId: string; tokenId: string; name: string; email: string }
  | { valid: false; reason: 'unknown' | 'expired' | 'used' };

export async function checkResetToken(token: string): Promise<TokenCheck> {
  if (!token || token.length < 16) return { valid: false, reason: 'unknown' };

  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (!row) return { valid: false, reason: 'unknown' };
  if (row.usedAt) return { valid: false, reason: 'used' };
  if (row.expiresAt.getTime() < Date.now()) return { valid: false, reason: 'expired' };

  return {
    valid: true,
    userId: row.user.id,
    tokenId: row.id,
    name: row.user.name,
    email: row.user.email,
  };
}

/**
 * Marks the token used and writes the new password in one transaction, so a
 * crash between the two cannot leave a spent token that still works.
 */
export async function consumeResetToken(
  tokenId: string,
  userId: string,
  hashedPassword: string,
): Promise<void> {
  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: tokenId },
      data: { usedAt: new Date() },
    }),
    // Belt and braces: invalidate anything else outstanding for the account.
    prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({ where: { id: userId }, data: { hashedPassword } }),
  ]);
}

/** Housekeeping for the cron job: spent and expired tokens are dead weight. */
export async function pruneResetTokens(): Promise<number> {
  const { count } = await prisma.passwordResetToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date(Date.now() - 24 * 3_600_000) } },
        { usedAt: { lt: new Date(Date.now() - 24 * 3_600_000) } },
      ],
    },
  });
  return count;
}
