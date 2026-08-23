'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/admin/analytics', label: 'Overview' },
  { href: '/admin/analytics/location', label: 'Location' },
  { href: '/admin/analytics/demographics', label: 'Demographics' },
  { href: '/admin/analytics/technology', label: 'Technology' },
  { href: '/admin/analytics/acquisition', label: 'Acquisition' },
  { href: '/admin/analytics/content', label: 'Content' },
  { href: '/admin/analytics/realtime', label: 'Realtime' },
];

/** Sub-navigation that carries the current date range between views. */
export function AnalyticsNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const range = new URLSearchParams();
  for (const key of ['preset', 'from', 'to']) {
    const value = searchParams.get(key);
    if (value) range.set(key, value);
  }
  const suffix = range.toString() ? `?${range.toString()}` : '';

  return (
    <nav
      aria-label="Analytics sections"
      className="no-scrollbar -mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-border pb-2"
    >
      {LINKS.map((link) => {
        const active =
          link.href === '/admin/analytics'
            ? pathname === '/admin/analytics'
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={`${link.href}${suffix}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors',
              active ? 'bg-elevated font-medium text-accent' : 'text-muted hover:text-fg',
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
