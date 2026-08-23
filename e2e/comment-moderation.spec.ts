import { expect, test } from '@playwright/test';

import { firstArticleHref, signIn } from './helpers';

test.describe('comment moderation', () => {
  test('a reader comment is held for moderation, then approved by an editor', async ({ page }) => {
    // Comment as a signed-in reader (the editor account works for this too —
    // what matters is that the comment lands in PENDING, not who wrote it).
    await signIn(page, 'author');

    const href = await firstArticleHref(page);
    await page.goto(href);

    const stamp = Date.now();
    const body = `An end-to-end moderation check ${stamp}.`;

    const field = page.getByPlaceholder('Add to the discussion…');
    await expect(field).toBeVisible();
    await field.fill(body);
    await page.getByRole('button', { name: 'Post comment' }).click();

    await expect(page.getByText(/awaiting moderation/i)).toBeVisible({ timeout: 20_000 });

    // It must not be publicly visible before approval.
    await page.reload();
    await expect(page.getByText(body)).toHaveCount(0);

    // An editor approves it from the queue.
    await signIn(page, 'editor');
    await page.goto('/admin/comments?status=PENDING');

    const row = page.locator('li').filter({ hasText: body }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole('button', { name: 'Approve' }).click();

    await expect(page.getByText(/comment\(s\) updated/i)).toBeVisible({ timeout: 20_000 });

    // Now it shows on the article.
    await page.goto(href);
    await expect(page.getByText(body)).toBeVisible({ timeout: 20_000 });
  });

  test('an author cannot reach the moderation queue', async ({ page }) => {
    await signIn(page, 'author');
    await page.goto('/admin/comments');
    await expect(page.getByRole('heading', { name: 'Not your desk' })).toBeVisible();
  });
});
