import { expect, test, type Page } from '@playwright/test';

async function register(page: Page, label: string) {
  const tag = `${label.toLowerCase().replaceAll(' ', '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const email = `${tag}@example.test`;
  const password = 'Release-test-password-42';
  await page.goto('/register');
  await page.getByLabel('Your name').fill(label);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  return { email, password, tag };
}

test.beforeEach(() => {
  test.skip(!process.env.HABITFLOW_E2E_ISOLATED, 'Requires an isolated test database.');
});

test('invalid credentials and a cleared session cannot open private routes or export', async ({
  page,
  context,
}) => {
  const user = await register(page, 'Auth Release');
  await context.clearCookies();
  await page.goto('/goals/evidence');
  await expect(page).toHaveURL(/\/login\?next=/);
  const denied = await page.request.get('/api/export');
  expect(denied.status()).toBe(401);

  await page.goto('/login');
  await page.getByLabel('Email address').fill('not-an-email');
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await page.getByLabel('Email address').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('Wrong-password-42');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(
    page.getByText('The email or password is incorrect. Please try again.'),
  ).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test('monthly insights show evidence and measured outcomes', async ({ page }) => {
  await register(page, 'Review Release');
  await page.goto('/review');
  await expect(page.getByRole('heading', { name: 'Notice, learn, adjust' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Evidence by period' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recorded outcomes' })).toBeVisible();

  await page.getByRole('link', { name: 'Open evidence' }).click();
  await expect(page.getByRole('heading', { name: 'Evidence & career readiness' })).toBeVisible();
  await page.goto('/today');
  const measurement = page.locator('#today-weight');
  await measurement.getByLabel('Weight (kg)').fill('71');
  await measurement.getByRole('button', { name: 'Save weight' }).click();
  await expect(measurement).toContainText('Recorded today: 71 kg');
  await page.goto('/review');
  await expect(page.getByText('Days with weight readings').locator('..')).toContainText('1');
});

test('private JSON export includes owned records and excludes credentials and another user', async ({
  page,
  browser,
}) => {
  const owner = await register(page, 'Export Owner');
  const privateNote = `private-note-${owner.tag}`;
  await page.goto('/today');
  await page.getByText('Finish your day').click();
  await page.getByRole('textbox', { name: 'Daily journal entry' }).fill(privateNote);
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
  await page.goto('/notes');
  await expect(page.getByText(privateNote)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save entry' })).toHaveCount(0);
  const ownerResponse = await page.request.get('/api/export');
  expect(ownerResponse.status()).toBe(200);
  expect(ownerResponse.headers()['cache-control']).toContain('no-store');
  const ownerData = await ownerResponse.json();
  expect(ownerData.schemaVersion).toBe(2);
  expect(ownerData.dailyNotes).toEqual(
    expect.arrayContaining([expect.objectContaining({ content: privateNote })]),
  );
  for (const forbidden of [
    'account',
    'session',
    'password',
    'token',
    'BETTER_AUTH_SECRET',
    owner.password,
  ])
    expect(JSON.stringify(ownerData)).not.toContain(forbidden);

  const otherContext = await browser.newContext({ baseURL: 'http://localhost:3100' });
  try {
    const otherPage = await otherContext.newPage();
    await register(otherPage, 'Export Other');
    const otherResponse = await otherPage.request.get('/api/export');
    expect(otherResponse.status()).toBe(200);
    expect(JSON.stringify(await otherResponse.json())).not.toContain(privateNote);
  } finally {
    await otherContext.close();
  }
});
