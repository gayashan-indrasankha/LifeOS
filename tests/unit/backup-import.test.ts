// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '@/lib/db/schema';
import { parseBackup } from '@/lib/backup/format';

const state = vi.hoisted(() => ({ db: null as unknown, userId: 'source' }));
vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('@/lib/auth/session', () => ({ getCurrentUser: async () => ({ id: state.userId }) }));

import { GET } from '@/app/api/export/route';
import { POST } from '@/app/api/import/route';

let source: PGlite;
let target: PGlite;
const setup = async (client: PGlite, id: string) => {
  const database = drizzle({ client, schema });
  await migrate(database, { migrationsFolder: 'lib/db/migrations' });
  await client.query('INSERT INTO "user" (id,name,email) VALUES ($1,$2,$3)', [
    id,
    id,
    `${id}@example.test`,
  ]);
  return database;
};

describe('LifeOS backup restore', () => {
  beforeAll(async () => {
    source = new PGlite();
    target = new PGlite();
    const sourceDb = await setup(source, 'source');
    await setup(target, 'target');
    state.db = sourceDb;
    await source.query(
      `INSERT INTO habits (user_id,name,start_date) VALUES ('source','Read','2026-10-01')`,
    );
    const habit = (await source.query<{ id: string }>('SELECT id FROM habits')).rows[0];
    await source.query(
      `INSERT INTO habit_entries (user_id,habit_id,date) VALUES ('source',$1,'2026-10-11')`,
      [habit.id],
    );
    await source.query(
      `INSERT INTO daily_notes (user_id,date,content) VALUES ('source','2026-10-11','Private note')`,
    );
    await source.query(
      `INSERT INTO user_settings (user_id,timezone,theme) VALUES ('source','Asia/Colombo','dark')`,
    );
    await target.query(
      `INSERT INTO habits (user_id,name,start_date) VALUES ('target','Old habit','2026-01-01')`,
    );
  }, 120_000);

  afterAll(async () => {
    await source?.close();
    await target?.close();
  });

  it('imports an exported backup into another installation and replaces existing records', async () => {
    const response = await GET();
    const backup = await response.text();
    const data = JSON.parse(backup);
    expect(data.schemaVersion).toBe(2);
    expect(parseBackup(data).totalRecords).toBeGreaterThanOrEqual(4);

    state.userId = 'target';
    state.db = drizzle({ client: target, schema });
    const imported = await POST(
      new Request('http://localhost/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: backup,
      }),
    );
    expect(imported.status).toBe(200);
    expect(
      (await target.query<{ name: string }>('SELECT name FROM habits WHERE user_id=$1', ['target']))
        .rows,
    ).toEqual([{ name: 'Read' }]);
    expect(
      (await target.query('SELECT * FROM habit_entries WHERE user_id=$1', ['target'])).rows,
    ).toHaveLength(1);
    expect(
      (
        await target.query<{ content: string }>(
          'SELECT content FROM daily_notes WHERE user_id=$1',
          ['target'],
        )
      ).rows[0].content,
    ).toBe('Private note');
    expect(
      (
        await target.query<{ timezone: string }>(
          'SELECT timezone FROM user_settings WHERE user_id=$1',
          ['target'],
        )
      ).rows[0].timezone,
    ).toBe('Asia/Colombo');
  }, 120_000);

  it('keeps existing data when a related record cannot be restored', async () => {
    state.userId = 'source';
    state.db = drizzle({ client: source, schema });
    const backup = JSON.parse(await (await GET()).text());
    backup.habitEntries[0].habitId = '00000000-0000-4000-8000-000000000000';
    state.userId = 'target';
    state.db = drizzle({ client: target, schema });
    const result = await POST(
      new Request('http://localhost/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backup),
      }),
    );
    expect(result.status).toBe(400);
    expect(
      (await target.query<{ name: string }>('SELECT name FROM habits WHERE user_id=$1', ['target']))
        .rows,
    ).toEqual([{ name: 'Read' }]);
    expect(
      (await target.query('SELECT * FROM habit_entries WHERE user_id=$1', ['target'])).rows,
    ).toHaveLength(1);
  }, 120_000);

  it('accepts version 1 backups without setup history', async () => {
    state.userId = 'source';
    state.db = drizzle({ client: source, schema });
    const backup = JSON.parse(await (await GET()).text());
    backup.schemaVersion = 1;
    delete backup.lifeOsSeedItems;
    expect(parseBackup(backup).rows.lifeOsSeedItems).toEqual([]);
    state.userId = 'target';
    state.db = drizzle({ client: target, schema });
    const response = await POST(
      new Request('http://localhost/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backup),
      }),
    );
    expect(response.status).toBe(200);
    expect(
      (await target.query<{ name: string }>('SELECT name FROM habits WHERE user_id=$1', ['target']))
        .rows,
    ).toEqual([{ name: 'Read' }]);
  });
});
