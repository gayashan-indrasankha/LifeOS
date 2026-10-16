import { expect, test } from '@playwright/test';

test('Week stays focused on tasks', async ({ page }) => {
  test.setTimeout(120_000);
  test.skip(!process.env.HABITFLOW_E2E_ISOLATED, 'Requires an isolated test database.');
  await page.goto('/register');
  await page.getByLabel('Your name').fill('Week Tester');
  await page.getByLabel('Email address').fill(`week-${Date.now()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Week-test-password-42');
  await page.getByLabel('Confirm password').fill('Week-test-password-42');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto('/week?date=2026-10-09');
  await expect(page.getByRole('heading', { name: 'Your week' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tasks by day' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Weekly workload' })).toHaveCount(0);
  const add = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add task' }) });
  await add.locator('[name="title"]').fill('Prepare a presentation');
  // One-time tasks are shown on their completion day. Complete a task scheduled
  // for the fixed test clock's current day so the persistence check stays on it.
  await add.locator('[name="scheduledDate"]').fill('2026-10-08');
  await add.getByRole('button', { name: 'Add task' }).click();
  const thursday = page
    .getByRole('region', { name: 'Tasks by day' })
    .locator('div.rounded-2xl')
    .filter({ has: page.getByRole('heading', { name: 'Thu, Oct 8' }) })
    .first();
  await expect(thursday).toContainText('Prepare a presentation');
  await thursday.getByRole('button', { name: 'Mark done' }).click();
  await expect(thursday).toContainText('1 of 1 done');
  await page.reload();
  await expect(thursday).toContainText('Prepare a presentation');
  await expect(thursday).toContainText('1 of 1 done');

  await page.goto('/goals');
  await page.getByText('Add a task').click();
  const backlog = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Add task' }) });
  await backlog.locator('[name="title"]').fill('Review notes');
  await backlog.locator('[name="scheduledDate"]').fill('');
  await backlog.getByRole('button', { name: 'Add task' }).click();
  await page.goto('/week?date=2026-10-09');
  await page.getByText('Plan an existing task').click();
  const plan = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Add to week' }) });
  await plan.getByRole('combobox', { name: 'Task' }).fill('review');
  await expect(plan.getByRole('option', { name: 'Review notes' })).toBeVisible();
  await plan.getByRole('option', { name: 'Review notes' }).click();
  await plan.locator('[name="date"]').fill('2026-10-11');
  await plan.getByRole('button', { name: 'Add to week' }).click();
  await expect(page.getByRole('region', { name: 'Tasks by day' })).toContainText('Review notes');
  const sunday = page
    .getByRole('region', { name: 'Tasks by day' })
    .locator('div.rounded-2xl')
    .filter({ has: page.getByRole('heading', { name: 'Sun, Oct 11' }) })
    .first();
  const monday = page
    .getByRole('region', { name: 'Tasks by day' })
    .locator('div.rounded-2xl')
    .filter({ has: page.getByRole('heading', { name: 'Mon, Oct 5' }) })
    .first();
  await expect(monday).not.toContainText('Review notes');
  await sunday.getByText('Change day').click();
  const move = sunday
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Save day' }) });
  await move.locator('[name="scheduledDate"]').fill('2026-10-05');
  await move.getByRole('button', { name: 'Save day' }).click();
  await expect(monday).toContainText('Review notes');
  // Unfinished one-time tasks carry forward from their new start day.
  await expect(sunday).toContainText('Review notes');
  await page.reload();
  await expect(monday).toContainText('Review notes');
  await expect(sunday).toContainText('Review notes');

  await expect(page.getByRole('region', { name: 'Tasks by day' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Weekly workload' })).toHaveCount(0);
  await expect(page.getByText('Time blocks and detailed planning (optional)')).toHaveCount(0);
});
