import type { Metadata } from 'next';
import Link from 'next/link';

import { ContactForm } from './contact-form';
import { JsonLd } from '@/components/site/json-ld';
import { breadcrumbJsonLd, openGraph, organizationJsonLd, SITE_NAME } from '@/lib/seo';
import { getSettings, SITE_URL } from '@/lib/site';

const DESCRIPTION =
  'Contact The Volt V — send a story tip, request a correction, or ask about advertising and partnerships.';

export const metadata: Metadata = {
  title: 'Contact us',
  description: DESCRIPTION,
  alternates: { canonical: '/contact' },
  openGraph: openGraph({ type: 'website', url: '/contact', title: 'Contact The Volt V', description: DESCRIPTION }),
};

const SOCIAL_LABELS: Record<string, string> = {
  x: 'X (Twitter)',
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
};

export default async function ContactPage() {
  const settings = await getSettings();
  const social = Object.entries(settings['social.links'] ?? {}).filter(
    ([key, href]) => SOCIAL_LABELS[key] && href,
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: `Contact ${SITE_NAME}`,
    url: `${SITE_URL}/contact`,
    description: DESCRIPTION,
    mainEntity: organizationJsonLd(social.map(([, href]) => href)),
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <JsonLd data={jsonLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Contact us', path: '/contact' },
        ])}
      />

      <header className="border-b-2 border-accent pb-6">
        <h1 className="headline text-4xl uppercase sm:text-6xl">Contact us</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Questions, story tips, corrections or business enquiries — send us a message and a real
          person on the {SITE_NAME} team will read it.
        </p>
      </header>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="contact-form-heading">
          <h2 id="contact-form-heading" className="sr-only">
            Send a message
          </h2>
          <ContactForm />
        </section>

        <aside className="space-y-8 text-sm">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-fg">Story tips</h2>
            <p className="mt-2 leading-relaxed text-muted">
              Know something about an upcoming film, series, comic or game? Choose
              &ldquo;Story tip&rdquo;. We never publish a source&rsquo;s name without permission.
            </p>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-fg">Corrections</h2>
            <p className="mt-2 leading-relaxed text-muted">
              Spotted a mistake? Choose &ldquo;Correction&rdquo; and include the article link. We
              fix confirmed errors promptly and note significant changes on the article.
            </p>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-fg">
              Advertising &amp; partnerships
            </h2>
            <p className="mt-2 leading-relaxed text-muted">
              For advertising, sponsorships or collaborations, choose &ldquo;Advertising&rdquo; or
              &ldquo;Partnership&rdquo; and tell us a little about what you have in mind.
            </p>
          </div>

          {social.length ? (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-fg">Find us on</h2>
              <ul className="mt-2 space-y-1">
                {social.map(([key, href]) => (
                  <li key={key}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer noopener me"
                      className="text-accent underline-offset-2 hover:underline"
                    >
                      {SOCIAL_LABELS[key]}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="leading-relaxed text-muted">
            Want to know who we are first? Read{' '}
            <Link href="/about" className="text-accent underline underline-offset-2">
              about {SITE_NAME}
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
}
