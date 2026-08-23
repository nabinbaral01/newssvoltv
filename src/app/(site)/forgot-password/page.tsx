import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ForgotPasswordForm } from './forgot-form';
import { Wordmark } from '@/components/site/wordmark';
import { EMAIL_ENABLED } from '@/lib/email';
import { currentUser } from '@/lib/permissions';

export const metadata: Metadata = {
  title: 'Forgot your password',
  robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage() {
  if (await currentUser()) redirect('/account');

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="text-center">
        <Wordmark as="plain" className="text-4xl" />
        <h1 className="headline mt-4 text-3xl uppercase">Forgot your password</h1>
        <p className="mt-1 text-sm text-muted">
          Enter your email and we&rsquo;ll send you a link to set a new one.
        </p>
      </div>

      <div className="mt-8">
        <ForgotPasswordForm />
      </div>

      {!EMAIL_ENABLED ? (
        <p className="mt-6 rounded-card border border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed text-warning">
          <strong>Development mode:</strong> RESEND_API_KEY is not set, so reset links are printed
          to the server console instead of emailed. The rest of the flow behaves identically.
        </p>
      ) : null}
    </div>
  );
}
