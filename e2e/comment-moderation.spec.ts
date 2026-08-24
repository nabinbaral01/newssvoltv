import { expect, test } from '@playwright/test';

import { firstArticleHref, signIn } from './helpers';

test.describe('comment moderation', () => {
  test.describe.configure({ timeout: 120_000 });

  test('a comment appears immediately and can be hidden without destroying it', async ({ page }) => {
    await signIn(page, 'author');

    const href = await firstArticleHref(page);
    await page.goto(href);

    const stamp = Date.now();
    const body = `An end-to-end moderation check ${stamp}.`;

    const field = page.getByPlaceholder('Add to the discussion…');
    await expect(field).toBeVisible();
    await field.fill(body);
    await page.getByRole('button', { name: 'Post comment' }).click();

    // Assert the post itself first. Without this a rate-limited run fails on
    // "comment not visible", which looks like a rendering bug and is not.
    await expect(page.getByText('Posted.')).toBeVisible({ timeout: 20_000 });

    // Live on arrival — and visible without a manual reload, or "posted" would
    // look like it failed.
    await expect(page.getByText(body)).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(page.getByText(body)).toBeVisible({ timeout: 20_000 });

    // An editor hides it. Spam is not delete: the row survives.
    await signIn(page, 'editor');
    await page.goto('/admin/comments?status=APPROVED');

    const row = page.locator('li').filter({ hasText: body }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole('button', { name: 'Mark as spam' }).click();
    await expect(page.getByText(/marked as spam/i)).toBeVisible({ timeout: 20_000 });

    await page.goto(href);
    await expect(page.getByText(body)).toHaveCount(0);

    // Still on file, and reversible — which is the whole point of not deleting.
    await page.goto('/admin/comments?status=SPAM');
    const spammed = page.locator('li').filter({ hasText: body }).first();
    await expect(spammed).toBeVisible({ timeout: 20_000 });
    await spammed.getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByText(/restored/i)).toBeVisible({ timeout: 20_000 });

    await page.goto(href);
    await expect(page.getByText(body)).toBeVisible({ timeout: 20_000 });
  });

  test('an editor cannot delete, only an administrator can', async ({ page }) => {
    await signIn(page, 'editor');
    await page.goto('/admin/comments?status=APPROVED');

    // The button is not offered to an editor at all.
    await expect(page.getByRole('button', { name: 'Delete permanently' })).toHaveCount(0);

    await signIn(page, 'admin');
    await page.goto('/admin/comments?status=APPROVED');
    const anyRow = page.locator('li').filter({ has: page.getByRole('button', { name: 'Delete permanently' }) });
    await expect(anyRow.first()).toBeVisible({ timeout: 20_000 });
  });

  test('an author cannot reach the moderation queue', async ({ page }) => {
    await signIn(page, 'author');
    await page.goto('/admin/comments');
    await expect(page.getByRole('heading', { name: 'Not your desk' })).toBeVisible();
  });
});
