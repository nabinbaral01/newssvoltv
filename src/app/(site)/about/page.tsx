import type { Metadata } from 'next';
import Link from 'next/link';

import { JsonLd } from '@/components/site/json-ld';
import { bylineTitle, initials } from '@/lib/byline';
import { buildSafe } from '@/lib/build-safe';
import { prisma } from '@/lib/prisma';
import { getNavigation, getStaffDirectory, publishedWhere } from '@/lib/queries';
import { breadcrumbJsonLd, openGraph, organizationJsonLd, SITE_NAME } from '@/lib/seo';
import { getSettings, SITE_URL } from '@/lib/site';

export const revalidate = 3600;

const DESCRIPTION =
  'The Volt V is an independent entertainment publication covering Marvel and the MCU, film, television, comics, gaming and anime — news, explainers, theories and reviews by named writers.';

export const metadata: Metadata = {
  title: 'About us',
  description: DESCRIPTION,
  alternates: { canonical: '/about' },
  openGraph: openGraph({ type: 'website', url: '/about', title: `About ${SITE_NAME}`, description: DESCRIPTION }),
};

/**
 * Everything specific on this page — the team, what we cover, how much we have
 * published — is read from the database, so it never drifts out of date or
 * claims something the site does not actually do.
 */
export default async function AboutPage() {
  const [settings, staff, nav, storyCount] = await Promise.all([
    getSettings(),
    buildSafe('about: staff', () => getStaffDirectory(), []),
    buildSafe('about: sections', () => getNavigation(), []),
    buildSafe('about: count', () => prisma.post.count({ where: publishedWhere() }), 0),
  ]);

  const writers = staff.filter((person) => person.publishedCount > 0);
  const sections = nav.filter((category) => category.formats.length > 0);
  const sameAs = Object.values(settings['social.links'] ?? {}).filter(Boolean);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: `About ${SITE_NAME}`,
    url: `${SITE_URL}/about`,
    description: DESCRIPTION,
    mainEntity: {
      ...organizationJsonLd(sameAs, settings['site.logo'] || undefined),
      description: DESCRIPTION,
      ...(writers.length
        ? {
            employee: writers.map((person) => ({
              '@type': 'Person',
              name: person.name,
              jobTitle: bylineTitle(person),
              url: `${SITE_URL}/author/${person.slug}`,
            })),
          }
        : {}),
    },
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <JsonLd data={jsonLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'About us', path: '/about' },
        ])}
      />

      <header className="border-b-2 border-accent pb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-muted">About us</p>
        <h1 className="headline mt-1 text-4xl uppercase sm:text-6xl">{SITE_NAME}</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted">{settings['site.tagline']}</p>
      </header>

      <div className="prose-volt mt-8">
        <h2>Who we are</h2>
        <p>
          {SITE_NAME} is an independent entertainment publication for fans who want more than a
          headline. We cover Marvel and the wider MCU, film, television, comics, gaming and anime
          — breaking news, in-depth explainers, fan theories, rankings and reviews.
          {storyCount > 0
            ? ` So far we have published ${storyCount} ${storyCount === 1 ? 'story' : 'stories'}, and we add more every week.`
            : null}
        </p>
        <p>
          Every article on {SITE_NAME} carries the name of the person who wrote it. You can see
          who they are, what they cover and everything they have published on their author page.
        </p>

        <h2>What we cover</h2>
        {sections.length ? (
          <ul>
            {sections.map((section) => (
              <li key={section.slug}>
                <Link href={`/${section.slug}`}>{section.name}</Link>
                {' — '}
                {section.formats.map((format) => format.name).join(', ')}
              </li>
            ))}
          </ul>
        ) : (
          <p>Film, television, comics, gaming and anime.</p>
        )}

        <h2>Our editorial standards</h2>
        <ul>
          <li>
            <strong>Rumours and leaks are labelled as such.</strong> When we report on an
            unconfirmed leak or rumour, we say so clearly, explain where it came from and
            distinguish it from what has been officially announced.
          </li>
          <li>
            <strong>Theories are opinion.</strong> Fan theories and analysis pieces are our
            writers&rsquo; interpretation, published in our Theory section and framed as
            speculation, not fact.
          </li>
          <li>
            <strong>We credit our sources.</strong> When a story builds on someone else&rsquo;s
            reporting, an official announcement or an interview, we link to or name the source.
          </li>
          <li>
            <strong>We correct mistakes.</strong> If we get something wrong, we fix it. You can
            report an error through our{' '}
            <Link href="/contact">contact page</Link>.
          </li>
        </ul>

        <h2>Independence</h2>
        <p>
          {SITE_NAME} is an independent fan publication. We are not affiliated with, endorsed by
          or sponsored by Marvel, Disney, DC, Warner Bros. or any other studio, publisher or
          network we write about. All trademarks, characters and images belong to their
          respective owners and are used for news, commentary and review.
        </p>
        <p>
          The site is supported by advertising. Advertisers have no say over what we write.
        </p>
      </div>

      {writers.length ? (
        <section className="mt-12">
          <h2 className="headline border-b-2 border-accent pb-2 text-2xl uppercase">The team</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {writers.map((person) => (
              <li key={person.slug}>
                <Link
                  href={`/author/${person.slug}`}
                  className="flex h-full gap-4 rounded-card border border-border bg-surface p-4 transition-colors hover:border-accent"
                >
                  <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-elevated text-lg font-bold text-accent">
                    {person.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={person.image} alt="" loading="lazy" className="size-full object-cover" />
                    ) : (
                      initials(person.name)
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{person.name}</p>
                    <p className="text-xs uppercase tracking-widest text-accent">
                      {bylineTitle(person)}
                    </p>
                    {person.bio ? (
                      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted">
                        {person.bio}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            <Link href="/authors" className="text-accent underline underline-offset-2">
              See the full masthead
            </Link>
          </p>
        </section>
      ) : null}

      <section className="mt-12 rounded-card border border-border bg-surface p-6">
        <h2 className="headline text-2xl uppercase">Get in touch</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Story tips, corrections, advertising or just want to say hello?
        </p>
        <Link
          href="/contact"
          className="mt-4 inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90"
        >
          Contact us
        </Link>
      </section>
    </div>
  );
}
