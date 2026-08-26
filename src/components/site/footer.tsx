import Link from 'next/link';

import { NewsletterForm } from '@/components/site/newsletter-form';
import { SocialIcon } from '@/components/site/social-icon';
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
 * Only keys the site still offers are rendered. Dropping a platform from the
 * settings form does not delete the value already saved, and a footer link
 * reading "bluesky" in lower case is worse than no link at all.
 *
 * A platform with no URL yet is still listed. It is on the settings screen
 * waiting to be filled in, and silently hiding it makes the footer look like
 * the setting did not save.
 */
function isSupported(key: string): boolean {
  return Boolean(SOCIAL_LABELS[key]);
}

export async function SiteFooter() {
  const settings = await getSettings();
  const columns = settings['footer.columns'] ?? [];
  const social = Object.entries(settings['social.links'] ?? {}).filter(([key]) =>
    isSupported(key),
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
                <ul className="mt-3 flex flex-wrap gap-2">
                  {social.map(([key, href]) => (
                    <li key={key}>
                      {/* The name moves to aria-label so the mark is not read
                          twice, and the tap target stays 40px square — an icon
                          on its own is well under what a thumb can hit. */}
                      <a
                        href={href || undefined}
                        aria-label={SOCIAL_LABELS[key]}
                        title={SOCIAL_LABELS[key]}
                        className="grid size-10 place-items-center rounded-md border border-border text-muted transition-colors hover:border-accent hover:text-accent focus-visible:border-accent"
                        rel="noreferrer noopener me"
                        target="_blank"
                      >
                        <SocialIcon name={key} />
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

        <div className="mt-12 border-t border-border pt-6 text-center text-xs text-muted">
          <p>
            © {new Date().getFullYear()} {settings['site.name']}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
