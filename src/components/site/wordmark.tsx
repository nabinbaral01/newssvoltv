import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * Two-tone wordmark: "VOLT" in the text colour, "V" in the accent. The split
 * is the whole logo — no glyph, no lockup, nothing to redraw at small sizes.
 *
 * "The" is set smaller and muted, the way a masthead article usually is. At
 * full weight it would compete with the name for the eye and make the lockup
 * read as three words instead of one title.
 */
export function Wordmark({
  className,
  href = '/',
  as = 'link',
}: {
  className?: string;
  href?: string;
  as?: 'link' | 'plain';
}) {
  const content = (
    <span
      className={cn(
        'headline inline-flex select-none items-baseline text-3xl font-bold uppercase leading-none tracking-tight',
        className,
      )}
    >
      <span className="mr-[0.28em] text-[0.52em] font-semibold tracking-[0.08em] text-muted">
        The
      </span>
      <span className="text-fg">Volt</span>
      <span className="text-accent">V</span>
    </span>
  );

  if (as === 'plain') return content;

  return (
    <Link href={href} aria-label="The Volt V home" className="shrink-0">
      {content}
    </Link>
  );
}
