import { expect, test } from '@playwright/test';

test.beforeEach(() => {
  test.skip(!process.env.HABITFLOW_E2E_ISOLATED, 'Requires an isolated test database.');
});

test('optional meal plan can be edited, logged, cleared, paused, and resumed', async ({ page }) => {
  await page.goto('/register');
  const tag = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await page.getByLabel('Your name').fill('Nutrition Refinement');
  await page.getByLabel('Email address').fill(`nutrition-${tag}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Nutrition-password-42');
  await page.getByLabel('Confirm password').fill('Nutrition-password-42');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto('/settings');
  const section = page.getByRole('region', { name: 'Optional meal checklist' });
  await section.getByRole('button', { name: 'Enable checklist' }).click();
  await section.getByText('Edit meal plan').click();
  await section.getByLabel('Meal name').fill('Breakfast');
  await section.getByLabel('Food/portion notes (optional)').fill('My existing meal plan');
  await section.getByLabel('Planned kcal (optional)').fill('500');
  await section.getByLabel('Planned carbs g (optional)').fill('60');
  await section.getByLabel('Planned fat g (optional)').fill('20');
  await section.getByRole('button', { name: 'Add meal' }).click();
  await expect(section.getByText('Meal plan saved.')).toBeVisible();
  const plan = section.locator('details').first();
  if (!(await plan.evaluate((details) => (details as HTMLDetailsElement).open))) {
    await section.getByText('Edit meal plan').click();
  }
  await section.getByText('Breakfast', { exact: true }).click();
  const edit = section
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Save meal' }) });
  await edit.getByLabel('Meal name').fill('Morning meal');
  await edit.getByRole('button', { name: 'Save meal' }).click();

  await page.goto('/today');
  await page.getByText('Nutrition checklist').click();
  await expect(page.getByText('Morning meal')).toBeVisible();
  await expect(page.getByText('Daily nutrition totals')).toBeVisible();
  await expect(page.getByText('Plan: 60 g').first()).toBeVisible();
  await expect(page.getByText('Plan: 20 g').first()).toBeVisible();
  await expect(page.getByText(/~60 g carbs/)).toBeVisible();
  await expect(page.getByText(/~20 g fat/)).toBeVisible();
  await page.getByText('Add actual amounts').click();
  const actualForm = page.getByRole('form', { name: /Actual amounts for Morning meal/ });
  await actualForm.locator('[name="actualCalories"]').fill('300');
  await actualForm.locator('[name="actualProtein"]').fill('30');
  await actualForm.locator('[name="actualCarbs"]').fill('40');
  await actualForm.locator('[name="actualFat"]').fill('10');
  await actualForm.getByRole('button', { name: 'Save actual amounts' }).click();
  await expect(actualForm.getByText('Saved')).toBeVisible();
  await expect(page.getByText('30 g consumed')).toBeVisible();
  await page.reload();
  await page.getByText('Nutrition checklist').click();
  await page.getByText('Edit actual amounts').click();
  await expect(
    page
      .getByRole('form', { name: /Actual amounts for Morning meal/ })
      .locator('[name="actualProtein"]'),
  ).toHaveValue('30');
  const group = page.getByRole('group', { name: /Did you eat Morning meal as planned/ });
  await expect(group.locator('..').getByText('No time planned')).toBeVisible();
  await group.getByRole('button', { name: 'Ate as planned', exact: true }).click();
  await expect(group.getByRole('button', { name: 'Ate as planned', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await group.getByRole('button', { name: 'Missed Meal' }).click();
  await expect(group.getByRole('button', { name: 'Missed Meal' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(group.getByRole('button', { name: 'Clear choice' })).toBeVisible();
  await group.getByRole('button', { name: 'Clear choice' }).click();
  await expect(group.getByRole('button', { name: 'Missed Meal' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByText('30 g consumed')).toBeVisible();
  await group.getByRole('button', { name: 'Ate something else' }).click();
  await expect(group.getByRole('button', { name: 'Ate something else' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await expect(page.getByLabel('Log date')).toHaveCount(0);
  await page
    .getByRole('group', { name: /Did you eat Morning meal as planned/ })
    .getByRole('button', { name: 'Ate as planned', exact: true })
    .click();

  await page.goto('/settings');
  await section.getByRole('button', { name: 'Pause checklist' }).click();
  await page.goto('/today');
  await expect(page.getByText('Nutrition checklist')).toHaveCount(0);
  await page.goto('/settings');
  await section.getByRole('button', { name: 'Enable checklist' }).click();
  await page.goto('/today');
  await page.getByText('Nutrition checklist').click();
  await expect(
    page
      .getByRole('group', { name: /Did you eat Morning meal as planned/ })
      .getByRole('button', { name: 'Ate as planned', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('meal templates and logs remain private to their account', async ({ page, browser }) => {
  const tag = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await page.goto('/register');
  await page.getByLabel('Your name').fill('Meal Owner');
  await page.getByLabel('Email address').fill(`meal-owner-${tag}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Meal-owner-password-42');
  await page.getByLabel('Confirm password').fill('Meal-owner-password-42');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/settings');
  const ownerSettings = page.getByRole('region', { name: 'Optional meal checklist' });
  await ownerSettings.getByRole('button', { name: 'Enable checklist' }).click();
  await ownerSettings.getByText('Edit meal plan').click();
  await ownerSettings.getByLabel('Meal name').fill('Private meal');
  await ownerSettings.getByRole('button', { name: 'Add meal' }).click();
  await expect(ownerSettings.getByText('Meal plan saved.')).toBeVisible();
  await page.goto('/today');
  await page.getByText('Nutrition checklist').click();
  await page
    .getByRole('group', { name: /Did you eat Private meal as planned/ })
    .getByRole('button', { name: 'Ate as planned', exact: true })
    .click();

  const otherContext = await browser.newContext({ baseURL: 'http://localhost:3100' });
  try {
    const other = await otherContext.newPage();
    await other.goto('/register');
    await other.getByLabel('Your name').fill('Other Meal User');
    await other.getByLabel('Email address').fill(`other-meal-${tag}@example.test`);
    await other.getByLabel('Password', { exact: true }).fill('Other-meal-password-42');
    await other.getByLabel('Confirm password').fill('Other-meal-password-42');
    await other.getByRole('button', { name: 'Create account' }).click();
    await expect(other).toHaveURL(/\/dashboard/);
    await other.goto('/settings');
    const otherSettings = other.getByRole('region', { name: 'Optional meal checklist' });
    await expect(otherSettings.getByText('Edit meal plan (0/6)')).toBeVisible();
    await otherSettings.getByRole('button', { name: 'Enable checklist' }).click();
    await other.goto('/today');
    await other.getByText('Nutrition checklist').click();
    await expect(other.getByText('Private meal')).toHaveCount(0);
    await expect(
      other.getByText('Add meals in Settings to start this optional checklist.'),
    ).toBeVisible();
  } finally {
    await otherContext.close();
  }
});
