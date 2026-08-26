import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { LoginForm } from './login-form';
import { GOOGLE_ENABLED } from '@/auth';
import { Wordmark } from '@/components/site/wordmark';
import { currentUser } from '@/lib/permissions';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const user = await currentUser();
  if (user) redirect(next ?? '/account');

  // Only ever redirect within this site.
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : '/account';

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="text-center">
        <Wordmark as="plain" className="text-4xl" />
        <h1 className="headline mt-4 text-3xl uppercase">Sign in</h1>
        <p className="mt-1 text-sm text-muted">
          No account?{' '}
          <Link href="/register" className="text-accent underline underline-offset-2">
            Create one free
          </Link>
        </p>
      </div>

      <div className="mt-8">
        <LoginForm googleEnabled={GOOGLE_ENABLED} next={safeNext} />
      </div>
    </div>
  );
}
