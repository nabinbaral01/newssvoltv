/** URL-safe slug: lowercase, ASCII, hyphenated, no leading/trailing junk. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining accents
    .toLowerCase()
    .replace(/[‘’']/g, '') // don't -> dont, not don-t
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
    .replace(/-+$/g, '');
}

/**
 * Appends -2, -3 … until the slug is free. `exists` is injected so this works
 * against Prisma on the server and against an in-memory Set in the seed.
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean> | boolean,
): Promise<string> {
  const root = slugify(base) || 'untitled';
  let candidate = root;
  let n = 2;
  while (await exists(candidate)) {
    candidate = `${root}-${n++}`;
  }
  return candidate;
}
