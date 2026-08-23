import Link from 'next/link';

import { Wordmark } from '@/components/site/wordmark';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <Wordmark as="plain" className="text-4xl" />
        <p className="mt-6 headline text-7xl uppercase text-accent">404</p>
        <h1 className="headline mt-2 text-3xl uppercase">That page has been pulled</h1>
        <p className="mt-2 max-w-md text-sm text-muted">
          The story you were after has moved, been unpublished, or never existed.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:opacity-90"
          >
            Back to the front page
          </Link>
          <Link
            href="/search"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:border-accent"
          >
            Search
          </Link>
        </div>
      </div>
    </div>
  );
}
