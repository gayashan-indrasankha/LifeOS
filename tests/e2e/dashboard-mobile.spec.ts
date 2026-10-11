import { expect, test } from '@playwright/test';

test('Home dashboard stays usable from small phones through desktop', async ({ page }) => {
  test.skip(!process.env.HABITFLOW_E2E_ISOLATED, 'Requires an isolated test database.');
  test.setTimeout(240_000);
  await page.goto('/register');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Your name').fill('Dashboard Responsive');
  await page.getByLabel('Email address').fill(`dashboard-responsive-${Date.now()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Responsive-test-password-42');
  await page.getByLabel('Confirm password').fill('Responsive-test-password-42');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto('/habits/new');
  await page.getByLabel(/Habit Name/).fill('Responsive habit with a longer name');
  await page.getByLabel(/Monthly Target/).fill('1');
  await page.getByLabel('Start Date').fill('2026-10-01');
  await page.getByRole('button', { name: 'Save Habit' }).click();
  await expect(page).toHaveURL(/\/habits$/);

  await page.goto('/dashboard?month=2026-10');
  await expect(page.getByRole('heading', { name: 'Monthly habits' })).toBeVisible();
  await expect(page.locator('.recharts-surface').first()).toBeVisible();

  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 860 });
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(dimensions.page, `dashboard page overflow at ${width}px`).toBeLessThanOrEqual(
      dimensions.viewport + 1,
    );
    const tracker = page.getByLabel('Scroll monthly tracker horizontally');
    const trackerWidths = await tracker.evaluate((element) => ({
      client: element.clientWidth,
      scroll: element.scrollWidth,
    }));
    expect(trackerWidths.scroll).toBeGreaterThan(trackerWidths.client);
    if (width < 640) {
      const progress = await page.getByRole('columnheader', { name: 'Progress' }).boundingBox();
      const scrollBox = await tracker.boundingBox();
      expect(
        progress && scrollBox && progress.x + progress.width <= scrollBox.x + scrollBox.width + 1,
      ).toBeTruthy();
      const todayHeader = page.locator('thead th[data-habit-date][class*="sm:bg-primary/10"]');
      await expect.poll(async () => {
        const todayBox = await todayHeader.boundingBox();
        return !!(todayBox && progress && scrollBox
          && todayBox.x >= progress.x + progress.width - 1
          && todayBox.x + todayBox.width <= scrollBox.x + scrollBox.width + 1);
      }).toBeTruthy();
      const fixedBefore = await Promise.all(
        ['Habit', 'Goal', 'Progress'].map(async (name) =>
          (await page.getByRole('columnheader', { name }).boundingBox())?.x),
      );
      await tracker.evaluate((element) => {
        element.scrollLeft += 200;
      });
      const fixedAfter = await Promise.all(
        ['Habit', 'Goal', 'Progress'].map(async (name) =>
          (await page.getByRole('columnheader', { name }).boundingBox())?.x),
      );
      fixedAfter.forEach((x, index) => expect(x).toBeCloseTo(fixedBefore[index]!, 0));
      const cards = page.locator('section[aria-label="Habit analytics"] .analytics-card');
      await expect(cards).toHaveCount(6);
      await expect(cards.nth(0)).toContainText('Current activity streak');
      await expect(cards.nth(1)).toContainText('Top fixed-schedule habits');
      await expect(cards.nth(2)).toContainText('Daily Progress');
      await expect(cards.nth(3)).toContainText('last 8 weeks');
      await expect(cards.nth(4)).toContainText('Scheduled habit check-ins');
      await expect(cards.nth(5)).toContainText('Journal');
    }
    const navigation = page.getByRole('navigation', {
      name: width < 1024 ? 'Mobile navigation' : 'Main navigation',
    });
    await expect(navigation.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    if (width < 1024) {
      const navMeasurements = await navigation.evaluate((element) => ({
        client: element.clientWidth,
        scroll: element.scrollWidth,
        rows: new Set(
          [...element.querySelectorAll('a')].map((link) => link.getBoundingClientRect().top),
        ).size,
      }));
      expect(navMeasurements.rows).toBe(1);
      if (width < 640) expect(navMeasurements.scroll).toBeGreaterThan(navMeasurements.client);
    }
    if (width === 320) {
      await tracker.evaluate((element) => {
        element.scrollLeft = element.scrollWidth;
      });
      expect(await tracker.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    }
  }
});
