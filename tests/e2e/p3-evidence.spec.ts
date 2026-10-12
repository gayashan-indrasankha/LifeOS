import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';

async function register(page: Page, prefix: string) {
  const tag = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await page.goto('/register');
  await page.getByLabel('Your name').fill('P3 Tester');
  await page.getByLabel('Email address').fill(`${tag}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Evidence-test-password-42');
  await page.getByLabel('Confirm password').fill('Evidence-test-password-42');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 90_000 });
  return tag;
}

test('projects show milestone progress without a separate quality review link', async ({
  page,
}) => {
  test.setTimeout(240_000);
  test.skip(!process.env.HABITFLOW_E2E_ISOLATED, 'Requires an isolated test database.');
  const tag = await register(page, 'p3-milestone');
  await page.goto('/goals?view=projects');
  await page.getByText('Add a project').click();
  const project = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Create project' }) });
  await project.locator('[name="name"]').fill(`Portfolio ${tag}`);
  await project.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('heading', { name: `Portfolio ${tag}` })).toBeVisible();
  await page.goto('/goals');
  await page.getByText('Add a task').click();
  const task = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add task' }) });
  await task.locator('[name="title"]').fill(`Auth milestone ${tag}`);
  await task.locator('[name="projectId"]').selectOption({ label: `Portfolio ${tag}` });
  await task.locator('[name="isMilestone"]').check();
  await task.getByRole('button', { name: 'Add task' }).click();
  await expect(page.getByRole('heading', { name: `Auth milestone ${tag}` })).toBeVisible();
  await page.goto('/goals?view=projects');
  await expect(page.getByText('0 of 1 complete')).toBeVisible();
  await expect(page.getByText('Review milestone quality')).toHaveCount(0);
});

test('interview, English, and weight practice can be managed on mobile', async ({ page }) => {
  test.setTimeout(240_000);
  test.skip(!process.env.HABITFLOW_E2E_ISOLATED, 'Requires an isolated test database.');
  await register(page, 'p3-skills');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/goals/evidence');
  const interview = page
    .locator('#interviews form')
    .filter({ has: page.getByRole('button', { name: 'Save practice' }) });
  await interview.locator('[name="topic"]').fill('JOINs');
  await interview.locator('[name="type"]').selectOption('technical_question');
  await interview.locator('[name="durationMinutes"]').fill('25');
  await interview.getByRole('button', { name: 'Save practice' }).click();
  await page.reload();
  await expect(page.locator('#interviews [name="topic"]')).toBeVisible();
  const interviewRecord = page.locator('#interviews article').filter({
    has: page.getByRole('heading', { name: 'JOINs' }),
  });
  await expect(interviewRecord).toContainText('Technical question · 25 min');
  await expect(page.locator('#interviews')).toContainText('25 minutes');
  await interviewRecord.getByRole('button', { name: 'Edit practice' }).click();
  const editInterview = interviewRecord
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Save changes' }) });
  await editInterview.locator('[name="topic"]').fill('SQL joins');
  await editInterview.locator('[name="durationMinutes"]').fill('30');
  await editInterview.getByRole('button', { name: 'Save changes' }).click();
  await page.reload();
  await expect(page.locator('#interviews article').filter({ hasText: 'SQL joins' })).toContainText(
    '30 min',
  );
  await interview.locator('[name="topic"]').fill('Accidental topic');
  await interview.getByRole('button', { name: 'Save practice' }).click();
  await page.reload();
  const accidental = page.locator('#interviews article').filter({ hasText: 'Accidental topic' });
  await accidental.getByRole('button', { name: 'Delete Accidental topic' }).click();
  await expect(accidental).toHaveCount(0);
  await interview.locator('[name="date"]').fill('2026-10-07');
  await interview.locator('[name="topic"]').fill('Earlier practice');
  await interview.getByRole('button', { name: 'Save practice' }).click();
  await page.reload();
  const earlier = page.locator('#interviews article').filter({ hasText: 'Earlier practice' });
  await expect(earlier).toBeVisible();
  await expect(earlier.getByRole('button', { name: 'Edit practice' })).toBeVisible();
  await expect(earlier.getByRole('button', { name: 'Delete Earlier practice' })).toBeVisible();
  const english = page
    .locator('#english form')
    .filter({ has: page.getByRole('button', { name: 'Save practice' }) });
  await english.locator('[name="topic"]').fill('Explain API design');
  await english.locator('[name="durationMinutes"]').fill('12');
  await english.getByRole('button', { name: 'Save practice' }).click();
  await page.reload();
  const englishRecord = page.locator('#english article').filter({ hasText: 'Explain API design' });
  await expect(englishRecord).toContainText('12 min');
  await englishRecord.getByRole('button', { name: 'Edit practice' }).click();
  const editEnglish = englishRecord
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Save changes' }) });
  await editEnglish.locator('[name="topic"]').fill('Explain REST APIs');
  await editEnglish.locator('[name="durationMinutes"]').fill('15');
  await editEnglish.getByRole('button', { name: 'Save changes' }).click();
  await page.reload();
  await expect(
    page.locator('#english article').filter({ hasText: 'Explain REST APIs' }),
  ).toContainText('15 min');
  await english.locator('[name="topic"]').fill('Accidental English practice');
  await english.getByRole('button', { name: 'Save practice' }).click();
  await page.reload();
  const accidentalEnglish = page
    .locator('#english article')
    .filter({ hasText: 'Accidental English practice' });
  await accidentalEnglish
    .getByRole('button', { name: 'Delete Accidental English practice' })
    .click();
  await expect(accidentalEnglish).toHaveCount(0);
  await english.locator('[name="topic"]').fill('Past English session');
  await english.getByRole('button', { name: 'Save practice' }).click();
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    await sql`
      UPDATE english_practices
      SET created_at = '2026-10-07T12:30:00Z'
      WHERE topic = 'Past English session'
    `;
  } finally {
    await sql.end();
  }
  await page.reload();
  const pastEnglish = page.locator('#english article').filter({ hasText: 'Past English session' });
  await expect(pastEnglish).toBeVisible();
  await expect(pastEnglish.getByRole('button', { name: 'Edit practice' })).toHaveCount(0);
  await expect(
    pastEnglish.getByRole('button', { name: 'Delete Past English session' }),
  ).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Body weight' })).toHaveCount(0);
  await page.goto('/today');
  const weight = page.locator('#today-weight');
  await weight.getByLabel('Weight (kg)').fill('72');
  await weight.getByRole('button', { name: 'Save weight' }).click();
  await expect(weight).toContainText('Recorded today: 72 kg');
  await page.goto('/dashboard');
  const homeWeight = page.getByRole('region', { name: 'Weight over time' });
  await expect(homeWeight).toContainText('72.0 kg');
  await expect(homeWeight.getByText('Measurement history and corrections')).toHaveCount(0);
});

test('an opportunity can be created at a selected stage', async ({ page }) => {
  test.skip(!process.env.HABITFLOW_E2E_ISOLATED, 'Requires an isolated test database.');
  await register(page, 'p3-app-stage');
  await page.goto('/goals/evidence');
  const create = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Save opportunity' }) });
  await create.locator('[name="company"]').fill('Stage Labs');
  await create.locator('[name="roleTitle"]').fill('QA Intern');
  await create.locator('[name="stage"]').selectOption('online_assessment');
  await expect(create.locator('[name="appliedOn"]')).toHaveAttribute('required', '');
  await create.locator('[name="appliedOn"]').fill('2026-10-08');
  await create.getByRole('button', { name: 'Save opportunity' }).click();
  await expect(create.getByRole('status')).toContainText('Submitted application recorded');
  await page.reload();
  const application = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: 'Stage Labs' }) });
  await expect(application).toContainText('Online assessment');
  await application.getByText('Stage history').click();
  await expect(application).toContainText('Added → Online assessment');
  await create.locator('[name="company"]').fill('Applied Labs');
  await create.locator('[name="roleTitle"]').fill('SE Intern');
  await create.locator('[name="appliedOn"]').fill('2026-10-08');
  await expect(create.locator('[name="stage"]')).toHaveValue('applied');
  await expect(create.locator('[name="stageOn"]')).toHaveCount(0);
  await create.getByRole('button', { name: 'Save opportunity' }).click();
  await expect(create.getByRole('status')).toContainText('Submitted application recorded');
  await page.reload();
  const applied = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: 'Applied Labs' }) });
  await expect(applied).toContainText('Applied');
  await expect(applied).toContainText('Submitted 2026-10-08');
  await expect(applied.getByText('Current stage since').locator('..')).toContainText('2026-10-08');
});

test('application stages, follow-up task, and ownership remain private', async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  test.skip(!process.env.HABITFLOW_E2E_ISOLATED, 'Requires an isolated test database.');
  await register(page, 'p3-app-owner');
  await page.goto('/goals/evidence');
  await expect(
    page.locator('#applications').getByRole('button', { name: 'Save opportunity' }),
  ).toHaveCount(1);
  const create = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Save opportunity' }) });
  await create.locator('[name="company"]').fill('Example Labs');
  await create.locator('[name="roleTitle"]').fill('SE Intern');
  await create.locator('[name="location"]').fill('Colombo');
  await create.getByRole('button', { name: 'Save opportunity' }).click();
  await expect(create.getByRole('status')).toContainText('Opportunity saved');
  await page.reload();
  const application = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: 'Example Labs' }) })
    .first();
  await expect(application).toContainText('Not submitted');
  await application.getByText('Edit details').click();
  await expect(application.locator('[name="location"]')).toHaveValue('Colombo');
  await expect(page.getByText(/0 submitted/)).toBeVisible();
  await application.getByText('Update stage').click();
  const stage = application
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Record stage' }) });
  await stage.locator('[name="stage"]').selectOption('applied');
  await stage.locator('[name="appliedOn"]').fill('2026-10-06');
  await expect(stage.locator('[name="stageOn"]')).toHaveCount(0);
  await stage.getByRole('button', { name: 'Record stage' }).click();
  await expect(stage.getByRole('status')).toContainText('stage recorded');
  await page.reload();
  await expect(page.getByText(/1 submitted/)).toBeVisible();
  await expect(application).toContainText('Submitted 2026-10-06');
  await expect(application.getByText('Current stage since').locator('..')).toContainText(
    '2026-10-06',
  );
  await application.getByText('Update stage').click();
  await expect(stage.locator('[name="appliedOn"]')).toHaveCount(0);
  await stage.locator('[name="stage"]').selectOption('online_assessment');
  await stage.locator('[name="stageOn"]').fill('2026-10-08');
  await stage.evaluate((form: HTMLFormElement) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'appliedOn';
    input.value = '2026-10-08';
    form.append(input);
  });
  await stage.getByRole('button', { name: 'Record stage' }).click();
  await expect(stage.getByRole('status')).toContainText('stage recorded');
  await page.reload();
  await expect(application).toContainText('Submitted 2026-10-06');
  await expect(application.getByText('Current stage since').locator('..')).toContainText(
    '2026-10-08',
  );
  await application.getByText('Stage history').click();
  await expect(application).toContainText('Not applied yet → Applied');
  await expect(application).toContainText('Applied → Online assessment');
  await application.getByText('Update stage').click();
  await stage.locator('[name="stageOn"]').fill('2026-10-07');
  await stage.getByRole('button', { name: 'Record stage' }).click();
  await expect(stage.getByRole('status')).toContainText('Stage date saved');
  await page.reload();
  await expect(application.getByText('Current stage since').locator('..')).toContainText(
    '2026-10-07',
  );
  await application.getByText('Stage history').click();
  await expect(
    application.locator('ol > li').filter({ hasText: 'Applied → Online assessment' }),
  ).toHaveCount(1);
  await application.getByText('Edit details').click();
  const edit = application
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Save application' }) });
  await edit.locator('[name="followUpDate"]').fill('2026-10-09');
  await edit.getByRole('button', { name: 'Save application' }).click();
  await expect(edit.getByRole('status')).toContainText('Application updated');
  await page.reload();
  await application.getByRole('button', { name: 'Create follow-up task' }).click();
  await page.reload();
  await expect(application).toContainText('Linked follow-up task created.');
  await application.getByText('Update stage').click();
  const ownerId = await application
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Record stage' }) })
    .locator('[name="id"]')
    .inputValue();
  const otherContext = await browser.newContext({ baseURL: 'http://localhost:3100' });
  try {
    const other = await otherContext.newPage();
    await register(other, 'p3-app-other');
    await other.goto('/goals/evidence');
    await expect(other.getByRole('heading', { name: 'Example Labs' })).toHaveCount(0);
    await expect(
      other.locator('#applications').getByRole('button', { name: 'Save opportunity' }),
    ).toHaveCount(1);
    const ownCreate = other
      .locator('form')
      .filter({ has: other.getByRole('button', { name: 'Save opportunity' }) });
    await ownCreate.locator('[name="company"]').fill('Other Labs');
    await ownCreate.locator('[name="roleTitle"]').fill('DevOps Intern');
    await ownCreate.getByRole('button', { name: 'Save opportunity' }).click();
    await expect(ownCreate.getByRole('status')).toContainText('Opportunity saved');
    await other.reload();
    const ownCard = other
      .locator('article')
      .filter({ has: other.getByRole('heading', { name: 'Other Labs' }) });
    await ownCard.getByText('Update stage').click();
    const ownStage = other
      .locator('article')
      .filter({ has: other.getByRole('heading', { name: 'Other Labs' }) })
      .locator('form')
      .filter({ has: other.getByRole('button', { name: 'Record stage' }) });
    await ownStage.locator('[name="stage"]').selectOption('applied');
    await ownStage.locator('[name="appliedOn"]').fill('2026-10-08');
    await ownStage.locator('[name="id"]').evaluate((input: HTMLInputElement, id) => {
      input.value = id;
    }, ownerId);
    await expect(ownStage.locator('[name="id"]')).toHaveValue(ownerId);
    await ownStage.getByRole('button', { name: 'Record stage' }).click();
    await expect(ownStage.getByRole('alert')).toContainText('not found');
    const ownDelete = ownCard
      .locator('form')
      .filter({ has: other.getByRole('button', { name: 'Delete opportunity at Other Labs' }) });
    await ownDelete.locator('[name="id"]').evaluate((input: HTMLInputElement, id) => {
      input.value = id;
    }, ownerId);
    await ownDelete.getByRole('button', { name: 'Delete opportunity at Other Labs' }).click();
    await expect(ownDelete.getByRole('alert')).toContainText('Opportunity not found');
    await page.reload();
    await expect(application).toBeVisible();
  } finally {
    await otherContext.close();
  }
  await application.getByRole('button', { name: 'Delete opportunity at Example Labs' }).click();
  await expect(application).toHaveCount(0);
});
