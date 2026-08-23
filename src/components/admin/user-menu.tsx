'use client';

import { ExternalLink, LogOut, Moon, Sun, User, UserRound } from 'lucide-react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import * as React from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/overlay';
import { Badge } from '@/components/ui/surface';

export function AdminUserMenu({
  user,
}: {
  user: { name: string; role: string; image: string | null };
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  // Deliberate: the resolved theme is only known on the client, and rendering
  // the wrong icon during hydration is worse than one extra commit.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMounted(true), []);
  const isDark = resolvedTheme === 'dark';

  return (
    <>
      <button
        type="button"
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        aria-label={mounted ? `Switch to ${isDark ? 'light' : 'dark'} theme` : 'Switch theme'}
        className="grid size-8 place-items-center rounded-md text-muted hover:bg-elevated hover:text-fg"
      >
        {mounted && !isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 text-sm hover:border-accent/60"
          >
            <span className="grid size-6 place-items-center overflow-hidden rounded-full bg-accent text-[11px] font-bold text-accent-fg">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="" className="size-full object-cover" />
              ) : (
                user.name.slice(0, 1).toUpperCase()
              )}
            </span>
            <span className="hidden max-w-32 truncate sm:inline">{user.name}</span>
            <Badge tone="accent">{user.role.toLowerCase()}</Badge>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem asChild>
            <Link href="/admin/profile">
              <UserRound className="size-4" /> Your profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/account">
              <User className="size-4" /> Account &amp; privacy
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/" target="_blank">
              <ExternalLink className="size-4" /> View site
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => signOut({ callbackUrl: '/' })}>
            <LogOut className="size-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
