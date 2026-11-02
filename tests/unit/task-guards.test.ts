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
vi.mock('@/lib/auth/session', () => ({ requireUser: async () => ({ id: 'owner' }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { deleteTaskAction, managePriorityAction } from '@/lib/actions/life-actions';

let client: PGlite;
const occurrenceTaskId = '44444444-4444-4444-8444-444444444444';
const checklistTaskId = '55555555-5555-4555-8555-555555555555';
const unusedTaskId = '66666666-6666-4666-8666-666666666666';
const itemId = '77777777-7777-4777-8777-777777777777';

async function remove(id: string) {
  const form = new FormData();
  form.set('id', id);
  return deleteTaskAction({}, form);
}

const remaining = async (table: string, taskId: string) =>
  (
    await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM ${table} WHERE task_id=$1`,
      [taskId],
    )
  ).rows[0].count;

const taskExists = async (id: string) =>
  (await client.query('SELECT 1 FROM tasks WHERE id=$1', [id])).rows.length > 0;

describe('repeating task guards', () => {
  beforeAll(async () => {
    client = new PGlite();
    state.db = drizzle({ client, schema });
    await migrate(state.db as ReturnType<typeof drizzle>, {
      migrationsFolder: 'lib/db/migrations',
    });
    await client.query(
      `INSERT INTO "user" (id,name,email) VALUES ('owner','Owner','delete-owner@example.test')`,
    );
    for (const id of [occurrenceTaskId, checklistTaskId, unusedTaskId]) {
      await client.query(
        `INSERT INTO tasks (id,user_id,title,area,scheduled_date,due_date,recurrence)
         VALUES ($1,'owner','Daily practice','Learning','2026-10-16','2026-10-30','daily')`,
        [id],
      );
    }
    await client.query(
      `INSERT INTO task_completions (user_id,task_id,date) VALUES ('owner',$1,'2026-10-16')`,
      [occurrenceTaskId],
    );
    await client.query(
      `INSERT INTO task_checklist_completions (user_id,task_id,item_id,date)
       VALUES ('owner',$1,$2,'2026-10-16')`,
      [checklistTaskId, itemId],
    );
  }, 120_000);

  afterAll(async () => {
    await client?.close();
  });

  it('keeps a task whose completed occurrences would otherwise be erased', async () => {
    expect((await remove(occurrenceTaskId)).error).toMatch(/recorded work or review history/);
    expect(await taskExists(occurrenceTaskId)).toBe(true);
    expect(await remaining('task_completions', occurrenceTaskId)).toBe(1);
  }, 120_000);

  it('keeps a task whose daily checklist progress would otherwise be erased', async () => {
    expect((await remove(checklistTaskId)).error).toMatch(/recorded work or review history/);
    expect(await remaining('task_checklist_completions', checklistTaskId)).toBe(1);
  }, 120_000);

  it('still deletes a repeating task that has no recorded days', async () => {
    expect((await remove(unusedTaskId)).success).toBe('Task deleted.');
    expect(await taskExists(unusedTaskId)).toBe(false);
  }, 120_000);

  it('refuses a repeating task as a daily priority, leaving its series start unchanged', async () => {
    const form = new FormData();
    form.set('id', occurrenceTaskId);
    form.set('date', '2026-10-20');
    form.set('operation', 'assign');
    form.set('rank', '1');
    expect((await managePriorityAction({}, form)).error).toBe(
      'Repeating tasks cannot be daily priorities.',
    );
    const saved = await client.query<{ scheduled_date: string; daily_priority: number | null }>(
      'SELECT scheduled_date::text, daily_priority FROM tasks WHERE id=$1',
      [occurrenceTaskId],
    );
    expect(saved.rows).toEqual([{ scheduled_date: '2026-10-16', daily_priority: null }]);
  }, 120_000);
});
