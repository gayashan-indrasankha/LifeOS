import { expect, test } from '@playwright/test';

test('habit editing, ordering, archive, and restore preserve completion history', async ({
  page,
}) => {
  test.skip(!process.env.HABITFLOW_E2E_ISOLATED, 'Requires an isolated test database.');
  const tag = Date.now();
  const first = `First habit ${tag}`;
  const renamed = `Renamed habit ${tag}`;
  const second = `Second habit ${tag}`;
  await page.goto('/register');
  await page.getByLabel('Your name').fill('Habit Release');
  await page.getByLabel('Email address').fill(`habit-${tag}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Habit-release-password-42');
  await page.getByLabel('Confirm password').fill('Habit-release-password-42');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  for (const name of [first, second]) {
    await page.goto('/habits/new');
    await page.getByLabel(/Habit Name/).fill(name);
    await page.getByLabel(/Monthly Target/).fill('1');
    await page.getByLabel('Start Date').fill('2026-10-01');
    await page.getByRole('button', { name: 'Save Habit' }).click();
    await expect(page).toHaveURL(/\/habits$/);
  }

  const orderSaved = page.waitForResponse(
    (response) => response.url().endsWith('/habits') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Change order' }).click();
  await page.getByRole('button', { name: `Move ${second} up` }).click();
  expect((await orderSaved).ok()).toBe(true);
  await expect(page.getByRole('button', { name: `Move ${second} down` })).toBeEnabled();
  await expect(page.locator('ol > li').first()).toContainText(second);
  await page.reload();
  await expect(page.locator('ol > li').first()).toContainText(second);

  const actions = page.getByRole('button', { name: `Actions for ${first}` });
  await actions.click();
  await page.keyboard.press('Escape');
  await expect(actions).toBeFocused();
  await actions.click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  await expect(page.getByRole('heading', { name: 'Edit Habit' })).toBeVisible();
  await page.getByLabel(/Habit Name/).fill(renamed);
  await page.getByRole('button', { name: 'Save Habit' }).click();
  await expect(page).toHaveURL(/\/habits$/);
  await expect(page.getByText(renamed)).toBeVisible();

  await page.goto('/dashboard?month=2026-10');
  const row = page.getByRole('row', { name: new RegExp(renamed) });
  await row.getByRole('button', { name: `Mark complete for ${renamed} on 2026-10-08` }).click();
  await expect(row).toContainText('1 / 1');
  await page.goto('/habits');
  await page.getByRole('button', { name: `Actions for ${renamed}` }).click();
  await page.getByRole('menuitem', { name: 'Archive' }).click();
  await expect(page.getByText('Archived habits (1)')).toBeVisible();
  await page.reload();
  await page.getByText('Archived habits (1)').click();
  await page.getByRole('button', { name: `Actions for ${renamed}` }).click();
  await page.getByRole('menuitem', { name: 'Unarchive' }).click();
  await expect(page.getByText('Archived habits (1)')).toHaveCount(0);
  await page.goto('/dashboard?month=2026-10');
  await expect(page.getByRole('row', { name: new RegExp(renamed) })).toContainText('1 / 1');

  await page.goto('/habits');
  await page.getByRole('button', { name: `Actions for ${renamed}` }).click();
  await page.getByRole('menuitem', { name: 'Delete habit' }).click();
  await expect(page.getByText(renamed)).toHaveCount(0);
  await page.goto('/dashboard?month=2026-10');
  await expect(page.getByRole('row', { name: new RegExp(renamed) })).toHaveCount(0);
});
