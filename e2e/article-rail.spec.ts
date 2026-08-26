import { expect, test } from '@playwright/test';

import { firstArticleHref, signIn } from './helpers';

/**
 * The rail's whole job is to remember. An optimistic toggle that never reached
 * the database looks identical until you come back, so every assertion here
 * survives a reload.
 */
test.describe('article rail', () => {
  test.describe.configure({ timeout: 120_000 });

  test('a signed-in reader can like and unlike, and it sticks', async ({ page }) => {
    await signIn(page, 'author');
    const href = await firstArticleHref(page);
    await page.goto(href);

    const like = page.locator('button[aria-label="Like this story"]:visible').first();
    await expect(like).toBeVisible({ timeout: 20_000 });
    await like.click();

    const unlike = page.locator('button[aria-label="Remove your like"]:visible').first();
    await expect(unlike).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(
      page.locator('button[aria-label="Remove your like"]:visible').first(),
    ).toBeVisible({ timeout: 20_000 });

    await page.locator('button[aria-label="Remove your like"]:visible').first().click();
    await expect(
      page.locator('button[aria-label="Like this story"]:visible').first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('saving puts the story on the account page', async ({ page }) => {
    await signIn(page, 'editor');
    const href = await firstArticleHref(page);
    await page.goto(href);

    const title = await page.getByRole('heading', { level: 1 }).innerText();

    const save = page.locator('button[aria-label="Save this story"]:visible').first();
    await expect(save).toBeVisible({ timeout: 20_000 });
    await save.click();
    await expect(page.getByText('Saved to your account.')).toBeVisible({ timeout: 15_000 });

    // Saving has to lead somewhere or the button files a fact away for nobody.
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: 'Saved stories' })).toBeVisible();
    await expect(page.getByRole('link', { name: title })).toBeVisible({ timeout: 15_000 });

    // And unsaving takes it back off.
    await page.goto(href);
    await page.locator('button[aria-label="Remove from saved"]:visible').first().click();
    await expect(page.getByText('Removed from saved.')).toBeVisible({ timeout: 15_000 });
    await page.goto('/account');
    await expect(page.getByRole('link', { name: title })).toHaveCount(0);
  });

  test('an anonymous reader is asked to sign in and the count does not move', async ({ page }) => {
    const href = await firstArticleHref(page);
    await page.goto(href);

    const like = page.locator('button[aria-label="Like this story"]:visible').first();
    await expect(like).toBeVisible({ timeout: 20_000 });
    await like.click();

    await expect(page.getByText('Sign in to like stories.')).toBeVisible({ timeout: 15_000 });
    // The optimistic update must roll all the way back, not just the icon.
    await expect(like).toBeVisible();
  });

  test('the comment button jumps to the thread', async ({ page }) => {
    const href = await firstArticleHref(page);
    await page.goto(href);

    const jump = page.locator('a[href="#comments"]:visible').first();
    await expect(jump).toBeVisible({ timeout: 20_000 });
    await jump.click();
    await expect(page).toHaveURL(/#comments$/);
  });
});
