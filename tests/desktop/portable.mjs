import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { _electron as electron, expect } from '@playwright/test';

if (process.platform !== 'win32') throw new Error('Windows desktop verification requires Windows.');
const output = resolve('dist-desktop');
const version = JSON.parse(await readFile(resolve('package.json'), 'utf8')).version;
const installerName = `LifeOS Setup ${version}.exe`;
assert(
  (await readdir(output)).includes(installerName),
  `Expected built installer ${installerName}.`,
);
const executablePath = process.env.HABITFLOW_DESKTOP_EXE
  ? resolve(process.env.HABITFLOW_DESKTOP_EXE)
  : join(output, 'win-unpacked', 'LifeOS.exe');
const dataDir = await mkdtemp(join(tmpdir(), 'habitflow-portable-'));
const password = 'Portable-test-password-42';
const email = `portable-${Date.now()}@example.test`;
const habit = `Portable habit ${Date.now()}`;
let application;

async function closeCleanly(window) {
  const child = application.process();
  const exited = new Promise((resolve, reject) => {
    if (child.exitCode !== null) return resolve();
    const timeout = setTimeout(() => reject(new Error('Desktop shutdown timed out.')), 30_000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
  await window.close();
  await exited;
  application = undefined;
}

function desktopEnvironment() {
  const environment = {
    ...process.env,
    HABITFLOW_DESKTOP_DATA_DIR: dataDir,
    DATABASE_URL: 'postgresql://127.0.0.1:1/must-not-connect',
  };
  delete environment.ELECTRON_RUN_AS_NODE;
  return environment;
}

async function start() {
  application = await electron.launch({
    executablePath,
    env: desktopEnvironment(),
    timeout: 120_000,
  });
  assert.equal(await application.evaluate(({ app }) => app.getVersion()), version);
  const window = await application.firstWindow({ timeout: 90_000 });
  await window.waitForURL(/\/(login|register)(\?|$)/, { timeout: 90_000 });
  if (await window.getByRole('heading', { name: 'Log in to LifeOS' }).isVisible()) {
    await window.getByRole('link', { name: 'Create an account' }).click();
  }
  await expect(window.getByRole('heading', { name: 'Create your account' })).toBeVisible({
    timeout: 90_000,
  });
  return window;
}

try {
  let window = await start();
  await window.getByLabel('Your name').fill('Portable Release');
  await window.getByLabel('Email address').fill(email);
  await window.getByLabel('Password', { exact: true }).fill(password);
  await window.getByLabel('Confirm password').fill(password);
  const signUpResponse = window.waitForResponse((response) =>
    response.url().includes('/api/auth/sign-up/email'),
  );
  await window.getByRole('button', { name: 'Create account' }).click();
  const signUp = await signUpResponse;
  assert(signUp.ok(), `Packaged sign-up failed: HTTP ${signUp.status()}`);
  assert(
    (await window.context().cookies()).some(
      (cookie) => cookie.name === 'better-auth.session_token',
    ),
  );
  await expect(window).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  await expect(
    window
      .getByRole('navigation', { name: /^(Main|Mobile) navigation$/ })
      .getByRole('link', { name: 'Home' }),
  ).toBeVisible();
  const origin = new URL(window.url()).origin;
  assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
  await window.goto(`${origin}/habits/new`);
  await window.getByLabel(/Habit Name/).fill(habit);
  await window.getByLabel(/Monthly Target/).fill('1');
  await window.getByRole('button', { name: 'Save Habit' }).click();
  await expect(window).toHaveURL(/\/habits$/);
  await window.goto(`${origin}/dashboard`);
  const row = window.getByRole('row', { name: new RegExp(habit) });
  const completeButton = row.locator('button[aria-label^="Mark complete"]:not([disabled])').first();
  await expect(completeButton).toBeVisible();
  const completionDate = (await completeButton.getAttribute('aria-label'))?.match(
    /\d{4}-\d{2}-\d{2}$/,
  )?.[0];
  assert(completionDate, 'Expected an eligible completion date.');
  const completionSaved = window.waitForResponse(
    (response) => response.url().includes('/dashboard') && response.request().method() === 'POST',
  );
  const sessionBefore = await window.request.get(`${origin}/api/auth/get-session`);
  assert(
    sessionBefore.ok() && (await sessionBefore.json())?.user,
    'Session was lost before completion.',
  );
  await completeButton.click();
  const actionResponse = await completionSaved;
  const actionHeaders = await actionResponse.request().allHeaders();
  assert(
    actionHeaders.cookie && actionHeaders.origin === origin,
    'Completion request lost its session or origin.',
  );
  assert(actionResponse.ok(), 'Completion write failed.');
  await expect(row).toContainText('1 / 1');
  await window.reload();
  await expect(window.getByRole('row', { name: new RegExp(habit) })).toContainText('1 / 1', {
    timeout: 20_000,
  });
  await closeCleanly(window);

  application = await electron.launch({
    executablePath,
    env: desktopEnvironment(),
    timeout: 120_000,
  });
  window = await application.firstWindow({ timeout: 90_000 });
  await window.waitForURL(/\/(dashboard|login)(\?|$)/, { timeout: 90_000 });
  if (await window.getByRole('heading', { name: 'Log in to LifeOS' }).isVisible()) {
    await window.getByLabel('Email address').fill(email);
    await window.getByLabel('Password', { exact: true }).fill(password);
    await window.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect(window).toHaveURL(/\/dashboard/);
  }
  const secondOrigin = new URL(window.url()).origin;
  await expect(window).toHaveURL(/\/dashboard/);
  for (const route of ['/api/health', '/api/export', '/habits']) {
    const response = await window.request.get(`${secondOrigin}${route}`);
    assert.equal(response.status(), 200, `Restarted ${route}`);
    if (route === '/api/export') {
      const backup = await response.json();
      assert(
        backup.habits.some((record) => record.name === habit),
        'Restarted export lost the habit.',
      );
      assert(backup.habitEntries.length >= 1, 'Restarted export lost the completion.');
    }
  }
  await window.goto(`${secondOrigin}/dashboard?month=${completionDate.slice(0, 7)}`);
  await expect(window.getByRole('row', { name: new RegExp(habit) })).toContainText('1 / 1', {
    timeout: 20_000,
  });
  for (const route of ['/today', '/week', '/goals', '/goals/evidence', '/review']) {
    const response = await window.goto(`${secondOrigin}${route}`);
    assert.equal(response?.status(), 200, `Packaged route ${route}`);
  }
  await closeCleanly(window);
  console.log(
    `${executablePath} launch, authenticated UI, isolated PGlite, and restart persistence OK`,
  );
} finally {
  if (application) await application.close();
  const resolved = await realpath(dataDir);
  if (
    dirname(resolved) !== (await realpath(tmpdir())) ||
    !basename(resolved).startsWith('habitflow-portable-')
  )
    throw new Error('Unsafe portable test cleanup path.');
  await rm(resolved, { recursive: true, force: true });
}
