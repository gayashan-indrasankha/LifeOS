// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '@/lib/db/schema';

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
import { deleteHabit } from '@/lib/dal/habits';

let client: PGlite;
const count = async (table: string, userId: string) =>
  (
    await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM ${table} WHERE user_id=$1`,
      [userId],
    )
  ).rows[0].count;

describe('permanent habit deletion', () => {
  beforeAll(async () => {
    client = new PGlite();
    state.db = drizzle({ client, schema });
    await migrate(state.db as ReturnType<typeof drizzle>, {
      migrationsFolder: 'lib/db/migrations',
    });
    await client.query(
      `INSERT INTO "user" (id,name,email) VALUES ('owner','Owner','habit-owner@example.test'),('other','Other','habit-other@example.test')`,
    );
  }, 120_000);
  afterAll(async () => {
    await client?.close();
  });

  it('removes only the owned habit, its check-ins and revisions, and clears day-plan references', async () => {
    const habit = await client.query<{ id: string }>(
      `INSERT INTO habits (user_id,name,schedule,start_date,template_key) VALUES ('owner','Mistaken habit','daily','2026-10-01','weigh-in') RETURNING id`,
    );
    const id = habit.rows[0].id;
    await client.query(
      `INSERT INTO habit_entries (user_id,habit_id,date) VALUES ('owner',$1,'2026-10-11')`,
      [id],
    );
    await client.query(
      `INSERT INTO habit_schedule_revisions (user_id,habit_id,effective_date,schedule,start_date) VALUES ('owner',$1,'2026-10-01','daily','2026-10-01')`,
      [id],
    );
    await client.query(
      `INSERT INTO day_plans (user_id,date,minimum_habit_id) VALUES ('owner','2026-10-11',$1)`,
      [id],
    );

    expect(await deleteHabit(id, 'other')).toBeNull();
    expect(await count('habits', 'owner')).toBe(1);
    expect(await deleteHabit(id, 'owner')).toEqual({ id });
    expect(await count('habits', 'owner')).toBe(0);
    expect(await count('habit_entries', 'owner')).toBe(0);
    expect(await count('habit_schedule_revisions', 'owner')).toBe(0);
    const dayPlan = await client.query<{ minimum_habit_id: string | null }>(
      `SELECT minimum_habit_id FROM day_plans WHERE user_id='owner'`,
    );
    expect(dayPlan.rows[0].minimum_habit_id).toBeNull();
    const marker = await client.query<{ item_type: string; template_key: string }>(
      `SELECT item_type,template_key FROM life_os_seed_items WHERE user_id='owner'`,
    );
    expect(marker.rows).toEqual([{ item_type: 'Habit', template_key: 'weigh-in' }]);
    expect(await deleteHabit(id, 'owner')).toBeNull();
  }, 120_000);
});
