import Link from 'next/link';

import { NewsletterForm } from '@/components/site/newsletter-form';
import { Wordmark } from '@/components/site/wordmark';
import { getSettings } from '@/lib/site';

const SOCIAL_LABELS: Record<string, string> = {
  x: 'X',
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
};

/**
 * Anything stored under a key that is no longer offered is ignored rather than
 * rendered raw. Dropping a platform from the settings form does not delete the
 * value that is already saved, and a footer link reading "bluesky" in lower
 * case is worse than no link at all.
 */
function isSupported(key: string, href: string): boolean {
  return Boolean(SOCIAL_LABELS[key]) && Boolean(href?.trim());
}

export async function SiteFooter() {
  const settings = await getSettings();
  const columns = settings['footer.columns'] ?? [];
  const social = Object.entries(settings['social.links'] ?? {}).filter(([key, href]) =>
    isSupported(key, href),
  );

  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-sm text-sm text-muted">{settings['site.tagline']}</p>

            <h2 className="mt-8 text-xs font-bold uppercase tracking-widest text-fg">Subscribe</h2>
            <NewsletterForm source="footer" className="mt-3 max-w-sm" />

            {social.length ? (
              <>
                <h2 className="mt-8 text-xs font-bold uppercase tracking-widest text-fg">
                  Follow us
                </h2>
                <ul className="mt-3 flex flex-wrap gap-4">
                  {social.map(([key, href]) => (
                    <li key={key}>
                      <a
                        href={href}
                        className="text-sm text-muted transition-colors hover:text-accent"
                        rel="noreferrer noopener me"
                        target="_blank"
                      >
                        {SOCIAL_LABELS[key]}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {columns.map((column) => (
              <div key={column.heading}>
                <h2 className="text-xs font-bold uppercase tracking-widest text-fg">
                  {column.heading}
                </h2>
                <ul className="mt-3 space-y-2">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted transition-colors hover:text-accent"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {settings['site.name']}. All rights reserved.
          </p>
          <p>
            Every property covered on this site is fictional — Volt V is a demonstration
            publication.
          </p>
        </div>
      </div>
    </footer>
  );
}
