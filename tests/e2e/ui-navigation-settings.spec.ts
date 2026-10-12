import { expect, test } from '@playwright/test';

test.beforeEach(() => {
  test.skip(!process.env.HABITFLOW_E2E_ISOLATED, 'Requires an isolated test database.');
});

test('saved theme applies immediately and mobile navigation reveals the current section', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 860 });
  await page.goto('/register');
  const tag = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await page.getByLabel('Your name').fill('UI Settings');
  await page.getByLabel('Email address').fill(`ui-settings-${tag}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('UI-settings-password-42');
  await page.getByLabel('Confirm password').fill('UI-settings-password-42');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page).toHaveTitle('Home | LifeOS');
  await page.setViewportSize({ width: 320, height: 860 });
  await page.goto('/dashboard?month=2026-09');
  await expect(page.getByRole('button', { name: 'Current month' })).toContainText('Today');
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(320);
  await page.setViewportSize({ width: 390, height: 860 });

  await page.goto('/settings');
  await expect(page).toHaveTitle('Settings | LifeOS');
  await page.getByRole('combobox', { name: 'Theme' }).click();
  await page.getByRole('option', { name: 'Dark' }).click();
  await expect(page.getByRole('combobox', { name: 'Theme' })).toContainText('Dark');
  await page.getByRole('button', { name: 'Save Settings' }).click();
  await expect(page.getByText('Saved successfully')).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Theme' })).toContainText('Dark');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.evaluate(() => localStorage.removeItem('theme'));
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);

  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect(page.getByRole('button', { name: 'Toggle theme' })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Theme' })).toContainText('Light');

  await page.getByRole('combobox', { name: 'Timezone' }).click();
  await page.getByRole('option', { name: 'UTC', exact: true }).click();
  await page.getByRole('combobox', { name: 'Week Starts On' }).click();
  await page.getByRole('option', { name: 'Sunday' }).click();
  await page.getByRole('button', { name: 'Save Settings' }).click();
  await expect(page.getByText('Saved successfully')).toBeVisible();
  await page.goto('/today');
  await expect(page).toHaveTitle('Today | LifeOS');
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByRole('combobox', { name: 'Timezone' })).toContainText('UTC');

  await page.goto('/goals/evidence');
  await expect(page).toHaveTitle('Evidence & Career Readiness | LifeOS');
  const activeLink = page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', {
    name: 'Goals & Projects',
  });
  await expect(activeLink).toHaveAttribute('aria-current', 'page');
  await expect(activeLink).toBeInViewport({ ratio: 0.9 });
  await page
    .getByRole('navigation', { name: 'Evidence sections' })
    .getByRole('link', { name: 'Applications' })
    .click();
  const targetTop = await page
    .locator('#applications')
    .evaluate((section) => section.getBoundingClientRect().top);
  expect(targetTop).toBeGreaterThanOrEqual(120);
});
