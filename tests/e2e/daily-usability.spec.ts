import { expect, test } from '@playwright/test';

test('Today focus, linked completion, simple empty state, and monthly insights', async ({
  page,
}) => {
  test.setTimeout(180_000);
  test.skip(!process.env.HABITFLOW_E2E_ISOLATED, 'Requires an isolated test database.');
  const title = `Daily focus ${Date.now()}`;
  await page.goto('/register');
  await page.getByLabel('Your name').fill('Daily Tester');
  await page.getByLabel('Email address').fill(`daily-${Date.now()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Daily-test-password-42');
  await page.getByLabel('Confirm password').fill('Daily-test-password-42');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto('/goals');
  await page.getByText('Add a task').click();
  const addTask = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Add task' }) });
  await addTask.locator('[name="title"]').fill(title);
  await addTask.getByRole('button', { name: 'Add task' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();

  await page.goto('/today');
  await expect(page.getByRole('region', { name: 'Next action' })).toContainText('Choose a task');
  await expect(page.getByRole('heading', { name: 'Other Tasks (1)' })).toBeVisible();
  await expect(page.locator('#today-other-tasks').getByText(title)).toBeVisible();
  await page.getByText('Finish your day').click();
  await page.getByRole('button', { name: 'Plan tomorrow' }).click();
  const tomorrowChoice = page.locator('form').filter({ hasText: title });
  await tomorrowChoice.getByRole('button', { name: 'Add to slot' }).click();
  await expect(
    page.locator('section[aria-labelledby="tomorrow-priorities-heading"]'),
  ).toContainText(title);
  await page.reload();
  await page.getByText('Finish your day').click();
  await expect(
    page.locator('section[aria-labelledby="tomorrow-priorities-heading"]'),
  ).toContainText(title);
  await page.getByRole('button', { name: 'What went well today?' }).click();
  await expect(page.getByLabel('Daily journal entry')).toHaveValue('What went well today?\n');
  await page.getByLabel('Daily journal entry').fill('Worked on the first project task.');
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
  await page.getByLabel('Daily journal entry').fill('A new thought.');
  await expect(page.getByRole('button', { name: 'Save entry' })).toBeEnabled();
  await page.getByLabel('Daily journal entry').fill('Worked on the first project task.');
  await page.getByRole('button', { name: 'Save entry' }).click();
  await page.reload();
  await page.getByText('Finish your day').click();
  await expect(page.getByLabel('Daily journal entry')).toHaveValue(
    'Worked on the first project task.',
  );
  await page.goto('/notes');
  await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save entry' })).toHaveCount(0);
  await expect(page.getByText('Worked on the first project task.')).toBeVisible();
  await page.getByRole('link', { name: 'Edit today’s entry' }).click();
  await expect(page.getByLabel('Daily journal entry')).toHaveValue(
    'Worked on the first project task.',
  );
  await page.getByRole('button', { name: 'Add to Today' }).click();
  const choice = page.locator('form').filter({ hasText: title });
  await choice.getByRole('button', { name: 'Add to slot' }).click();
  await expect(page.getByRole('region', { name: 'Next action' })).toContainText(title);
  await expect(page.locator('#today-other-tasks')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Next action' }).getByRole('button')).toHaveCount(
    0,
  );
  await expect(
    page.locator('#today-priorities').getByRole('button', { name: 'Mark done' }),
  ).toBeVisible();

  await page.locator('#today-priorities').getByRole('button', { name: 'Mark done' }).click();
  await expect(page.locator('#today-priorities')).toContainText('Completed');
  await page.goto('/goals?show=finished');
  const task = page
    .locator('li')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
    .first();
  await expect(task).toContainText('Done');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/today');
  await expect(page.getByRole('button', { name: 'Show less today' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Show less today' })).toHaveCount(0);

  await page.goto('/review');
  await expect(page.getByRole('heading', { name: 'Notice, learn, adjust' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tasks finished over time' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What to do next' })).toBeVisible();
});
