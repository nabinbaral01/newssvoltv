import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { RegisterForm } from './register-form';
import { GOOGLE_ENABLED } from '@/auth';
import { Wordmark } from '@/components/site/wordmark';
import { currentUser } from '@/lib/permissions';

export const metadata: Metadata = {
  title: 'Create an account',
  description: 'Free Volt V account — comment on stories and follow the verticals you care about.',
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
  if (await currentUser()) redirect('/account');

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="text-center">
        <Wordmark as="plain" className="text-4xl" />
        <h1 className="headline mt-4 text-3xl uppercase">Create your account</h1>
        <p className="mt-1 text-sm text-muted">
          Free, no paywall. Already have one?{' '}
          <Link href="/login" className="text-accent underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-8">
        <RegisterForm googleEnabled={GOOGLE_ENABLED} />
      </div>
    </div>
  );
}
