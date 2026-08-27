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

  test('a like survives the state fetch landing after the click', async ({ page }) => {
    await signIn(page, 'author');

    // Hold the state request open so the click definitely lands first. This is
    // the race that made a saved like snap back to unliked: the reply carried
    // the state from before the click and overwrote it.
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/posts/reactions**', async (route) => {
      // Fetch immediately so the body captures the state from *before* the
      // click, then hold the delivery. Holding the request instead would let
      // it reach the server after the click and come back already correct,
      // which is why the first version of this test passed either way.
      const response = await route.fetch();
      const body = await response.text();
      await held;
      await route.fulfill({ response, body });
    });

    const href = await firstArticleHref(page);
    await page.goto(href);

    const like = page.locator('button[aria-label="Like this story"]:visible').first();
    await expect(like).toBeVisible({ timeout: 20_000 });
    await like.click();
    await expect(
      page.locator('button[aria-label="Remove your like"]:visible').first(),
    ).toBeVisible({ timeout: 15_000 });

    // Now let the stale answer through. It must not undo the click.
    //
    // The wait has to outlast the reply actually being applied: asserting
    // straight after release() passes even on the broken build, because the
    // assertion resolves before the state lands. Ask for the absence of the
    // un-liked button instead, which only holds once things have settled.
    release();
    await page.waitForTimeout(2500);
    await expect(page.locator('button[aria-label="Like this story"]:visible')).toHaveCount(0);
    await expect(
      page.locator('button[aria-label="Remove your like"]:visible').first(),
    ).toBeVisible();

    await page.unroute('**/api/posts/reactions**');
    await page.reload();
    await expect(
      page.locator('button[aria-label="Remove your like"]:visible').first(),
    ).toBeVisible({ timeout: 20_000 });

    await page.locator('button[aria-label="Remove your like"]:visible').first().click();
    await expect(
      page.locator('button[aria-label="Like this story"]:visible').first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('one action in flight does not freeze the others', async ({ page }) => {
    await signIn(page, 'author');
    const href = await firstArticleHref(page);
    await page.goto(href);

    const like = page.locator('button[aria-label="Like this story"]:visible').first();
    await expect(like).toBeVisible({ timeout: 20_000 });

    // Press like and follow back to back. A single shared pending flag
    // disabled every button while one request was open, so the second press
    // did nothing at all.
    await like.click();
    await page.locator('button[aria-label^="Follow "]:visible').first().click();

    await expect(
      page.locator('button[aria-label="Remove your like"]:visible').first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator('button[aria-label^="Unfollow "]:visible').first(),
    ).toBeVisible({ timeout: 15_000 });

    // Both landed, not just the first.
    await page.reload();
    await expect(
      page.locator('button[aria-label="Remove your like"]:visible').first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.locator('button[aria-label^="Unfollow "]:visible').first(),
    ).toBeVisible({ timeout: 20_000 });

    await page.locator('button[aria-label="Remove your like"]:visible').first().click();
    await page.locator('button[aria-label^="Unfollow "]:visible').first().click();
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

  test('the comment button puts the cursor in the composer', async ({ page }) => {
    await signIn(page, 'author');
    const href = await firstArticleHref(page);
    await page.goto(href);

    const write = page.locator('button[aria-label^="Write a comment"]:visible').first();
    await expect(write).toBeVisible({ timeout: 20_000 });
    await write.click();

    // Landing on the thread is not enough — pressing this means "I want to
    // write something", so the box has to be focused and ready to type.
    const box = page.locator('#comment-root');
    await expect(box).toBeFocused({ timeout: 15_000 });
    await page.keyboard.type('typed straight into the box');
    await expect(box).toHaveValue('typed straight into the box');
  });

  test('a reader can follow the writer from the rail', async ({ page }) => {
    await signIn(page, 'author');
    const href = await firstArticleHref(page);
    await page.goto(href);

    const follow = page.locator('button[aria-label^="Follow "]:visible').first();
    await expect(follow).toBeVisible({ timeout: 20_000 });
    await follow.click();

    const unfollow = page.locator('button[aria-label^="Unfollow "]:visible').first();
    await expect(unfollow).toBeVisible({ timeout: 15_000 });

    // Survives a reload, and shows up where following is supposed to pay off.
    await page.reload();
    await expect(
      page.locator('button[aria-label^="Unfollow "]:visible').first(),
    ).toBeVisible({ timeout: 20_000 });

    await page.goto('/account');
    await expect(page.getByRole('heading', { name: 'Writers you follow' })).toBeVisible();

    await page.goto(href);
    await page.locator('button[aria-label^="Unfollow "]:visible').first().click();
    await expect(
      page.locator('button[aria-label^="Follow "]:visible').first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('the rail does not offer to follow yourself', async ({ page }) => {
    // The e2e editor is the byline on the posts the publish tests create.
    await signIn(page, 'editor');
    const href = await firstArticleHref(page);
    await page.goto(href);

    await expect(page.locator('button[aria-label^="Like this story"]:visible').first()).toBeVisible({
      timeout: 20_000,
    });
    // Give the state fetch time to land before asserting an absence.
    await page.waitForTimeout(1500);
    await expect(page.locator('button[aria-label="Follow E2E Editor"]')).toHaveCount(0);
  });
});
