import { expect, test } from '@playwright/test';

import { acceptAnalytics, firstArticleHref } from './helpers';

const BASE_URL = `http://localhost:${process.env.E2E_PORT ?? 3000}`;

test.describe('analytics tracking', () => {
  test('nothing is sent before consent is given', async ({ page }) => {
    const calls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/track')) calls.push(request.url());
    });

    await page.goto('/');
    await page.waitForTimeout(2500);

    expect(calls, 'the beacon must not fire until analytics cookies are accepted').toHaveLength(0);
  });

  test('a page view is recorded once consent is given', async ({ page }) => {
    // Resolve the target before arming the listener — firstArticleHref
    // navigates, and a navigation discards any pending response body.
    const href = await firstArticleHref(page);

    await page.goto('/');
    await acceptAnalytics(page);

    const beacon = page.waitForResponse(
      (res) => res.url().includes('/api/track') && res.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.goto(href);

    const response = await beacon;
    expect(response.status()).toBe(200);

    const payload = await response.json();
    expect(
      payload.id,
      'the server returns the page-view id the engagement update is keyed on',
    ).toBeTruthy();
  });

  test('Global Privacy Control is honoured even with consent stored', async ({ browser }) => {
    const context = await browser.newContext();
    // GPC is a browser-level signal; simulate it before any script runs.
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
    });
    await context.addCookies([
      {
        name: 'volt_consent',
        value: encodeURIComponent(JSON.stringify({ value: 'all', version: 1, at: new Date().toISOString() })),
        url: BASE_URL,
      },
    ]);

    const page = await context.newPage();
    const calls: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/track')) calls.push(request.url());
    });

    await page.goto('/');
    await page.waitForTimeout(2500);

    expect(calls, 'GPC overrides a stored consent cookie').toHaveLength(0);
    await context.close();
  });

  test('the consent banner is not shown again after a decision', async ({ page }) => {
    await page.goto('/');
    await acceptAnalytics(page);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Accept analytics' })).toHaveCount(0);
  });
});
