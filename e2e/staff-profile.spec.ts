import { expect, test } from '@playwright/test';

import { ACCOUNTS, signIn } from './helpers';

/**
 * A byline is public, permanent and attached to someone's name, so the parts
 * that matter here are: it saves, it reaches the public page, and the fields
 * only an admin may touch stay out of everyone else's form.
 */
test.describe('staff profiles', () => {
  test('an author can set their own byline and it reaches the public page', async ({ page }) => {
    await signIn(page, 'author');
    await page.goto('/admin/profile');

    const title = `Contributing Critic ${Date.now().toString().slice(-5)}`;
    const bio = 'Covers independent film and the occasional prestige box set.';

    await page.getByLabel('Job title').fill(title);
    await page.getByLabel('Bio').fill(bio);
    await page.getByLabel('X / Twitter').fill('https://x.com/e2e-author');
    await page.getByRole('button', { name: 'Save profile' }).click();

    await expect(page.getByText('Profile saved.')).toBeVisible({ timeout: 15_000 });

    // The whole point of the feature: what readers see, not what the form says.
    await page.goto('/author/e2e-author');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('E2E Author');
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText(bio)).toBeVisible();
    // Scoped: the site footer carries its own "X" link on every page.
    const elsewhere = page.getByRole('navigation', { name: 'E2E Author elsewhere' });
    await expect(elsewhere.getByRole('link', { name: 'X' })).toHaveAttribute(
      'href',
      'https://x.com/e2e-author',
    );
  });

  test('the author URL is admin-only', async ({ page }) => {
    await signIn(page, 'author');
    await page.goto('/admin/profile');
    // Present for an admin; absent here, because renaming the slug 404s every
    // article this person has written.
    await expect(page.getByLabel('Author URL')).toHaveCount(0);
    await expect(page.getByLabel('Job title')).toBeVisible();

    await signIn(page, 'admin');
    await page.goto('/admin/profile');
    await expect(page.getByLabel('Author URL')).toBeVisible();
  });

  test('a script URL is rejected server-side', async ({ page }) => {
    await signIn(page, 'editor');
    await page.goto('/admin/profile');

    // `javascript:` is a *valid* absolute URL, so <input type="url"> lets it
    // through — the browser is no defence here. These values are rendered
    // straight into an href, so the server schema is what has to catch it.
    await page.getByLabel('LinkedIn').fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Save profile' }).click();

    await expect(page.getByText('Links must start with http:// or https://')).toBeVisible({
      timeout: 15_000,
    });

    // And nothing was written: a partial save would store the good fields and
    // silently drop the bad one.
    await page.goto('/author/e2e-editor');
    await expect(page.getByRole('link', { name: 'LinkedIn' })).toHaveCount(0);
  });

  test('a bare handle is caught before submission', async ({ page }) => {
    await signIn(page, 'editor');
    await page.goto('/admin/profile');

    // The mistake people actually make. type="url" catches this one in the
    // browser, which is a better experience than a round trip.
    const linkedin = page.getByLabel('LinkedIn');
    await linkedin.fill('linkedin.com/in/nope');
    await page.getByRole('button', { name: 'Save profile' }).click();

    await expect(linkedin).toHaveJSProperty('validity.valid', false);
  });

  test('the masthead lists staff by role and excludes readers', async ({ page }) => {
    await page.goto('/authors');

    await expect(page.getByRole('heading', { name: 'Our writers' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Editorial leadership' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Writers', exact: true })).toBeVisible();

    // Every card links to a real author page.
    const first = page.locator('a[href^="/author/"]').first();
    await expect(first).toBeVisible();
    await first.click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // A reader account has no byline and must not be listed.
    await page.goto('/authors');
    await expect(page.getByText(ACCOUNTS.admin.email)).toHaveCount(0);
  });
});
