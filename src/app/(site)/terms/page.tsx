import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'The terms that apply to reading and commenting on Volt V.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="headline text-4xl uppercase sm:text-5xl">Terms of use</h1>

      <div className="prose-volt mt-8">
        <p>
          These terms apply to everyone who reads, comments on or creates an account with The
          Volt V. By using the site you agree to them.
        </p>

        <h2>Our content</h2>
        <p>
          The Volt V publishes entertainment news, analysis, fan theories and reviews. News is
          reported in good faith from the sources we cite. Rumours and leaks are labelled as
          unconfirmed, and theories and reviews are the opinion of the named writer. We correct
          errors when we find them — you can report one through our{' '}
          <Link href="/contact">contact page</Link>.
        </p>
        <p>
          The Volt V is independent and is not affiliated with or endorsed by any studio,
          publisher or network we cover. Trademarks, characters and images belong to their
          respective owners and are used for news, commentary and review.
        </p>

        <h2>Your account</h2>
        <p>
          You are responsible for keeping your password secure and for anything posted from your
          account. Accounts may be suspended for abuse, spam or impersonation.
        </p>

        <h2>Comments</h2>
        <p>
          Comments are held for moderation before they appear. We remove comments that are
          harassing, hateful, defamatory, off-topic spam or that publish someone else&rsquo;s
          private information. Moderation decisions are ours to make.
        </p>

        <h2>Copying our work</h2>
        <p>
          Our original articles and design belong to The Volt V. Quoting a short extract with a
          link back is fine; republishing whole articles is not.
        </p>

        <h2>No warranty</h2>
        <p>
          The site is provided as-is. We do not guarantee that it will be available without
          interruption or that everything on it is free of error.
        </p>

        <h2>Changes</h2>
        <p>
          These terms may change. Material changes will be flagged on the site before they take
          effect.
        </p>
      </div>
    </div>
  );
}
