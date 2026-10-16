import { expect, test } from '@playwright/test';

test('monthly tracker toggles and persists completion across desktop and mobile', async ({
  page,
}) => {
  test.skip(!process.env.HABITFLOW_E2E_ISOLATED, 'Requires an isolated test database.');
  const suffix = Date.now();
  const habitName = `Tracker habit ${suffix}`;
  const habitDescription = 'The full details for this habit stay readable in the tracker.';
  const today = '2026-10-08';

  await page.goto('/register');
  await page.getByLabel('Your name').fill('Tracker Tester');
  await page.getByLabel('Email address').fill(`tracker-${suffix}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Tracker-test-password-42');
  await page.getByLabel('Confirm password').fill('Tracker-test-password-42');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto('/habits/new');
  await page.getByLabel(/Habit Name/).fill(habitName);
  await page.getByLabel('Description').fill(habitDescription);
  await page.getByLabel(/Monthly Target/).fill('1');
  await page.getByLabel('Start Date').fill(today);
  await page.getByRole('button', { name: 'Save Habit' }).click();
  await expect(page).toHaveURL(/\/habits$/);

  await page.goto('/dashboard');
  const row = page.getByRole('row', { name: new RegExp(habitName) });
  await expect(row).toContainText('0 / 1');
  const habitLabel = row.getByText(habitName, { exact: true });
  await habitLabel.hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText(habitName);
  await expect(tooltip).toContainText(habitDescription);
  const labelBox = await habitLabel.boundingBox();
  const tooltipBox = await tooltip.boundingBox();
  expect(labelBox && tooltipBox && tooltipBox.y + tooltipBox.height <= labelBox.y).toBeTruthy();
  await page.mouse.move(0, 0);
  await expect(tooltip).toBeHidden();
  await habitLabel.focus();
  await expect(tooltip).toBeVisible();
  await row.getByRole('button', { name: `Mark complete for ${habitName} on ${today}` }).click();
  await expect(row).toContainText('1 / 1');
  const donut = page
    .getByRole('heading', { name: 'Scheduled habit check-ins', exact: true })
    .locator('../..');
  await expect(donut).toContainText('1/1');
  await expect(donut).not.toContainText('100%');
  await page.reload();
  await expect(page.getByRole('row', { name: new RegExp(habitName) })).toContainText('1 / 1');
  await page
    .getByRole('row', { name: new RegExp(habitName) })
    .getByRole('button', { name: `Remove completion for ${habitName} on ${today}` })
    .click();
  await expect(page.getByRole('row', { name: new RegExp(habitName) })).toContainText('0 / 1');
  await page.reload();
  await expect(page.getByRole('row', { name: new RegExp(habitName) })).toContainText('0 / 1');

  const historicalHabitName = `Historical calendar ${suffix}`;
  await page.goto('/habits/new');
  await page.getByLabel(/Habit Name/).fill(historicalHabitName);
  await page.getByLabel(/Monthly Target/).fill('1');
  await page.getByLabel('Start Date').fill('2016-01-01');
  await page.getByRole('button', { name: 'Save Habit' }).click();
  await expect(page).toHaveURL(/\/habits$/);

  for (const [month, count, weekLengths] of [
    ['2025-02', 28, [7, 7, 7, 7]],
    ['2024-02', 29, [7, 7, 7, 7, 1]],
    ['2026-04', 30, [7, 7, 7, 7, 2]],
    ['2026-10', 31, [7, 7, 7, 7, 3]],
  ] as const) {
    await page.goto(`/dashboard?month=${month}`);
    await expect(page.locator('thead th[title]')).toHaveCount(count);
    const weekHeaders = page.locator('thead th[scope="colgroup"]');
    await expect(weekHeaders).toHaveCount(weekLengths.length);
    for (const [index, length] of weekLengths.entries()) {
      await expect(weekHeaders.nth(index)).toHaveText(`Week ${index + 1}`);
      await expect(weekHeaders.nth(index)).toHaveAttribute('colspan', String(length));
    }
  }
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page).toHaveURL(/month=2026-09/);
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page).toHaveURL(/month=2026-10/);
  await expect(page.getByRole('button', { name: 'Current month' })).toBeDisabled();

  const weekHeader = page.locator('thead tr').first();
  await expect(weekHeader).toBeVisible();
  const octoberHeight = await weekHeader.evaluate((row) => row.getBoundingClientRect().height);
  expect(octoberHeight).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page).toHaveURL(/month=2026-11/);
  await expect(page.locator('thead th[title]')).toHaveCount(30);
  await expect(weekHeader).toBeVisible();
  await expect
    .poll(() => weekHeader.evaluate((row) => row.getBoundingClientRect().height))
    .toBeCloseTo(octoberHeight, 0);
  await page.goto('/dashboard?month=2016-02');
  await expect(page.locator('thead th[title]')).toHaveCount(29);
  await expect(weekHeader).toBeVisible();
  await expect
    .poll(() => weekHeader.evaluate((row) => row.getBoundingClientRect().height))
    .toBeCloseTo(octoberHeight, 0);
  await expect(page.getByRole('row', { name: new RegExp(habitName) })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const scrollArea = page.getByLabel('Scroll monthly tracker horizontally');
  await expect(scrollArea).toBeVisible();
  const sizes = await scrollArea.evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  expect(sizes.scroll).toBeGreaterThan(sizes.client);
  await scrollArea.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await expect(
    page.getByRole('rowheader', { name: new RegExp(historicalHabitName) }),
  ).toBeVisible();
});
