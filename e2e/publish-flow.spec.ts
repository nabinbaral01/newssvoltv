import { expect, test } from '@playwright/test';

import { signIn } from './helpers';

test.describe('publishing', () => {
  test('an editor can draft, publish and see the post on the public site', async ({ page }) => {
    await signIn(page, 'editor');

    const stamp = Date.now();
    const title = `E2E Aetherfall Coverage ${stamp}`;

    await page.goto('/admin/posts/new');
    await page.getByPlaceholder('Write the headline').fill(title);
    await page.getByLabel('Standfirst').fill('An end-to-end test wrote this standfirst.');

    // The TipTap canvas is a contenteditable, not an input.
    const canvas = page.locator('.ProseMirror');
    await canvas.click();
    await canvas.pressSequentially('The body of the test article, typed into the composer.');

    await page.getByLabel('Category').selectOption({ label: 'Movies' });
    await page.getByLabel('Content type').selectOption({ label: 'News' });
    await page.getByLabel('Status').selectOption('PUBLISHED');

    await page.getByRole('button', { name: 'Save' }).click();

    // Saving a new post redirects to its edit URL.
    await page.waitForURL(/\/admin\/posts\/[a-z0-9]+$/i, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Edit post' })).toBeVisible();

    // It should now be live under its category.
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    await page.goto(`/movies/${slug}`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  });

  test('an author cannot publish, only submit for review', async ({ page }) => {
    await signIn(page, 'author');
    await page.goto('/admin/posts/new');

    const status = page.getByLabel('Status');
    await expect(status.locator('option[value="PUBLISHED"]')).toHaveCount(0);
    await expect(status.locator('option[value="IN_REVIEW"]')).toHaveCount(1);
    await expect(
      page.getByText('Your role can write and submit for review. An editor publishes.'),
    ).toBeVisible();
  });
});
