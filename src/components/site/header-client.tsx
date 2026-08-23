'use client';

import { LayoutDashboard, LogOut, Menu, Moon, Search, Sun, User, X } from 'lucide-react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import * as React from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/overlay';
import { Wordmark } from '@/components/site/wordmark';
import type { NavCategory } from '@/lib/queries';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  // Deliberate: the resolved theme is only known on the client, and rendering
  // the wrong icon during hydration is worse than one extra commit.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="grid size-9 place-items-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-fg"
      aria-label={mounted ? `Switch to ${isDark ? 'light' : 'dark'} theme` : 'Switch theme'}
    >
      {mounted && !isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

export function SearchButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Search"
        className="grid size-9 place-items-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-fg"
      >
        <Search className="size-4" />
      </button>
      {open ? (
        <div className="absolute inset-x-0 top-full border-b border-border bg-surface p-3 shadow-lg">
          <form
            className="mx-auto flex max-w-3xl items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!value.trim()) return;
              setOpen(false);
              router.push(`/search?q=${encodeURIComponent(value.trim())}`);
            }}
          >
            <Search className="size-4 shrink-0 text-muted" aria-hidden />
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
              placeholder="Search Volt V…"
              aria-label="Search Volt V"
              className="h-9 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close search"
              className="rounded p-1 text-muted hover:text-fg"
            >
              <X className="size-4" />
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}

export function MegaMenu({ nav }: { nav: NavCategory[] }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  React.useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mega-menu"
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="grid size-9 place-items-center rounded-md text-fg transition-colors hover:bg-elevated"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      <div
        id="mega-menu"
        hidden={!open}
        className="fixed inset-x-0 top-14 z-40 max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-border bg-surface"
      >
        <nav className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-8 px-4 py-8 sm:grid-cols-3 lg:grid-cols-6">
          {nav.map((category) => (
            <div key={category.slug}>
              <Link
                href={`/${category.slug}`}
                onClick={() => setOpen(false)}
                className="headline block border-b-2 pb-1 text-xl uppercase transition-colors hover:text-accent"
                style={{ borderColor: category.colour }}
              >
                {category.name}
              </Link>
              <ul className="mt-2 space-y-1">
                {category.formats.map((format) => (
                  <li key={format.slug}>
                    <Link
                      href={`/${category.slug}/${format.slug}`}
                      onClick={() => setOpen(false)}
                      className="text-sm text-muted transition-colors hover:text-fg"
                    >
                      {format.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-border px-4 py-4">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
            <Link href="/search" onClick={() => setOpen(false)} className="hover:text-fg">Search</Link>
            <Link href="/about/team" onClick={() => setOpen(false)} className="hover:text-fg">Our Team</Link>
            <Link href="/privacy" onClick={() => setOpen(false)} className="hover:text-fg">Privacy</Link>
            <Link href="/rss.xml" onClick={() => setOpen(false)} className="hover:text-fg">RSS</Link>
          </div>
        </div>
      </div>

      {open ? (
        <div
          className="fixed inset-0 top-14 z-30 bg-black/50"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}
    </>
  );
}

export function AccountPill({
  user,
}: {
  user: { name?: string | null; image?: string | null; role: string; slug: string } | null;
}) {
  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex h-9 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90"
      >
        <User className="size-4" aria-hidden />
        <span className="hidden sm:inline">Sign In Now</span>
        <span className="sm:hidden">Sign In</span>
      </Link>
    );
  }

  const canAdmin = ['ADMIN', 'EDITOR', 'AUTHOR'].includes(user.role);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-elevated px-2 pr-3 text-sm font-medium transition-colors hover:border-accent/60"
        >
          <span className="grid size-6 place-items-center overflow-hidden rounded-full bg-accent text-[11px] font-bold text-accent-fg">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="size-full object-cover" />
            ) : (
              (user.name ?? '?').slice(0, 1).toUpperCase()
            )}
          </span>
          <span className="hidden max-w-24 truncate sm:inline">{user.name}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem asChild>
          <Link href="/account">
            <User className="size-4" /> Account
          </Link>
        </DropdownMenuItem>
        {canAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <LayoutDashboard className="size-4" /> Admin panel
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut({ callbackUrl: '/' })}>
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Shell that owns the sticky positioning so the search panel can anchor to it. */
export function HeaderShell({
  nav,
  user,
  className,
}: {
  nav: NavCategory[];
  user: { name?: string | null; image?: string | null; role: string; slug: string } | null;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-border bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/80',
        className,
      )}
    >
      <div className="relative mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:px-4">
        <MegaMenu nav={nav} />
        <Wordmark className="text-2xl sm:text-3xl" />
        <div className="ml-auto flex items-center gap-1">
          <SearchButton />
          <ThemeToggle />
          <AccountPill user={user} />
        </div>
      </div>
    </header>
  );
}
