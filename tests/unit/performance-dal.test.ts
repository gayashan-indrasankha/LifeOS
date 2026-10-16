// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

vi.mock('@/lib/db', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  return { db: drizzle({ client: new PGlite() }) };
});

import { db } from '@/lib/db';
import { getActiveHabitCompletionsThrough } from '@/lib/dal/habit-entries';
import { reorderHabits } from '@/lib/dal/habits';
import { calculateStreaks } from '@/lib/analytics/streak';
import { getTasks } from '@/lib/dal/life';

const client = (db as unknown as { $client: PGlite }).$client;
let first: string;
let second: string;
let archived: string;
let other: string;
beforeAll(async () => {
  await migrate(drizzle({ client }), { migrationsFolder: 'lib/db/migrations' });
  await client.exec(`INSERT INTO "user" (id,name,email) VALUES
    ('owner','Owner','performance-owner@example.test'),
    ('other','Other','performance-other@example.test')`);
  const rows = await client.query<{ id: string }>(`INSERT INTO habits
    (user_id,name,schedule,start_date,archived,sort_order) VALUES
    ('owner','First','daily','2026-10-01',false,0),
    ('owner','Second','daily','2026-10-01',false,1),
    ('owner','Archived','daily','2026-10-01',true,8),
    ('other','Private','daily','2026-10-01',false,0) RETURNING id`);
  [first, second, archived, other] = rows.rows.map((row) => row.id);
  await client.exec(`INSERT INTO habit_schedule_revisions
    (user_id,habit_id,effective_date,schedule,start_date)
    SELECT user_id,id,'2026-10-01',schedule,start_date FROM habits`);
  await client.query(
    `INSERT INTO habit_schedule_revisions
    (user_id,habit_id,effective_date,schedule,start_date,status)
    VALUES ('owner',$1,'2026-10-15','daily','2026-10-01','archived')`,
    [archived],
  );
  await client.query(
    `INSERT INTO habit_entries (user_id,habit_id,date,completed) VALUES
    ('owner',$1,'2026-10-13',true),('owner',$1,'2026-10-14',true),
    ('owner',$1,'2026-10-15',false),('owner',$1,'2026-10-17',true),
    ('owner',$2,'2026-10-14',true),('owner',$2,'2026-10-15',true),
    ('owner',$3,'2026-10-14',true),('owner',$3,'2026-10-15',true),
    ('other',$4,'2026-10-16',true)`,
    [first, second, archived, other],
  );
}, 30000);
afterAll(async () => {
  await client.close();
});

describe('performance query behavior', () => {
  it('omits large checklist bodies only when requested without losing task metadata', async () => {
    await client.query(
      "INSERT INTO tasks (user_id,title,checklist) VALUES ('owner','Preparation',$1),('other','Private',null)",
      ['[]'],
    );
    const complete = await getTasks('owner');
    const summaries = await getTasks('owner', { includeChecklists: false });
    expect(complete).toHaveLength(1);
    expect(complete[0].checklist).toBe('[]');
    expect(summaries).toEqual(complete.map((task) => ({ ...task, checklist: null })));
  });
  it('retains owned completion history, cutoff and schedule eligibility in grouped streak reads', async () => {
    const entries = await getActiveHabitCompletionsThrough('owner', '2026-10-16');
    expect(entries).toHaveLength(6);
    expect(entries.some((entry) => entry.habitId === other)).toBe(false);
    expect(entries.filter((entry) => entry.habitId === archived)).toHaveLength(2);
    expect(calculateStreaks(entries, '2026-10-16')).toEqual({ current: 3, best: 3 });
    expect(await getActiveHabitCompletionsThrough('missing', '2026-10-16')).toEqual([]);
  });

  it('saves an entire order in one update and rejects incomplete or foreign orders', async () => {
    await reorderHabits('owner', [second, first]);
    const order = await client.query<{ id: string; sort_order: number }>(
      "SELECT id,sort_order FROM habits WHERE user_id='owner' ORDER BY sort_order",
    );
    expect(order.rows).toEqual([
      { id: second, sort_order: 0 },
      { id: first, sort_order: 1 },
      { id: archived, sort_order: 8 },
    ]);
    await expect(reorderHabits('owner', [first, other])).rejects.toThrow('Invalid habit order');
    await expect(reorderHabits('owner', [first, first])).rejects.toThrow('Invalid habit order');
    await expect(reorderHabits('owner', [first])).rejects.toThrow('Invalid habit order');
  });
});
