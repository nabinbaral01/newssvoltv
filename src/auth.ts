import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { notifySignIn } from '@/lib/sign-in-notice';
import { slugify, uniqueSlug } from '@/lib/slug';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: Role;
      slug: string;
    } & DefaultSession['user'];
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

/**
 * JWT sessions, no database adapter. The analytics `VisitSession` model is a
 * different thing entirely, and keeping auth stateless avoids the two ever
 * being confused for one another.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: '/login', error: '/login' },
  trustHost: true,
  providers: [
    ...(googleEnabled
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user?.hashedPassword) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.hashedPassword);
        if (!ok) return null;

        // Before the lastLoginAt write: the notifier reads that column to
        // decide whether this sign-in is worth an email.
        await notifySignIn(user.id, 'password');

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          slug: user.slug,
        };
      },
    }),
  ],
  callbacks: {
    /** Google sign-in provisions a READER on first use and links the account. */
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google' || !user.email) return true;

      const existing = await prisma.user.findUnique({ where: { email: user.email } });
      if (existing) {
        await prisma.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          create: {
            userId: existing.id,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            type: account.type,
            scope: account.scope,
          },
          update: {},
        });
        await notifySignIn(existing.id, 'Google');
        await prisma.user.update({
          where: { id: existing.id },
          data: { lastLoginAt: new Date(), image: existing.image ?? user.image },
        });
        return true;
      }

      const name = user.name ?? profile?.name ?? user.email.split('@')[0];
      const slug = await uniqueSlug(slugify(name), async (candidate) =>
        Boolean(await prisma.user.findUnique({ where: { slug: candidate } })),
      );
      const created = await prisma.user.create({
        data: {
          name,
          email: user.email,
          image: user.image,
          slug,
          role: Role.READER,
          emailVerified: new Date(),
          lastLoginAt: new Date(),
          accounts: {
            create: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              type: account.type,
              scope: account.scope,
            },
          },
        },
      });
      // Brand new account: lastLoginAt was just stamped, so force past the throttle.
      await notifySignIn(created.id, 'Google', { force: true });
      return true;
    },

    async jwt({ token, user, trigger }) {
      if (user?.email) token.email = user.email;
      // Re-read the role on sign-in and on explicit updates so a demotion in
      // the admin panel takes effect without waiting for the token to expire.
      if (user || trigger === 'update' || !token.role) {
        const dbUser = token.email
          ? await prisma.user.findUnique({
              where: { email: token.email },
              select: { id: true, role: true, slug: true, name: true, image: true },
            })
          : null;
        if (dbUser) {
          token.sub = dbUser.id;
          token.role = dbUser.role;
          token.slug = dbUser.slug;
          token.name = dbUser.name;
          token.picture = dbUser.image;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = (token.role as Role) ?? Role.READER;
        session.user.slug = (token.slug as string) ?? '';
      }
      return session;
    },
  },
});

export const GOOGLE_ENABLED = googleEnabled;
