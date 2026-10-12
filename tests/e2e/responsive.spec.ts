import { expect, test } from '@playwright/test';

test.beforeEach(() => {
  test.skip(!process.env.HABITFLOW_E2E_ISOLATED, 'Requires an isolated test database.');
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`core routes remain usable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 860 });
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await assertNoPageOverflow(page, '/register');
    const suffix = `${width}-${Date.now()}`;
    await page.getByLabel('Your name').fill(`Responsive ${width}`);
    await page.getByLabel('Email address').fill(`responsive-${suffix}@example.test`);
    await page.getByLabel('Password', { exact: true }).fill('Responsive-test-password-42');
    await page.getByLabel('Confirm password').fill('Responsive-test-password-42');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    const routes = [
      ['/today', /Today|Thursday/],
      ['/week', /Your week/],
      ['/habits', /Habits/],
      ['/dashboard', /LifeOS/],
      ['/goals', /Goals & projects/],
      ['/goals/evidence', /Evidence & career readiness/],
      ['/review', /Notice, learn, adjust/],
      ['/settings', /Settings/],
    ] as const;
    for (const [route, heading] of routes) {
      await page.goto(route);
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
      await assertNoPageOverflow(page, route);
    }

    const nav = page.getByRole('navigation', {
      name: width < 1024 ? 'Mobile navigation' : 'Main navigation',
    });
    if (width < 1024) {
      await expect(nav.getByRole('link', { name: 'Settings' })).toBeInViewport();
    }
    await expect(nav.getByRole('link').first()).toHaveText('Home');
    await nav.getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await nav.getByRole('link', { name: 'Today' }).click();
    await expect(page).toHaveURL(/\/today/);
    await expect(nav.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    await nav.getByRole('link', { name: 'Week' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/week/);

    await page.goto('/habits/new');
    await expect(page.getByLabel(/Habit Name/)).toBeVisible();
    await assertNoPageOverflow(page, '/habits/new');
    if ([320, 390, 1440].includes(width)) {
      await page.screenshot({
        path: testInfo.outputPath(`habit-form-${width}.png`),
        fullPage: true,
        caret: 'initial',
      });
    }
  });
}

async function assertNoPageOverflow(page: import('@playwright/test').Page, route: string) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll<HTMLElement>('main *')]
      .filter(
        (element) =>
          element.getBoundingClientRect().right > document.documentElement.clientWidth + 1,
      )
      .slice(0, 8)
      .map(
        (element) =>
          `${element.tagName.toLowerCase()}.${element.className}=${Math.round(element.getBoundingClientRect().right)}`,
      ),
  }));
  expect(
    dimensions.page,
    `${route} page overflow at ${dimensions.viewport}px: ${dimensions.overflowing.join('; ')}`,
  ).toBeLessThanOrEqual(dimensions.viewport + 1);
}
