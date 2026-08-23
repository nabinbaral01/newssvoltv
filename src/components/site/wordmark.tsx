import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * Two-tone wordmark: "VOLT" in the text colour, "V" in the accent. The split
 * is the whole logo — no glyph, no lockup, nothing to redraw at small sizes.
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
      <span className="text-fg">Volt</span>
      <span className="text-accent">V</span>
    </span>
  );

  if (as === 'plain') return content;

  return (
    <Link href={href} aria-label="Volt V home" className="shrink-0">
      {content}
    </Link>
  );
}
