// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '@/lib/db/schema';
import { sectionLabels } from '@/lib/life-os/preset';

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
import {
  installPersonalLifeOs,
  previewPersonalLifeOs,
  type SetupOptions,
} from '@/lib/life-os/install';

const options: SetupOptions = {
  sections: Object.keys(sectionLabels) as SetupOptions['sections'],
  confirm: true,
};
let client: PGlite;
const count = async (table: string, user = 'owner') =>
  (
    await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM ${table} WHERE user_id=$1`,
      [user],
    )
  ).rows[0].count;

describe('Personal Life OS isolated PGlite installation', () => {
  beforeAll(async () => {
    process.env.HABITFLOW_TEST_NOW = '2026-10-09T06:00:00Z';
    client = new PGlite();
    state.db = drizzle({ client, schema });
    await migrate(state.db as ReturnType<typeof drizzle>, {
      migrationsFolder: 'lib/db/migrations',
    });
    await client.query(
      `INSERT INTO "user" (id,name,email) VALUES ('owner','Owner','life-os-owner@example.test'),('other','Other','life-os-other@example.test')`,
    );
  }, 120_000);
  afterAll(async () => {
    await client?.close();
    delete process.env.HABITFLOW_TEST_NOW;
  });

  it('previews without writes, installs linked data, and repeats without duplicates', async () => {
    const preview = await previewPersonalLifeOs('owner', options);
    expect(preview.items.filter((item) => item.status === 'new')).toHaveLength(82);
    expect(preview.items.some((item) => item.type === 'Weekly block')).toBe(false);
    expect(await count('goals')).toBe(0);
    const result = await installPersonalLifeOs('owner', options);
    expect(result.conflicts).toBe(0);
    expect(result.created).toBe(82);
    expect(await count('goals')).toBe(8);
    expect(await count('projects')).toBe(3);
    expect(await count('tasks')).toBe(30);
    expect(await count('subjects')).toBe(5);
    expect(await count('habits')).toBe(8);
    expect(await count('time_blocks')).toBe(0);
    expect(await count('interview_topics')).toBe(21);
    expect(await count('meal_templates')).toBe(6);
    const blankMeals = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM meal_templates WHERE user_id='owner' AND planned_calories IS NULL AND planned_protein IS NULL AND planned_carbs IS NULL AND planned_fat IS NULL`,
    );
    expect(blankMeals.rows[0].count).toBe(6);
    const unplannedTasks = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM tasks WHERE user_id='owner' AND scheduled_date IS NULL AND daily_priority IS NULL`,
    );
    expect(unplannedTasks.rows[0].count).toBe(30);
    const nutrition = await client.query<{ nutrition_enabled: boolean }>(
      'SELECT nutrition_enabled FROM user_settings WHERE user_id=$1',
      ['owner'],
    );
    expect(nutrition.rows[0].nutrition_enabled).toBe(true);
    expect(await count('goals', 'other')).toBe(0);
    expect(await count('metric_entries')).toBe(0);
    expect(await count('habit_entries')).toBe(0);
    expect(await count('meal_logs')).toBe(0);
    expect(await count('internship_applications')).toBe(0);
    expect(await count('weekly_reviews')).toBe(0);
    const links = await client.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM projects WHERE user_id=$1 AND goal_id IS NOT NULL',
      ['owner'],
    );
    expect(links.rows[0].count).toBe(3);
    const repeat = await installPersonalLifeOs('owner', options);
    expect(repeat.created).toBe(0);
  }, 120_000);

  it('preserves changed and deleted seeded records, filling only missing items', async () => {
    await client.query(
      `UPDATE goals SET title='My customized university goal' WHERE user_id='owner' AND template_key='university'`,
    );
    await client.query(
      `DELETE FROM meal_templates WHERE user_id='owner' AND template_key='meal-6'`,
    );
    await client.query(
      `DELETE FROM tasks WHERE user_id='owner' AND template_key='academic-starter-5'`,
    );
    const preview = await previewPersonalLifeOs('owner', options);
    expect(preview.items.find((item) => item.key === 'meal-6')?.status).toBe('deleted');
    expect(preview.items.find((item) => item.key === 'academic-starter-5')?.status).toBe('deleted');
    expect(preview.items.find((item) => item.key === 'university')?.status).toBe('existing');
    const repeat = await installPersonalLifeOs('owner', options);
    expect(repeat.created).toBe(0);
    expect(await count('meal_templates')).toBe(5);
    expect(await count('tasks')).toBe(29);
    const title = await client.query<{ title: string }>(
      `SELECT title FROM goals WHERE user_id='owner' AND template_key='university'`,
    );
    expect(title.rows[0].title).toBe('My customized university goal');
    expect(await count('goals', 'other')).toBe(0);
  }, 120_000);

  it('fills a missing managed item while leaving an archived item archived', async () => {
    await client.query(
      `DELETE FROM life_os_seed_items WHERE user_id='owner' AND item_type='Meal template' AND template_key='meal-6'`,
    );
    await client.query(
      `UPDATE goals SET status='archived', archived_at=now() WHERE user_id='owner' AND template_key='interviews'`,
    );
    const preview = await previewPersonalLifeOs('owner', options);
    expect(preview.items.find((item) => item.key === 'meal-6')?.status).toBe('new');
    expect(preview.items.find((item) => item.key === 'interviews')?.status).toBe('archived');
    const result = await installPersonalLifeOs('owner', options);
    expect(result.created).toBe(1);
    expect(await count('meal_templates')).toBe(6);
    const status = await client.query<{ status: string }>(
      `SELECT status FROM goals WHERE user_id='owner' AND template_key='interviews'`,
    );
    expect(status.rows[0].status).toBe('archived');
  }, 120_000);

  it('leaves legacy time blocks untouched and keeps accounts isolated', async () => {
    await client.query(
      `INSERT INTO time_blocks (user_id,title,category,local_start_time,local_end_time,weekday_mask,start_date,is_fixed) VALUES ('other','Existing fixed lecture','University','09:00','10:00','1000000','2026-10-01',true)`,
    );
    const university = { ...options, sections: ['university'] as SetupOptions['sections'] };
    const preview = await previewPersonalLifeOs('other', university);
    expect(preview.items.some((item) => item.type === 'Weekly block')).toBe(false);
    expect(preview.needsInput.every((item) => !item.includes('meal'))).toBe(true);
    const result = await installPersonalLifeOs('other', university);
    expect(result.conflicts).toBe(0);
    const lecture = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM time_blocks WHERE user_id='other' AND template_key='lecture-mon'`,
    );
    expect(lecture.rows[0].count).toBe(0);
    expect(await count('time_blocks', 'other')).toBe(1);
    const otherSettings = await client.query<{ nutrition_enabled: boolean }>(
      'SELECT nutrition_enabled FROM user_settings WHERE user_id=$1',
      ['other'],
    );
    expect(otherSettings.rows[0].nutrition_enabled).toBe(false);
    expect(await count('goals', 'owner')).toBe(8);
    expect(await count('goals', 'other')).toBe(1);
  }, 120_000);

  it('does not resume a nutrition checklist that was later paused', async () => {
    await client.query(`UPDATE user_settings SET nutrition_enabled=false WHERE user_id='owner'`);
    const preview = await previewPersonalLifeOs('owner', options);
    expect(preview.items.find((item) => item.type === 'Nutrition checklist')?.status).toBe(
      'archived',
    );
    const repeat = await installPersonalLifeOs('owner', options);
    expect(repeat.created).toBe(0);
    const setting = await client.query<{ nutrition_enabled: boolean }>(
      'SELECT nutrition_enabled FROM user_settings WHERE user_id=$1',
      ['owner'],
    );
    expect(setting.rows[0].nutrition_enabled).toBe(false);
  }, 120_000);

  it('rolls back every inserted record if a mandatory insert fails', async () => {
    await client.query(
      `INSERT INTO "user" (id,name,email) VALUES ('rollback','Rollback','life-os-rollback@example.test')`,
    );
    await client.query(
      `CREATE FUNCTION reject_life_os_goal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.user_id = 'rollback' AND NEW.template_key = 'industry' THEN RAISE EXCEPTION 'fixture rollback'; END IF; RETURN NEW; END $$`,
    );
    await client.query(
      `CREATE TRIGGER reject_life_os_goal BEFORE INSERT ON goals FOR EACH ROW EXECUTE FUNCTION reject_life_os_goal()`,
    );
    await expect(installPersonalLifeOs('rollback', options)).rejects.toThrow();
    expect(await count('goals', 'rollback')).toBe(0);
    expect(await count('user_settings', 'rollback')).toBe(0);
    expect(await count('life_os_seed_items', 'rollback')).toBe(0);
  }, 120_000);
});
