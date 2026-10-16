import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import postgres from 'postgres';
import { chromium, devices, expect } from '@playwright/test';

// Production-only, isolated benchmark. Never reads the configured application DB.
const require = createRequire(import.meta.url);
const { startEmbeddedDatabase, freeLoopbackPort } = require('../desktop/runtime.cjs');
const root = process.cwd();
const budgetArgument = process.argv.find((argument) => argument.startsWith('--budget='));
const budget = budgetArgument ? Number(budgetArgument.slice('--budget='.length)) : null;
if (budget !== null && (!Number.isFinite(budget) || budget <= 0)) {
  throw new Error('Use a positive millisecond budget, for example --budget=300.');
}
const outputDir = path.join(root, '.desktop-test', `performance-${Date.now()}`);
await mkdir(outputDir, { recursive: true });
const database = await startEmbeddedDatabase(
  path.join(outputDir, 'db'),
  path.join(root, 'lib/db/migrations'),
);
const port = await freeLoopbackPort();
const origin = `http://localhost:${port}`;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date());
const dayBefore = new Date(`${today}T12:00:00Z`);
dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
const historyStart = new Date(dayBefore);
historyStart.setUTCDate(historyStart.getUTCDate() - 652);
const startDate = historyStart.toISOString().slice(0, 10);
const yesterday = dayBefore.toISOString().slice(0, 10);
const env = {
  ...process.env,
  DATABASE_URL: database.url,
  HABITFLOW_EMBEDDED_DB: '1',
  BETTER_AUTH_URL: origin,
  NEXT_PUBLIC_APP_URL: origin,
  BETTER_AUTH_SECRET: 'isolated-performance-benchmark-secret-123456789',
};
delete env.HABITFLOW_E2E_ISOLATED;
env.PORT = String(port);
env.HOSTNAME = '127.0.0.1';
const standalone = path.join(root, '.next', 'standalone');
await cp(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'), {
  recursive: true,
});
await cp(path.join(root, 'public'), path.join(standalone, 'public'), { recursive: true });
const server = spawn(process.execPath, [path.join(standalone, 'server.js')], {
  cwd: standalone,
  env,
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (chunk) => {
  serverLog += chunk;
});
server.stderr.on('data', (chunk) => {
  serverLog += chunk;
});
let sql;
let browser;
const summary = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    median: Math.round(sorted[Math.floor(sorted.length / 2)]),
    p95: Math.round(sorted[Math.ceil(sorted.length * 0.95) - 1]),
    samples: values.map(Math.round),
  };
};
const results = {
  environment: 'local production / isolated PGlite / no network throttling',
  clients: {},
};
try {
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch(`${origin}/api/health`)).ok) break;
    } catch {
      /* Server is starting. */
    }
    if (attempt > 120 || server.exitCode !== null) throw new Error(serverLog);
    await delay(250);
  }
  browser = await chromium.launch({
    channel: process.env.HABITFLOW_E2E_BROWSER_CHANNEL || 'chrome',
  });
  const anonymous = await browser.newContext();
  try {
    const missing = await anonymous.request.get(`${origin}/today`);
    assert.equal(new URL(missing.url()).pathname, '/login');
    await anonymous.addCookies([
      { name: 'better-auth.session_token', value: 'forged-token', url: origin },
    ]);
    const invalid = await anonymous.request.get(`${origin}/today`);
    assert.equal(new URL(invalid.url()).pathname, '/login', 'forged sessions cannot access pages');
    const unauthorized = await anonymous.request.get(`${origin}/api/export`);
    assert.equal(unauthorized.status(), 401);
  } finally {
    await anonymous.close();
  }
  for (const mobile of [false, true]) {
    const label = mobile ? 'android-webview' : 'desktop-web';
    const context = await browser.newContext(
      mobile
        ? {
            ...devices['Pixel 7'],
            userAgent: `${devices['Pixel 7'].userAgent} LifeOSAndroid/1`,
          }
        : { viewport: { width: 1440, height: 1000 } },
    );
    context.setDefaultTimeout(15000);
    try {
      sql = postgres(database.url, { max: 1, prepare: false });
      const signup = await context.request.post(`${origin}/api/auth/sign-up/email`, {
        data: {
          name: 'Performance Tester',
          email: `${label}@example.test`,
          password: 'Performance-test-password-42',
        },
        headers: { Origin: origin },
      });
      assert.equal(signup.status(), 200, await signup.text());
      const { user } = await signup.json();
      await sql`insert into user_settings (user_id, timezone, nutrition_enabled) values (${user.id}, 'Asia/Colombo', true)`;
      const habits = await sql`
        insert into habits (user_id, name, schedule, start_date, sort_order)
        select ${user.id}, 'Benchmark habit ' || n, 'daily', ${startDate}, n
        from generate_series(1, 20) n returning id`;
      await sql`
        insert into habit_schedule_revisions (user_id, habit_id, effective_date, schedule, start_date)
        select user_id, id, ${startDate}, schedule, start_date from habits where user_id = ${user.id}`;
      await sql`
        insert into habit_entries (user_id, habit_id, date, completed)
        select h.user_id, h.id, d::date, true from habits h,
        generate_series(${startDate}::date, ${yesterday}::date, '1 day'::interval) d
        where h.user_id = ${user.id}`;
      await sql`
        insert into tasks (user_id, title, scheduled_date)
        select ${user.id}, 'Benchmark task ' || n, ${today} from generate_series(1, 30) n`;
      for (const [index, count] of [392, 617, 6].entries()) {
        const checklist = Array.from({ length: count }, (_, item) => ({
          id: randomUUID(),
          text: `Checklist practice ${item + 1}`,
          done: false,
          section: `Section ${Math.floor(item / 30) + 1}`,
        }));
        await sql`update tasks set checklist=${JSON.stringify(checklist)},
          recurrence='daily', checklist_reset_daily=true, due_date=${today}::date + 180
          where user_id=${user.id} and title=${`Benchmark task ${index + 1}`}`;
      }
      await sql`insert into meal_templates (user_id,name,planned_calories) values (${user.id},'Benchmark breakfast',500)`;
      await sql.end();
      sql = undefined;
      const routes = [
        '/dashboard',
        '/today',
        '/week',
        '/habits',
        '/goals',
        '/review',
        '/notes',
        '/settings',
      ];
      const client = { routes: {}, navigation: {}, habitSave: {} };
      results.clients[label] = client;
      for (const route of routes) {
        const times = [];
        for (let n = 0; n < 6; n++) {
          const start = performance.now();
          const response = await context.request.get(`${origin}${route}`);
          assert.equal(response.status(), 200, route);
          await response.body();
          if (n) times.push(performance.now() - start);
        }
        client.routes[route] = summary(times);
      }
      console.log(label, 'route timings', JSON.stringify(client.routes));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${origin}/dashboard`);
      await page
        .getByRole('button', {
          name: `Mark complete for Benchmark habit 1 on ${today}`,
          exact: true,
        })
        .waitFor();
      await delay(3500); // Let route prefetch finish before measuring warm navigation.
      const nav = page.getByRole('navigation', {
        name: mobile ? 'Mobile navigation' : 'Main navigation',
        exact: true,
      });
      for (const [name, heading] of [
        ['Today', 'Today'],
        ['Week', 'Your week'],
        ['Home', 'LifeOS'],
      ]) {
        const start = performance.now();
        await nav.getByRole('link', { name, exact: true }).click();
        await page.getByRole('heading', { name: heading, exact: true }).first().waitFor();
        client.navigation[name] = Math.round(performance.now() - start);
      }
      console.log(label, 'navigation', JSON.stringify(client.navigation));
      const saveTimes = [];
      const feedbackTimes = [];
      const cell = page.getByRole('button', {
        name: new RegExp(`(?:Mark complete|Remove completion) for Benchmark habit 1 on ${today}$`),
      });
      for (let n = 0; n < 3; n++) {
        await cell.waitFor({ state: 'visible' });
        await page.waitForFunction(
          (today) => {
            const button = document.querySelector(
              `button[aria-label$="for Benchmark habit 1 on ${today}"]`,
            );
            return button && !button.disabled;
          },
          today,
          { timeout: 15000 },
        );
        const wasChecked = (await cell.getAttribute('aria-pressed')) === 'true';
        console.log(label, 'starting save', n);
        const saved = page.waitForResponse(
          (response) =>
            response.request().method() === 'POST' && !!response.request().headers()['next-action'],
        );
        const start = performance.now();
        await cell.click();
        await page.waitForFunction(
          ({ checked }) => {
            const button = [...document.querySelectorAll('button')].find((b) =>
              /(?:Mark complete|Remove completion) for Benchmark habit 1 on/.test(
                b.getAttribute('aria-label') || '',
              ),
            );
            return button?.getAttribute('aria-pressed') === String(checked);
          },
          { checked: !wasChecked },
        );
        feedbackTimes.push(performance.now() - start);
        const response = await saved;
        // The action resolves before any optional RSC streaming tail closes.
        // Measure when the control is usable again, then independently verify
        // the committed value rather than waiting on the transport tail.
        await expect(cell).toBeEnabled({ timeout: 15000 });
        assert.equal(response.status(), 200);
        saveTimes.push(performance.now() - start);
        const committed = await (await context.request.get(`${origin}/api/export`)).json();
        const entry = committed.habitEntries.find(
          (item) => item.habitId === habits[0].id && item.date === today,
        );
        assert.equal(entry?.completed ?? false, !wasChecked, 'action value is committed');
        console.log(label, 'save', n, Math.round(saveTimes.at(-1)));
      }
      client.habitSave = {
        feedback: summary(feedbackTimes),
        committedAction: summary(saveTimes),
      };
      const backup = await (await context.request.get(`${origin}/api/export`)).json();
      const savedEntry = backup.habitEntries.find(
        (entry) => entry.habitId === habits[0].id && entry.date === today,
      );
      assert.equal(savedEntry?.completed, true, 'saved completion persists in the database');
      assert.equal(backup.habits.length, 20, 'other accounts remain private');
      await page.goto(`${origin}/habits`);
      await page.getByRole('button', { name: 'Change order', exact: true }).click();
      await page.getByRole('button', { name: 'Move Benchmark habit 2 up', exact: true }).click();
      await expect(page.locator('#active-habit-list > li').first()).toContainText(
        'Benchmark habit 2',
      );
      await expect(
        page.getByRole('button', { name: 'Move Benchmark habit 2 down', exact: true }),
      ).toBeEnabled();
      await page.reload();
      await expect(page.locator('#active-habit-list > li').first()).toContainText(
        'Benchmark habit 2',
      );
      await page.goto(`${origin}/today`);
      assert.ok(
        (await page.locator('main form').count()) < 200,
        'closed checklists must not mount item forms',
      );
      await page.getByText('Daily checklist', { exact: true }).first().click();
      await page.getByText('Section 1', { exact: true }).first().click();
      const completeItem = page.getByRole('button', {
        name: 'Complete Checklist practice 1',
        exact: true,
      });
      await completeItem.click();
      await expect(
        page.getByRole('button', { name: 'Reopen Checklist practice 1', exact: true }),
      ).toBeVisible();
      await page.reload();
      await page.getByText('Daily checklist', { exact: true }).first().click();
      await page.getByText('Section 1', { exact: true }).first().click();
      await expect(
        page.getByRole('button', { name: 'Reopen Checklist practice 1', exact: true }),
      ).toBeVisible();
      await page.getByText('Nutrition checklist', { exact: true }).click();
      const meal = page.getByRole('group', { name: /Did you eat Benchmark breakfast as planned/ });
      await meal.getByRole('button', { name: 'Ate as planned', exact: true }).click();
      await expect(
        meal.getByRole('button', { name: 'Ate as planned', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await page.getByText('Add actual amounts', { exact: true }).click();
      const actual = page.getByRole('form', { name: /Actual amounts for Benchmark breakfast/ });
      await actual.locator('[name="actualCalories"]').fill('350');
      await actual.getByRole('button', { name: 'Save actual amounts', exact: true }).click();
      await expect(actual.getByText('Saved', { exact: true })).toBeVisible();
      await page.reload();
      await page.getByText('Nutrition checklist', { exact: true }).click();
      await expect(
        meal.getByRole('button', { name: 'Ate as planned', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByText('350 kcal consumed', { exact: true })).toBeVisible();
      client.persistence =
        'habit completion, habit ordering, large daily checklist item completion, meal status and actual amounts survive reload';
      assert.deepEqual(errors, [], 'browser errors');
      console.log(label, JSON.stringify(client));
    } finally {
      await context.close();
    }
  }
  const report = path.join(outputDir, 'results.json');
  await writeFile(report, JSON.stringify(results, null, 2));
  console.log(`Report: ${report}`);
  if (budget !== null) {
    const failures = [];
    for (const [name, client] of Object.entries(results.clients)) {
      for (const [route, timing] of Object.entries(client.routes)) {
        if (timing.p95 > budget) failures.push(`${name} ${route}: ${timing.p95} ms`);
      }
      for (const [route, timing] of Object.entries(client.navigation)) {
        if (timing > budget) failures.push(`${name} navigate ${route}: ${timing} ms`);
      }
      for (const [kind, timing] of Object.entries(client.habitSave)) {
        if (timing.p95 > budget) failures.push(`${name} save ${kind}: ${timing.p95} ms`);
      }
    }
    if (failures.length) {
      console.error(`Exceeded ${budget} ms budget:\n${failures.join('\n')}`);
      process.exitCode = 1;
    }
  }
} finally {
  await browser?.close();
  server.kill();
  await sql?.end();
  await database.close();
  await writeFile(path.join(outputDir, 'server.log'), serverLog);
  await writeFile(path.join(outputDir, 'results.json'), JSON.stringify(results, null, 2));
}
