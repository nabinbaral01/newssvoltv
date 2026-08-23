import { expect, type Page } from '@playwright/test';

/** Owned by the suite and reset by global-setup, so a role change in the
 *  admin panel cannot break the assertions. */
export const ACCOUNTS = {
  admin: { email: 'e2e.admin@voltv.test', password: 'e2e-password-2026', role: 'ADMIN' },
  editor: { email: 'e2e.editor@voltv.test', password: 'e2e-password-2026', role: 'EDITOR' },
  author: { email: 'e2e.author@voltv.test', password: 'e2e-password-2026', role: 'AUTHOR' },
} as const;

export async function signIn(page: Page, account: keyof typeof ACCOUNTS) {
  const { email, password } = ACCOUNTS[account];
  // Drop any existing session — /login redirects a signed-in user straight to
  // /account, so switching roles mid-test needs a clean slate.
  await page.context().clearCookies();
  await page.goto('/login');
  // exact: the footer newsletter form also has an "Email address" field.
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/account|\/admin/, { timeout: 30_000 });
}

/** Accepts analytics cookies so the beacon is allowed to fire. */
export async function acceptAnalytics(page: Page) {
  const accept = page.getByRole('button', { name: 'Accept analytics' });
  await expect(accept).toBeVisible({ timeout: 15_000 });
  await accept.click();
  await expect(accept).toBeHidden();
}

/** Content-type slugs share the /[category]/[segment] shape with article slugs. */
const FORMAT_SLUGS = new Set([
  'news', 'features', 'reviews', 'lists', 'interviews', 'trailers', 'opinion',
]);

export async function firstArticleHref(page: Page): Promise<string> {
  await page.goto('/movies');
  const hrefs = await page.locator('a[href^="/movies/"]').evaluateAll((links) =>
    links.map((link) => link.getAttribute('href') ?? ''),
  );
  const article = hrefs.find((href) => {
    const segment = href.split('/')[2]?.split('?')[0];
    return segment && !FORMAT_SLUGS.has(segment);
  });
  if (!article) throw new Error('No article links found on /movies');
  return article;
}
