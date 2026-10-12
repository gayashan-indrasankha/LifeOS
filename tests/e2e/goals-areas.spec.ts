import { expect, test } from '@playwright/test';

test('a new area can be added and reused for tasks and goals', async ({ page }) => {
  test.skip(!process.env.HABITFLOW_E2E_ISOLATED, 'Requires an isolated test database.');
  const tag = Date.now();
  const area = `Creative work ${tag}`;

  await page.goto('/register');
  await page.getByLabel('Your name').fill('Area Tester');
  await page.getByLabel('Email address').fill(`area-${tag}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Area-test-password-42');
  await page.getByLabel('Confirm password').fill('Area-test-password-42');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto('/goals');
  await page.getByText('Add a task').click();
  const taskForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Add task' }) });
  await taskForm.getByLabel('Area', { exact: true }).selectOption('');
  await taskForm.getByLabel('New area name').fill(area);
  await taskForm.getByLabel('Task title').fill(`First area task ${tag}`);
  await taskForm.getByRole('button', { name: 'Add task' }).click();
  await expect(taskForm.getByRole('status')).toContainText('Task added.');
  await expect(page.getByRole('heading', { name: `First area task ${tag}` })).toBeVisible();

  await page.reload();
  await page.getByText('Add a task').click();
  await taskForm.getByLabel('Area', { exact: true }).selectOption({ label: area });
  await taskForm.getByLabel('Task title').fill(`Second area task ${tag}`);
  await taskForm.getByRole('button', { name: 'Add task' }).click();
  await expect(page.getByRole('heading', { name: `Second area task ${tag}` })).toBeVisible();

  if (!(await taskForm.isVisible())) await page.getByText('Add a task').click();
  await taskForm.getByLabel('Area', { exact: true }).selectOption('');
  await taskForm.getByLabel('New area name').fill('Health & Fitness');
  await taskForm.getByLabel('Task title').fill(`Legacy area task ${tag}`);
  await taskForm.getByRole('button', { name: 'Add task' }).click();
  await expect(page.getByRole('heading', { name: `Legacy area task ${tag}` })).toBeVisible();
  await expect(page.getByRole('region', { name: `${area} tasks` })).toContainText(
    `First area task ${tag}`,
  );
  await expect(page.getByRole('region', { name: `${area} tasks` })).toContainText(
    `Second area task ${tag}`,
  );
  await expect(page.getByRole('region', { name: 'Fitness tasks' })).toContainText(
    `Legacy area task ${tag}`,
  );

  await page.goto('/goals?view=goals');
  await page.getByText('Add a goal').click();
  const goalForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Create goal' }) });
  await expect(goalForm.getByLabel('Life area').locator('option')).toHaveText([
    'Fitness',
    'Personal Development',
    'Education & Skills',
    'Career',
    'Emotional Well-bein',
    'Fun',
    area,
    '+ New area…',
  ]);
  await goalForm.getByLabel('Life area').selectOption({ label: area });
  await goalForm.getByLabel('Title').fill(`Area goal ${tag}`);
  await goalForm.getByRole('button', { name: 'Create goal' }).click();
  await expect(page.getByRole('heading', { name: `Area goal ${tag}` })).toBeVisible();
  await expect(page.getByRole('region', { name: `${area} goals` })).toContainText(
    `Area goal ${tag}`,
  );

  if (!(await goalForm.isVisible())) await page.getByText('Add a goal').click();
  await goalForm.getByLabel('Life area').selectOption({ label: 'Fitness' });
  await goalForm.getByLabel('Title').fill(`Fitness goal ${tag}`);
  await goalForm.getByRole('button', { name: 'Create goal' }).click();
  await expect(page.getByRole('region', { name: 'Fitness goals' })).toContainText(
    `Fitness goal ${tag}`,
  );
  await expect(page.getByRole('region', { name: `${area} goals` })).not.toContainText(
    `Fitness goal ${tag}`,
  );

  const fitnessGoal = page
    .locator('li')
    .filter({ has: page.getByRole('heading', { name: `Fitness goal ${tag}` }) });
  await fitnessGoal.getByText('Edit goal').click();
  const editForm = fitnessGoal.locator('form').filter({
    has: page.getByRole('button', { name: 'Save goal' }),
  });
  await expect(editForm.getByLabel('Life area').locator('option')).toHaveText(
    await goalForm.getByLabel('Life area').locator('option').allTextContents(),
  );
  await editForm.getByLabel('Life area').selectOption({ label: 'Career' });
  await editForm.getByRole('button', { name: 'Save goal' }).click();
  await expect(page.getByRole('region', { name: 'Career goals' })).toContainText(
    `Fitness goal ${tag}`,
  );
});
