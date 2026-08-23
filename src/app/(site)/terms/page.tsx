import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'The terms that apply to reading and commenting on Volt V.',
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="headline text-4xl uppercase sm:text-5xl">Terms of use</h1>

      <div className="prose-volt mt-8">
        <p>
          Volt V is a demonstration publication. Every film, series, game, studio and person
          covered on this site is fictional, and nothing published here is reporting about any
          real work or real person.
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

        <h2>Content</h2>
        <p>
          Articles, images and design on this site belong to Volt V. Quoting a short extract with
          a link back is fine; republishing whole articles is not.
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
