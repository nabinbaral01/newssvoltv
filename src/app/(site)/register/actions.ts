'use server';

import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';

import { clientIp, hash } from '@/lib/analytics';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { slugify, uniqueSlug } from '@/lib/slug';
import { registerSchema } from '@/lib/validation';

export type RegisterState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
};

export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const requestHeaders = await headers();
  const limit = rateLimit(`register:${hash(clientIp(requestHeaders))}`, 5, 900);
  if (!limit.ok) {
    return { error: `Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.` };
  }

  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    birthYear: formData.get('birthYear') ?? '',
    gender: formData.get('gender') ?? '',
    country: formData.get('country') ?? '',
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  const { name, email, password, birthYear, gender, country } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { fieldErrors: { email: 'That email address is already registered.' } };
  }

  const slug = await uniqueSlug(slugify(name), async (candidate) =>
    Boolean(await prisma.user.findUnique({ where: { slug: candidate }, select: { id: true } })),
  );

  await prisma.user.create({
    data: {
      name,
      email,
      slug,
      hashedPassword: await bcrypt.hash(password, 10),
      role: Role.READER,
      birthYear,
      gender,
      country,
    },
  });

  return { ok: true };
}
