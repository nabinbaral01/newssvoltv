'use server';

import { Role } from '@prisma/client';
import { headers } from 'next/headers';
import { z } from 'zod';

import { clientIp, hash } from '@/lib/analytics';
import { sendEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

import { TOPICS } from './topics';

export type ContactState = {
  sent?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Echoed back on an error: React resets the form after an action, and
   * losing a long message to one typo is the fastest way to lose the sender. */
  values?: { name: string; email: string; topic: string; message: string };
};

const schema = z.object({
  name: z.string().trim().min(1, 'Tell us your name.').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  topic: z.enum(TOPICS),
  message: z
    .string()
    .trim()
    .min(10, 'A little more detail, please — at least 10 characters.')
    .max(5000, 'Keep it under 5,000 characters.'),
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Where messages go: CONTACT_EMAIL when it is set (comma-separated for more
 * than one inbox), otherwise every admin account. No address is ever printed
 * on the public page, so the inbox behind the form does not collect spam.
 */
async function recipients(): Promise<string[]> {
  const configured = process.env.CONTACT_EMAIL?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (configured?.length) return configured;

  const admins = await prisma.user.findMany({
    where: { role: Role.ADMIN },
    select: { email: true },
  });
  return admins.map((a) => a.email).filter((e): e is string => Boolean(e));
}

export async function sendContactAction(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  // Honeypot: a field people never see. Bots fill every input; a person never
  // touches this one. Report success so the bot learns nothing.
  if (String(formData.get('website') ?? '').trim()) return { sent: true };

  const values = {
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    topic: String(formData.get('topic') ?? ''),
    message: String(formData.get('message') ?? ''),
  };

  const requestHeaders = await headers();
  const ipHash = hash(clientIp(requestHeaders));
  const limit = rateLimit(`contact:${ipHash}`, 3, 900);
  if (!limit.ok) {
    return {
      values,
      error: `You have sent a few messages already. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      fieldErrors[key] ??= issue.message;
    }
    return { values, fieldErrors };
  }

  const { name, email, topic, message } = parsed.data;
  const to = await recipients();
  if (!to.length) {
    console.error('[contact] no recipient: set CONTACT_EMAIL or create an admin account');
    return { values, error: 'The contact form is not available right now. Please try again later.' };
  }

  const subject = `[The Volt V] ${topic} — ${name}`;
  const text = `${topic} message from ${name} <${email}>\n\n${message}\n\nReply to: ${email}`;
  const html = `<p><strong>${escapeHtml(topic)}</strong> message from ${escapeHtml(name)} &lt;<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>&gt;</p>
<p style="white-space:pre-wrap">${escapeHtml(message)}</p>
<p>Reply to: <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>`;

  const results = await Promise.all(to.map((address) => sendEmail({ to: address, subject, html, text })));
  if (!results.some((r) => r.ok)) {
    return { values, error: 'Your message could not be sent. Please try again in a few minutes.' };
  }
  return { sent: true };
}
