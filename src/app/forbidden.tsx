import Link from 'next/link';

import { Wordmark } from '@/components/site/wordmark';

/** Rendered by forbidden() when a signed-in role lacks a capability. */
export default function Forbidden() {
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <Wordmark as="plain" className="text-4xl" />
        <p className="headline mt-6 text-7xl uppercase text-accent">403</p>
        <h1 className="headline mt-2 text-3xl uppercase">Not your desk</h1>
        <p className="mt-2 max-w-md text-sm text-muted">
          Your account does not have permission for this part of the admin panel. If that looks
          wrong, an administrator can change your role.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/admin"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:opacity-90"
          >
            Back to the dashboard
          </Link>
          <Link
            href="/"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:border-accent"
          >
            Go to the site
          </Link>
        </div>
      </div>
    </div>
  );
}
