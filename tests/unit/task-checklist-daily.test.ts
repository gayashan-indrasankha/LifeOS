// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
vi.mock('@/lib/auth/session', () => ({ requireUser: async () => ({ id: 'owner' }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { createTaskAction, toggleTaskChecklistItemAction } from '@/lib/actions/life-actions';
import { getTaskChecklistDoneByDate } from '@/lib/dal/life';

let client: PGlite;
const itemId = '11111111-1111-4111-8111-111111111111';
const dailyTaskId = '22222222-2222-4222-8222-222222222222';
const carryTaskId = '33333333-3333-4333-8333-333333333333';
const checklist = JSON.stringify([{ id: itemId, text: 'Read notes', done: false }]);

async function toggle(taskId: string, done: 'yes' | 'no') {
  const form = new FormData();
  form.set('taskId', taskId);
  form.set('itemId', itemId);
  form.set('done', done);
  return toggleTaskChecklistItemAction({}, form);
}

function taskForm(recurrence: string) {
  const form = new FormData();
  form.set('title', 'Daily practice');
  form.set('area', 'Career');
  form.set('priority', '2');
  form.set('scheduledDate', '2026-10-16');
  form.set('dueDate', '2026-10-18');
  form.set('recurrence', recurrence);
  form.set('checklistEnabled', 'on');
  form.set('checklistItems', 'Read notes');
  form.set('checklistResetDaily', 'on');
  return form;
}

describe('daily checklist reset', () => {
  beforeAll(async () => {
    client = new PGlite();
    state.db = drizzle({ client, schema });
    await migrate(state.db as ReturnType<typeof drizzle>, {
      migrationsFolder: 'lib/db/migrations',
    });
    await client.query(
      `INSERT INTO "user" (id,name,email) VALUES ('owner','Owner','owner@example.test')`,
    );
    for (const [id, reset] of [
      [dailyTaskId, true],
      [carryTaskId, false],
    ] as const) {
      await client.query(
        `INSERT INTO tasks (id,user_id,title,area,scheduled_date,due_date,recurrence,checklist,checklist_reset_daily)
         VALUES ($1,'owner','Read notes','Learning','2026-10-16','2026-10-18','daily',$2,$3)`,
        [id, checklist, reset],
      );
    }
  }, 120_000);

  afterEach(() => {
    delete process.env.HABITFLOW_TEST_NOW;
  });

  afterAll(async () => {
    await client?.close();
  });

  it('saves each day separately while leaving prior days and checklist definitions intact', async () => {
    process.env.HABITFLOW_TEST_NOW = '2026-10-16T12:00:00Z';
    expect((await toggle(dailyTaskId, 'yes')).success).toBe('Checklist updated.');
    expect(
      (await getTaskChecklistDoneByDate('owner', '2026-10-16', '2026-10-16'))[
        `${dailyTaskId}:2026-10-16`
      ],
    ).toEqual([itemId]);

    process.env.HABITFLOW_TEST_NOW = '2026-10-17T12:00:00Z';
    expect(await getTaskChecklistDoneByDate('owner', '2026-10-17', '2026-10-17')).toEqual({});
    expect((await toggle(dailyTaskId, 'yes')).success).toBe('Checklist updated.');
    expect((await toggle(dailyTaskId, 'no')).success).toBe('Checklist updated.');
    const saved = await getTaskChecklistDoneByDate('owner', '2026-10-16', '2026-10-17');
    expect(saved[`${dailyTaskId}:2026-10-16`]).toEqual([itemId]);
    expect(saved[`${dailyTaskId}:2026-10-17`]).toBeUndefined();
    const task = await client.query<{ checklist: string }>(
      'SELECT checklist FROM tasks WHERE id=$1',
      [dailyTaskId],
    );
    expect(JSON.parse(task.rows[0].checklist)[0].done).toBe(false);
  }, 120_000);

  it('keeps the existing carry-forward behavior when reset is off', async () => {
    process.env.HABITFLOW_TEST_NOW = '2026-10-16T12:00:00Z';
    expect((await toggle(carryTaskId, 'yes')).success).toBe('Checklist updated.');
    const task = await client.query<{ checklist: string }>(
      'SELECT checklist FROM tasks WHERE id=$1',
      [carryTaskId],
    );
    expect(JSON.parse(task.rows[0].checklist)[0].done).toBe(true);
    expect(
      await getTaskChecklistDoneByDate('owner', '2026-10-16', '2026-10-16'),
    ).not.toHaveProperty(`${carryTaskId}:2026-10-16`);
  }, 120_000);

  it('saves the switch for an every-day task and rejects it for other repeats', async () => {
    expect((await createTaskAction({}, taskForm('daily'))).success).toBe('Task added.');
    const saved = await client.query<{ checklist_reset_daily: boolean }>(
      "SELECT checklist_reset_daily FROM tasks WHERE title='Daily practice'",
    );
    expect(saved.rows).toEqual([{ checklist_reset_daily: true }]);
    expect((await createTaskAction({}, taskForm('once'))).error).toMatch(/every-day task/);
  }, 120_000);
});
