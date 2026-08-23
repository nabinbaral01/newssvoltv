import { expect, test } from '@playwright/test';

import { signIn } from './helpers';

test.describe('role permissions', () => {
  test('anonymous visitors are sent to login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin|\/login\?next=\/admin/);
  });

  test('an author sees only the screens their role allows', async ({ page }) => {
    await signIn(page, 'author');
    await page.goto('/admin');

    const nav = page.getByRole('navigation', { name: 'Admin' }).first();
    await expect(nav.getByRole('link', { name: 'Posts' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Users & roles' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Settings' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Analytics' })).toHaveCount(0);
  });

  test('an author deep-linking into settings is refused', async ({ page }) => {
    await signIn(page, 'author');
    await page.goto('/admin/settings');
    await expect(page.getByRole('heading', { name: 'Not your desk' })).toBeVisible();
  });

  test('an admin reaches every screen', async ({ page }) => {
    await signIn(page, 'admin');

    for (const [path, heading] of [
      ['/admin/posts', 'Posts'],
      ['/admin/comments', 'Comments'],
      ['/admin/taxonomy', 'Categories & tags'],
      ['/admin/media', 'Media'],
      ['/admin/newsletter', 'Newsletter'],
      ['/admin/users', 'Users & roles'],
      ['/admin/settings', 'Settings'],
      ['/admin/analytics', 'Overview'],
      ['/admin/analytics/location', 'Audience · Location'],
      ['/admin/analytics/demographics', 'Audience · Demographics'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    }
  });
});
