import { expect, test } from '@playwright/test';

import { signIn } from './helpers';

/**
 * An invitation has to do two things: reach the person, and leave nothing
 * usable behind if it does not. Both are asserted here.
 */
test.describe('inviting a colleague', () => {
  // These walk the whole journey — invite, sign-in refusal, set password, sign
  // in for real — which is a lot of navigations against a dev server compiling
  // routes on demand. The default 60s is not enough for the round trip.
  test.describe.configure({ timeout: 150_000 });

  test('creates an account that cannot be signed into until the link is used', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/admin/users');

    const stamp = Date.now();
    const name = `Invitee ${stamp}`;
    const email = `invitee.${stamp}@voltv.test`;

    await page.getByRole('button', { name: /Invite|Add/ }).first().click();
    // Wait for the dialog before typing — clicking a button that has not
    // hydrated yet opens nothing, and the failure looks like a missing field.
    await expect(page.getByRole('button', { name: 'Send invitation', exact: true })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Email').fill(email);
    // exact: every row behind the dialog has a select labelled "Role for X".
    await page.getByLabel('Role', { exact: true }).selectOption('AUTHOR');
    await page.getByRole('button', { name: 'Send invitation', exact: true }).click();

    // No mail provider in the test environment, so the link is offered for
    // copying instead — which is the behaviour that matters when a send fails.
    const link = page.getByLabel('Set-password link');
    await expect(link).toBeVisible({ timeout: 20_000 });
    const url = await link.inputValue();
    expect(url).toContain('/reset-password?token=');

    await page.keyboard.press('Escape');
    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toBeVisible();
    await expect(row.getByText('invited')).toBeVisible();
    await expect(row.getByText('not accepted yet')).toBeVisible();

    // The account exists but has no password, so credentials must not work.
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill('anything-at-all');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/login/);

    // Following the invitation link lets them choose one, and then it works.
    await page.goto(new URL(url).pathname + new URL(url).search);
    await page.getByLabel('New password', { exact: true }).fill('invited-password-2026');
    await page.getByLabel('Confirm password', { exact: true }).fill('invited-password-2026');
    await page.getByRole('button', { name: 'Set new password' }).click();
    // The form confirms in place rather than redirecting.
    await expect(page.getByRole('heading', { name: 'Password changed' })).toBeVisible({
      timeout: 20_000,
    });

    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill('invited-password-2026');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/account|\/admin/, { timeout: 30_000 });
  });

  test('a used invitation link cannot be replayed', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/admin/users');

    const stamp = Date.now();
    await page.getByRole('button', { name: /Invite|Add/ }).first().click();
    await page.getByLabel('Name').fill(`Replay ${stamp}`);
    await page.getByLabel('Email').fill(`replay.${stamp}@voltv.test`);
    await page.getByRole('button', { name: 'Send invitation', exact: true }).click();

    const url = await page.getByLabel('Set-password link').inputValue();
    const path = new URL(url).pathname + new URL(url).search;

    await page.context().clearCookies();
    await page.goto(path);
    await page.getByLabel('New password', { exact: true }).fill('first-password-2026');
    await page.getByLabel('Confirm password', { exact: true }).fill('first-password-2026');
    await page.getByRole('button', { name: 'Set new password' }).click();
    await expect(page.getByRole('heading', { name: 'Password changed' })).toBeVisible({
      timeout: 20_000,
    });

    // Single use: the same link must not set a second password.
    await page.goto(path);
    await expect(page.getByText(/already been used|not valid|expired/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test('re-inviting invalidates the previous link', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/admin/users');

    const stamp = Date.now();
    const name = `Reinvite ${stamp}`;
    await page.getByRole('button', { name: /Invite|Add/ }).first().click();
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Email').fill(`reinvite.${stamp}@voltv.test`);
    await page.getByRole('button', { name: 'Send invitation', exact: true }).click();

    const firstUrl = await page.getByLabel('Set-password link').inputValue();
    await page.keyboard.press('Escape');

    const row = page.getByRole('row', { name: new RegExp(name) });
    await row.getByRole('button', { name: /Resend invitation/ }).click();
    await expect(page.getByLabel('Set-password link')).toBeVisible({ timeout: 20_000 });
    const secondUrl = await page.getByLabel('Set-password link').inputValue();
    expect(secondUrl).not.toBe(firstUrl);

    // A forwarded copy of the first email must stop working once a new one is
    // issued, or revoking access by re-inviting would be meaningless.
    await page.context().clearCookies();
    await page.goto(new URL(firstUrl).pathname + new URL(firstUrl).search);
    await expect(page.getByText(/already been used|not valid|expired/i)).toBeVisible({
      timeout: 15_000,
    });
  });
});
