const { spawn } = require('node:child_process');
const { mkdtempSync, realpathSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const postgres = require('postgres');
const { startEmbeddedDatabase, freeLoopbackPort } = require('../desktop/runtime.cjs');

async function waitForHealthy(origin, child) {
  let last = 'no response';
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) throw new Error('Server stopped before becoming healthy.');
    try {
      const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : 'connection failed';
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server health check timed out (${last}).`);
}

async function main() {
  const packageRoot = process.env.HABITFLOW_SMOKE_ROOT
    ? path.resolve(process.env.HABITFLOW_SMOKE_ROOT)
    : path.resolve();
  const buildDir = process.env.HABITFLOW_SMOKE_BUILD_DIR === '.next-e2e' ? '.next-e2e' : '.next';
  const dataRoot = mkdtempSync(path.join(tmpdir(), 'habitflow-smoke-'));
  const database = await startEmbeddedDatabase(
    path.join(dataRoot, 'server-smoke-db'),
    path.join(packageRoot, 'lib/db/migrations'),
  );
  let child;
  try {
    const port = await freeLoopbackPort();
    const origin = `http://127.0.0.1:${port}`;
    const executable = process.env.HABITFLOW_SMOKE_EXECUTABLE || process.execPath;
    child = spawn(executable, [path.join(packageRoot, buildDir, 'standalone/server.js')], {
      cwd: path.join(packageRoot, buildDir, 'standalone'),
      windowsHide: true,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...(process.env.HABITFLOW_SMOKE_EXECUTABLE ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
        NODE_ENV: 'production',
        VERCEL_ENV: '',
        HOSTNAME: '127.0.0.1',
        PORT: String(port),
        DATABASE_URL: database.url,
        HABITFLOW_EMBEDDED_DB: '1',
        BETTER_AUTH_URL: origin,
        NEXT_PUBLIC_APP_URL: origin,
        BETTER_AUTH_SECRET: crypto.randomBytes(48).toString('base64url'),
      },
    });
    await waitForHealthy(origin, child);
    const email = `desktop-${crypto.randomUUID()}@example.test`;
    const response = await fetch(`${origin}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({
        name: 'Desktop Smoke',
        email,
        password: 'Desktop-smoke-password-42',
      }),
    });
    if (!response.ok) throw new Error(`Registration failed: HTTP ${response.status}`);
    const cookies = response.headers
      .getSetCookie()
      .map((value) => value.split(';', 1)[0])
      .join('; ');
    if (!cookies) throw new Error('Registration returned no session cookie.');
    for (const route of [
      '/today',
      '/week',
      '/goals',
      '/goals/evidence',
      '/review',
      '/dashboard',
      '/api/export',
    ]) {
      const response = await fetch(`${origin}${route}`, {
        headers: { Cookie: cookies },
        redirect: 'manual',
      });
      if (response.status !== 200)
        throw new Error(`Authenticated ${route} failed: HTTP ${response.status}`);
      if (route === '/api/export') {
        const backup = await response.json();
        if (
          backup.schemaVersion !== 2 ||
          !Array.isArray(backup.habits) ||
          'account' in backup ||
          'session' in backup
        )
          throw new Error('Backup schema or privacy check failed');
      }
    }
    const sql = postgres(database.url, { max: 1 });
    try {
      const [owner] = await sql`SELECT id FROM "user" WHERE email = ${email}`;
      const [habit] =
        await sql`INSERT INTO habits (user_id,name,start_date) VALUES (${owner.id},'Desktop persisted smoke','2026-10-08') RETURNING id`;
      await sql`INSERT INTO habit_entries (user_id,habit_id,date) VALUES (${owner.id},${habit.id},'2026-10-08')`;
    } finally {
      await sql.end();
    }
    const history = await fetch(`${origin}/dashboard?month=2026-10`, {
      headers: { Cookie: cookies },
      redirect: 'manual',
    });
    if (history.status !== 200)
      throw new Error(`Desktop completion history failed: HTTP ${history.status}`);
    if (!(await history.text()).includes('Desktop persisted smoke'))
      throw new Error('Desktop habit history missing');
    if (process.env.HABITFLOW_SMOKE_BROWSER_UI === '1') {
      const { chromium, expect } = require('@playwright/test');
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        const name = `Browser smoke ${crypto.randomUUID()}`;
        await page.goto(`${origin}/register`);
        await page.getByLabel('Your name').fill('Browser Smoke');
        await page.getByLabel('Email address').fill(`browser-${crypto.randomUUID()}@example.test`);
        await page.getByLabel('Password', { exact: true }).fill('Browser-smoke-password-42');
        await page.getByLabel('Confirm password').fill('Browser-smoke-password-42');
        await page.getByRole('button', { name: 'Create account' }).click();
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
        await page.goto(`${origin}/habits/new`);
        await page.getByLabel(/Habit Name/).fill(name);
        await page.getByLabel(/Monthly Target/).fill('1');
        await page.getByRole('button', { name: 'Save Habit' }).click();
        await expect(page).toHaveURL(/\/habits$/);
        await page.goto(`${origin}/dashboard`);
        const row = page.getByRole('row', { name: name });
        const button = row.locator('button[aria-label^="Mark complete"]:not([disabled])').first();
        const written = page.waitForResponse(
          (response) =>
            response.url().includes('/dashboard') && response.request().method() === 'POST',
        );
        await button.click();
        if (!(await written).ok()) throw new Error('Embedded browser completion request failed');
        await page.reload();
        await expect(page.getByRole('row', { name: name })).toContainText('1 / 1', {
          timeout: 20_000,
        });
      } finally {
        await browser.close();
      }
    }
    console.log('Embedded database, migrations, health, registration, main routes, and export OK');
  } finally {
    if (child && child.exitCode === null) child.kill();
    await database.close();
    const resolved = realpathSync(dataRoot);
    if (
      path.dirname(resolved) !== realpathSync(tmpdir()) ||
      !path.basename(resolved).startsWith('habitflow-smoke-')
    )
      throw new Error('Unsafe smoke cleanup path');
    rmSync(resolved, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
