import { expect, test } from '@playwright/test';

test('Life OS preview is read-only and repeat installation preserves existing records', async ({
  page,
}) => {
  test.skip(!process.env.HABITFLOW_E2E_ISOLATED, 'Requires an isolated test database.');
  const tag = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await page.goto('/register');
  await page.getByLabel('Your name').fill('Life OS Test');
  await page.getByLabel('Email address').fill(`life-os-${tag}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Life-os-password-42');
  await page.getByLabel('Confirm password').fill('Life-os-password-42');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto('/settings/life-os');
  for (const checkbox of await page.locator('input[name="section"]').all())
    await checkbox.uncheck();
  for (const section of [
    'university',
    'industry',
    'career',
    'interview',
    'english',
    'fitness',
    'nutrition',
    'recovery',
  ])
    await page.locator(`input[name="section"][value="${section}"]`).check();
  await page.getByRole('button', { name: 'Preview changes' }).click();
  await expect(page.getByRole('region', { name: 'Setup preview' })).toBeVisible();
  await expect(page.getByText('Subject 5', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Morning weight check reminder', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Before-bed milk or optional snack', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Show meal checklist on Today', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Weekly review', { exact: true })).toHaveCount(0);
  const firstNewCount = await page.getByLabel('Preview counts').locator('span').first().innerText();

  await page.reload();
  await page.getByRole('button', { name: 'Preview changes' }).click();
  await expect(page.getByLabel('Preview counts').locator('span').first()).toHaveText(firstNewCount);
  await page.locator('input[name="confirm"]').check();
  await page.getByRole('button', { name: 'Install selected setup' }).click();
  await expect(page.getByRole('status')).toContainText('Created');
  await expect(page.getByRole('heading', { name: 'Your plan is ready to use' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Today' })).toBeVisible();
  await expect(page.getByText(/Personalize later/)).toBeVisible();

  await page.getByRole('button', { name: 'Preview changes' }).click();
  await expect(page.getByText('0 new', { exact: true })).toBeVisible();
  await page.locator('input[name="confirm"]').check();
  await page.getByRole('button', { name: 'Install selected setup' }).click();
  await expect(page.getByRole('status')).toContainText('Created 0 items');

  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: 'Preview changes' }).click();
  await expect(page.getByRole('region', { name: 'Setup preview' })).toBeVisible();
  await expect(page.locator('input[name="confirm"]')).toBeVisible();
});
