import type { Role } from '@prisma/client';

/**
 * How a person is credited in public.
 *
 * `role` is a permission — ADMIN, EDITOR, AUTHOR — and publishing it verbatim
 * would be both an ugly byline and a small disclosure of who holds the keys.
 * So a staff member's own `title` always wins, and the role only supplies a
 * generic fallback for anyone who has not set one.
 */
const ROLE_FALLBACK: Record<Role, string> = {
  ADMIN: 'Editor-in-chief',
  EDITOR: 'Editor',
  AUTHOR: 'Writer',
  READER: 'Contributor',
};

export function bylineTitle(person: { title?: string | null; role: Role }): string {
  return person.title?.trim() || ROLE_FALLBACK[person.role];
}

/** Masthead grouping. Readers never appear, so there is no group for them. */
export const STAFF_GROUPS: { role: Role; heading: string; blurb: string }[] = [
  {
    role: 'ADMIN',
    heading: 'Editorial leadership',
    blurb: 'Sets the brief and has the final word on what runs.',
  },
  {
    role: 'EDITOR',
    heading: 'Editors',
    blurb: 'Commission, edit and publish; they moderate the comments too.',
  },
  {
    role: 'AUTHOR',
    heading: 'Writers',
    blurb: 'Report and review. Their work goes through an editor before it runs.',
  },
];

/**
 * Display name for a social link. The stored key is a slug — "x", "bluesky" —
 * and printing that raw gives an author page a row of lowercase fragments.
 */
const SOCIAL_LABELS: Record<string, string> = {
  x: 'X',
  bluesky: 'Bluesky',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  website: 'Website',
};

export function socialLabel(key: string): string {
  return SOCIAL_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/** Two initials beat one letter when a masthead has several people. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
