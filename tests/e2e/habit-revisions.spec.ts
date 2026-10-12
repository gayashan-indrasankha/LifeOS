import { expect, test } from '@playwright/test';
import postgres from 'postgres';

test('future habit schedule, archive, and restore preserve earlier checked days', async ({
  page,
}) => {
  test.skip(!process.env.HABITFLOW_E2E_ISOLATED, 'Requires an isolated test database.');
  const tag = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const name = `Dated habit ${tag}`;
  await page.goto('/register');
  await page.getByLabel('Your name').fill('Dated Habit');
  await page.getByLabel('Email address').fill(`dated-habit-${tag}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Dated-habit-password-42');
  await page.getByLabel('Confirm password').fill('Dated-habit-password-42');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/habits/new');
  await page.getByLabel(/Habit Name/).fill(name);
  await page.getByLabel(/Monthly Target/).fill('8');
  await page.getByLabel('Start Date').fill('2026-10-01');
  await page.getByRole('button', { name: 'Save Habit' }).click();
  await expect(page).toHaveURL(/\/habits$/);
  await page.goto('/dashboard?month=2026-10');
  const row = page.getByRole('row', { name: new RegExp(name) });
  await row.getByRole('button', { name: `Mark complete for ${name} on 2026-10-08` }).click();
  await expect(row).toContainText('1 / 8');

  await page.goto('/habits');
  await page.getByRole('button', { name: `Actions for ${name}` }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  await page.getByRole('combobox', { name: 'Schedule' }).click();
  await page.getByRole('option', { name: 'Three times per week' }).click();
  await page.getByLabel('Apply schedule changes from').fill('2026-10-09');
  await page.getByRole('button', { name: 'Save Habit' }).click();
  await expect(page).toHaveURL(/\/habits$/);
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    const revisions = await sql`
      SELECT r.schedule, r.effective_date
      FROM habit_schedule_revisions r
      JOIN habits h ON h.id = r.habit_id
      WHERE h.name = ${name}
      ORDER BY r.effective_date DESC
      LIMIT 1
    `;
    expect(revisions[0]?.schedule).toBe('weekly:3');
    expect(new Date(revisions[0]?.effective_date).toISOString().slice(0, 10)).toBe('2026-10-09');
  } finally {
    await sql.end();
  }
  await page.goto('/dashboard?month=2026-10');
  await expect(row).toContainText('1 / 8');
  await expect(
    row.getByRole('button', { name: `Remove completion for ${name} on 2026-10-08` }),
  ).toBeVisible();

  await page.goto('/habits');
  await page.getByRole('button', { name: `Actions for ${name}` }).click();
  await page.getByRole('menuitem', { name: 'Archive' }).click();
  await expect(page.getByText('Archived habits (1)')).toBeVisible();
  await page.goto('/dashboard?month=2026-10');
  await expect(row).toContainText('Archived');
  await page.goto('/habits');
  await page.getByText('Archived habits (1)').click();
  await page.getByRole('button', { name: `Actions for ${name}` }).click();
  await page.getByRole('menuitem', { name: 'Unarchive' }).click();
  await expect(page.getByText('Archived habits (1)')).toHaveCount(0);
  await page.goto('/dashboard?month=2026-10');
  await expect(row).toContainText('1 / 8');
  await expect(row).not.toContainText('Archived');
  await expect(
    row.getByRole('button', { name: `Remove completion for ${name} on 2026-10-08` }),
  ).toBeVisible();
});
