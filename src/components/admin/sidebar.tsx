'use client';

import {
  BarChart3, ChevronLeft, FileText, Image as ImageIcon, LayoutDashboard, Mail,
  MessageSquare, Settings, Tags, UserRound, Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { Wordmark } from '@/components/site/wordmark';
import type { Capability } from '@/lib/permissions';
import { cn } from '@/lib/utils';

const NAV: { href: string; label: string; icon: React.ElementType; capability: Capability }[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, capability: 'admin.access' },
  { href: '/admin/posts', label: 'Posts', icon: FileText, capability: 'post.create' },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3, capability: 'analytics.view' },
  { href: '/admin/comments', label: 'Comments', icon: MessageSquare, capability: 'comment.moderate' },
  { href: '/admin/taxonomy', label: 'Categories & tags', icon: Tags, capability: 'taxonomy.manage' },
  { href: '/admin/media', label: 'Media', icon: ImageIcon, capability: 'media.upload' },
  { href: '/admin/newsletter', label: 'Newsletter', icon: Mail, capability: 'newsletter.manage' },
  { href: '/admin/users', label: 'Users & roles', icon: Users, capability: 'users.manage' },
  { href: '/admin/settings', label: 'Settings', icon: Settings, capability: 'settings.manage' },
  // Last, and available to every role that can reach the panel: an AUTHOR has
  // a byline to maintain even though they can see almost nothing else here.
  { href: '/admin/profile', label: 'Your profile', icon: UserRound, capability: 'admin.access' },
];

const COLLAPSE_KEY = 'volt:admin-sidebar-collapsed';

export function AdminSidebar({ allowed }: { allowed: Capability[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  // Reading localStorage is a client-only external-system sync; doing it in a
  // state initialiser would desync the server render and break hydration.
  React.useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      /* storage blocked — stay expanded */
    }
  }, []);

  const toggle = () => {
    setCollapsed((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const items = NAV.filter((item) => allowed.includes(item.capability));

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface transition-[width] lg:flex',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-border px-3">
        <Link href="/admin" className="min-w-0 truncate">
          {collapsed ? (
            <span className="headline text-2xl font-bold uppercase text-accent">V</span>
          ) : (
            <Wordmark as="plain" className="text-2xl" />
          )}
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="ml-auto grid size-7 place-items-center rounded text-muted hover:bg-elevated hover:text-fg"
        >
          <ChevronLeft className={cn('size-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Admin">
        {items.map((item) => {
          const active =
            item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-elevated font-medium text-accent'
                  : 'text-muted hover:bg-elevated hover:text-fg',
                collapsed && 'justify-center px-0',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-2">
        <Link
          href="/"
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted hover:bg-elevated hover:text-fg',
            collapsed && 'justify-center px-0',
          )}
        >
          <ChevronLeft className="size-4 shrink-0" aria-hidden />
          {collapsed ? <span className="sr-only">Back to site</span> : 'Back to site'}
        </Link>
      </div>
    </aside>
  );
}

/** Mobile equivalent: a scrollable strip across the top. */
export function AdminMobileNav({ allowed }: { allowed: Capability[] }) {
  const pathname = usePathname();
  const items = NAV.filter((item) => allowed.includes(item.capability));

  return (
    <nav
      aria-label="Admin"
      className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border bg-surface px-2 py-2 lg:hidden"
    >
      {items.map((item) => {
        const active =
          item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs',
              active ? 'bg-elevated text-accent' : 'text-muted',
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
