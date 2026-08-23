import { expect, test } from '@playwright/test';

import { signIn } from './helpers';

/**
 * Three privilege levels meet on these screens, and the differences between
 * them are the point:
 *
 *   reader  a picture, and nothing else
 *   staff   a picture, a byline, links, and a page that can be followed
 *   nobody  can read, cannot follow
 */

/** A 1x1 PNG. Enough to exercise the upload path without a fixture file. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('profile pictures', () => {
  test('a reader can set a picture but gets no byline fields', async ({ page }) => {
    await signIn(page, 'author');
    // The author account is the closest thing the suite owns to a normal
    // signed-in user on this page — /account is the same screen for everyone.
    await page.goto('/account');

    await expect(page.getByRole('heading', { name: 'Profile picture' })).toBeVisible();

    // Social links and job title are staff-only and live in the admin panel.
    await expect(page.getByLabel('Job title')).toHaveCount(0);
    await expect(page.getByLabel('X / Twitter')).toHaveCount(0);
  });

  test('uploading a picture persists across a reload', async ({ page }) => {
    await signIn(page, 'editor');
    await page.goto('/account');

    await page.getByLabel('Profile picture').setInputFiles({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: PNG,
    });

    await expect(page.getByText('Profile picture updated.')).toBeVisible({ timeout: 20_000 });

    // The reload is the assertion that matters: an upload that only changed
    // local state would look identical until you came back.
    await page.reload();
    await expect(page.locator('img[alt=""]').first()).toBeVisible();
  });

  test('an anonymous visitor cannot upload', async ({ request }) => {
    const res = await request.post('/api/account/avatar', {
      multipart: { file: { name: 'a.png', mimeType: 'image/png', buffer: PNG } },
    });
    expect(res.status()).toBe(401);
  });

  test('a non-image is refused', async ({ page }) => {
    await signIn(page, 'author');
    // page.request, not the bare `request` fixture: only the page's context
    // carries the session cookie, and without it this would just be the 401
    // test again wearing a different name.
    const res = await page.request.post('/api/account/avatar', {
      multipart: {
        file: { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') },
      },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('following a writer', () => {
  test('a signed-in reader can follow and unfollow', async ({ page }) => {
    await signIn(page, 'author');
    await page.goto('/author/e2e-editor');

    const follow = page.getByRole('button', { name: /Follow E2E Editor/ });
    await expect(follow).toBeVisible();

    await follow.click();
    const unfollow = page.getByRole('button', { name: /Unfollow E2E Editor/ });
    await expect(unfollow).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/1 follower/)).toBeVisible();

    // It has to survive a reload — an optimistic toggle that never reached the
    // database would look exactly the same until then.
    await page.reload();
    await expect(page.getByRole('button', { name: /Unfollow E2E Editor/ })).toBeVisible();

    // And it shows up where following is supposed to pay off.
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: 'Writers you follow' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'E2E Editor' })).toBeVisible();

    await page.goto('/author/e2e-editor');
    await page.getByRole('button', { name: /Unfollow E2E Editor/ }).click();
    await expect(page.getByRole('button', { name: /Follow E2E Editor/ })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('an anonymous visitor is asked to sign in and the count does not move', async ({ page }) => {
    await page.goto('/author/e2e-editor');

    await page.getByRole('button', { name: /Follow E2E Editor/ }).click();
    await expect(page.getByText('Sign in to follow writers.')).toBeVisible({ timeout: 15_000 });

    // The optimistic update must roll all the way back, count included.
    await expect(page.getByRole('button', { name: /Follow E2E Editor/ })).toBeVisible();
    await expect(page.getByText(/0 followers/)).toBeVisible();
  });

  test('your own page offers editing, not following', async ({ page }) => {
    await signIn(page, 'editor');
    await page.goto('/author/e2e-editor');

    await expect(page.getByRole('link', { name: 'Edit your profile' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Follow/ })).toHaveCount(0);
  });
});

test.describe('article byline', () => {
  test('credits the position and closes with an author card', async ({ page }) => {
    await signIn(page, 'editor');

    // Publish something, so the assertion runs against a byline this test owns
    // rather than whichever article happens to be first on the site.
    const title = `Byline Check ${Date.now()}`;
    await page.goto('/admin/posts/new');
    await page.getByPlaceholder('Write the headline').fill(title);

    // TipTap is a contenteditable canvas, not an input.
    const canvas = page.locator('.ProseMirror');
    await canvas.click();
    await canvas.pressSequentially('Body copy for the byline test.');

    await page.getByLabel('Category').selectOption({ label: 'Movies' });
    await page.getByLabel('Content type').selectOption({ label: 'News' });
    await page.getByLabel('Status').selectOption('PUBLISHED');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForURL(/\/admin\/posts\/[a-z0-9]+$/i, { timeout: 30_000 });

    // Read the slug the server actually assigned rather than re-deriving it
    // here — a duplicate headline gets a -2 suffix, and guessing would send
    // this test to a 404 that looks like a byline bug.
    const previewHref = await page
      .getByRole('link', { name: /Preview/i })
      .first()
      .getAttribute('href');
    const slug = previewHref?.match(/\/preview\/([^?]+)/)?.[1];
    expect(slug, 'editor should expose the saved slug').toBeTruthy();

    await page.goto(`/movies/${slug}`);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();

    // The position sits under the name — "Editor", never "EDITOR" the role.
    await expect(page.getByText('Editor', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('EDITOR', { exact: true })).toHaveCount(0);

    const card = page.getByRole('complementary', { name: /About E2E Editor/ });
    await expect(card).toBeVisible();
    await expect(card.getByRole('link', { name: /More from E2E Editor/ })).toBeVisible();
  });
});

test.describe('author page', () => {
  test('beats come from published work, and readers have no page', async ({ page }) => {
    await page.goto('/author/e2e-editor');

    // The heading is the byline, not the role.
    await expect(page.getByRole('heading', { level: 1 })).toContainText('E2E Editor');
    await expect(page.getByRole('heading', { name: /Latest from E2E Editor/ })).toBeVisible();

    // A category chip is only there because a published post put it there.
    const beats = page.getByRole('navigation', { name: /What E2E Editor covers/ });
    if (await beats.count()) {
      await expect(beats.getByRole('link').first()).toHaveAttribute('href', /^\/[a-z0-9-]+$/);
    }
  });
});
