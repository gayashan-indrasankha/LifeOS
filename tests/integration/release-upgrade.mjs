import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import postgres from 'postgres';
import { drizzle as pgliteDrizzle } from 'drizzle-orm/pglite';
import { migrate as pgliteMigrate } from 'drizzle-orm/pglite/migrator';
import { drizzle as postgresDrizzle } from 'drizzle-orm/postgres-js';
import { migrate as postgresMigrate } from 'drizzle-orm/postgres-js/migrator';

const folder = 'lib/db/migrations';
const boundaries = [2, 6, 7, 8, 10, 12, 13];
const fullJournal = JSON.parse(await readFile(join(folder, 'meta', '_journal.json'), 'utf8'));
const files = await readdir(folder);
assert.equal(
  fullJournal.entries.length,
  24,
  'Review the fixture boundaries when migrations change.',
);
for (const [index, entry] of fullJournal.entries.entries()) {
  assert.equal(entry.idx, index);
  assert(files.includes(`${entry.tag}.sql`), `Missing migration ${entry.tag}`);
  assert(files.includes('meta'));
  await readFile(join(folder, 'meta', `${String(index).padStart(4, '0')}_snapshot.json`));
  const sql = await readFile(join(folder, `${entry.tag}.sql`), 'utf8');
  assert(!/\bDROP\s+(TABLE|COLUMN)\b/i.test(sql), `Review destructive migration ${entry.tag}`);
}

async function partialMigrations(boundary) {
  const dir = await mkdtemp(join(tmpdir(), 'habitflow-release-migrations-'));
  await mkdir(join(dir, 'meta'));
  for (const entry of fullJournal.entries.slice(0, boundary + 1))
    await copyFile(join(folder, `${entry.tag}.sql`), join(dir, `${entry.tag}.sql`));
  await writeFile(
    join(dir, 'meta', '_journal.json'),
    JSON.stringify({ ...fullJournal, entries: fullJournal.entries.slice(0, boundary + 1) }),
  );
  return dir;
}

async function fixture(query, boundary) {
  await query(
    "INSERT INTO \"user\" (id,name,email) VALUES ('owner','Owner','release-owner@example.test'),('other','Other','release-other@example.test')",
  );
  const [habit] = await query(
    "INSERT INTO habits (user_id,name,start_date,archived,schedule) VALUES ('owner','Legacy habit','2025-12-29',true,'daily') RETURNING id",
  );
  const [entry] = await query(
    "INSERT INTO habit_entries (user_id,habit_id,date) VALUES ('owner',$1,'2026-01-01') RETURNING id",
    [habit.id],
  );
  const [note] = await query(
    "INSERT INTO daily_notes (user_id,date,content) VALUES ('owner','2026-01-01','private legacy note') RETURNING id",
  );
  await query(
    "INSERT INTO user_settings (user_id,timezone,week_starts_on) VALUES ('owner','Asia/Colombo',1)",
  );
  const ids = { habit: habit.id, entry: entry.id, note: note.id };
  if (boundary < 3) return ids;
  const [goal] = await query(
    "INSERT INTO goals (user_id,area,title,template_key) VALUES ('owner','Career','Legacy goal','legacy-goal') RETURNING id",
  );
  const [project] = await query(
    "INSERT INTO projects (user_id,goal_id,name,template_key) VALUES ('owner',$1,'Legacy project','legacy-project') RETURNING id",
    [goal.id],
  );
  const [task] = await query(
    "INSERT INTO tasks (user_id,goal_id,project_id,title,area,is_milestone,status) VALUES ('owner',$1,$2,'Legacy milestone','Career',true,'done') RETURNING id",
    [goal.id, project.id],
  );
  const [block] = await query(
    "INSERT INTO time_blocks (user_id,title,category,local_start_time,local_end_time,weekday_mask,start_date,goal_id,project_id,task_id) VALUES ('owner','Legacy block','Career','09:00','10:00','1000000','2026-01-01',$1,$2,$3) RETURNING id",
    [goal.id, project.id, task.id],
  );
  const [exception] = await query(
    "INSERT INTO time_block_exceptions (user_id,block_id,occurrence_date,status) VALUES ('owner',$1,'2026-01-05','completed') RETURNING id",
    [block.id],
  );
  const [review] = await query(
    "INSERT INTO weekly_reviews (user_id,week_start,answers) VALUES ('owner','2025-12-29','{\"legacy\":true}') RETURNING id",
  );
  const [metric] = await query(
    "INSERT INTO metric_entries (user_id,date,type,value,unit) VALUES ('owner','2026-01-01','Body weight',70,'kg') RETURNING id",
  );
  const [subject] = await query(
    "INSERT INTO subjects (user_id,slot,name) VALUES ('owner',1,'Legacy subject') RETURNING id",
  );
  Object.assign(ids, {
    goal: goal.id,
    project: project.id,
    task: task.id,
    block: block.id,
    exception: exception.id,
    review: review.id,
    metric: metric.id,
    subject: subject.id,
  });
  if (boundary >= 6) {
    const [assessment] = await query(
      "INSERT INTO subject_assessments (user_id,subject_id,title) VALUES ('owner',$1,'Legacy exam') RETURNING id",
      [subject.id],
    );
    ids.assessment = assessment.id;
  }
  if (boundary >= 7) {
    const [revision] = await query(
      "INSERT INTO time_block_revisions (user_id,block_id,effective_date,title,category,local_start_time,local_end_time,weekday_mask,status) VALUES ('owner',$1,'2026-01-01','Legacy block','Career','09:00','10:00','1000000','active') RETURNING id",
      [block.id],
    );
    ids.revision = revision.id;
  }
  if (boundary >= 9) {
    const [timeOff] = await query(
      "INSERT INTO time_off_days (user_id,date,type) VALUES ('owner','2026-01-06','recovery') RETURNING id",
    );
    ids.timeOff = timeOff.id;
  }
  if (boundary >= 11) {
    const [application] = await query(
      "INSERT INTO internship_applications (user_id,company,role_title,role_track,stage,applied_on) VALUES ('owner','Legacy Labs','SE Intern','SE','applied','2026-01-02') RETURNING id",
    );
    const [stage] = await query(
      "INSERT INTO application_stage_history (user_id,application_id,to_stage) VALUES ('owner',$1,'applied') RETURNING id",
      [application.id],
    );
    const [interviewTopic] = await query(
      "INSERT INTO interview_topics (user_id,category,title) VALUES ('owner','SQL','JOINs') RETURNING id",
    );
    const [interview] = await query(
      "INSERT INTO interview_practices (user_id,topic_id,date,role_track,type) VALUES ('owner',$1,'2026-01-03','SE','mock') RETURNING id",
      [interviewTopic.id],
    );
    Object.assign(ids, {
      application: application.id,
      stage: stage.id,
      interviewTopic: interviewTopic.id,
      interview: interview.id,
    });
  }
  return ids;
}

async function assertPreserved(query, ids, boundary, expectBackfill = true) {
  const one = async (table, id) => (await query(`SELECT * FROM "${table}" WHERE id=$1`, [id]))[0];
  assert.equal((await one('habits', ids.habit)).archived, true);
  const entry = await one('habit_entries', ids.entry);
  assert.equal(entry.habit_id, ids.habit);
  assert.equal(
    (await query('SELECT date::text AS date FROM habit_entries WHERE id=$1', [ids.entry]))[0].date,
    '2026-01-01',
  );
  assert.equal((await one('daily_notes', ids.note)).content, 'private legacy note');
  assert.equal(
    (await query("SELECT timezone FROM user_settings WHERE user_id='owner'"))[0].timezone,
    'Asia/Colombo',
  );
  await assert.rejects(
    query("INSERT INTO habit_entries (user_id,habit_id,date) VALUES ('owner',$1,'2026-01-01')", [
      ids.habit,
    ]),
  );
  await assert.rejects(
    query("INSERT INTO habit_entries (user_id,habit_id,date) VALUES ('other',$1,'2026-01-02')", [
      ids.habit,
    ]),
  );
  if (boundary < 3) return;
  assert.equal((await one('projects', ids.project)).goal_id, ids.goal);
  assert.equal((await one('tasks', ids.task)).project_id, ids.project);
  assert.equal((await one('time_block_exceptions', ids.exception)).block_id, ids.block);
  assert.equal(
    (
      await query('SELECT occurrence_date::text AS date FROM time_block_exceptions WHERE id=$1', [
        ids.exception,
      ])
    )[0].date,
    '2026-01-05',
  );
  assert.equal((await one('weekly_reviews', ids.review)).user_id, 'owner');
  assert.equal((await one('metric_entries', ids.metric)).value, 70);
  assert.equal((await one('goals', ids.goal)).template_key, 'legacy-goal');
  if (expectBackfill) {
    assert.equal((await one('goals', ids.goal)).area, 'Career');
    assert.equal((await one('tasks', ids.task)).area, 'Career');
    assert.equal((await one('time_blocks', ids.block)).category, 'Career');
  }
  assert.equal((await one('projects', ids.project)).template_key, 'legacy-project');
  if (boundary >= 6)
    assert.equal((await one('subject_assessments', ids.assessment)).subject_id, ids.subject);
  if (boundary >= 7) {
    assert.equal((await one('time_block_revisions', ids.revision)).block_id, ids.block);
    if (expectBackfill)
      assert.equal((await one('time_block_revisions', ids.revision)).category, 'Career');
  }
  if (boundary >= 9) assert.equal((await one('time_off_days', ids.timeOff)).user_id, 'owner');
  if (boundary >= 11) {
    assert.equal(
      (await one('application_stage_history', ids.stage)).application_id,
      ids.application,
    );
    assert.equal((await one('interview_practices', ids.interview)).topic_id, ids.interviewTopic);
    if (expectBackfill)
      assert.equal((await one('interview_practices', ids.interview)).topic_text, 'JOINs');
    if (boundary === 12) {
      const result = await query('SELECT correct,total FROM interview_practices WHERE id=$1', [
        ids.interview,
      ]);
      assert.equal(result[0].correct, null);
      assert.equal(result[0].total, null);
    }
  }
  await assert.rejects(
    query("INSERT INTO tasks (user_id,project_id,title) VALUES ('other',$1,'Foreign task')", [
      ids.project,
    ]),
  );
  const revisions = await query('SELECT id FROM time_block_revisions WHERE block_id=$1', [
    ids.block,
  ]);
  assert(revisions.length >= 1, 'The original block needs an effective rule.');
}

async function verifyEngine(engine, makeDatabase) {
  for (const boundary of boundaries) {
    const old = await partialMigrations(boundary);
    try {
      const database = await makeDatabase();
      try {
        await database.migrate(old);
        const ids = await fixture(database.query, boundary);
        await database.migrate(folder);
        await database.migrate(folder); // Drizzle's journal must make reapplication idempotent.
        await assertPreserved(database.query, ids, boundary);
        const count = await database.query(
          'SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations',
        );
        assert.equal(count[0].count, fullJournal.entries.length);
        console.log(`${engine} upgrade from ${String(boundary).padStart(4, '0')}: PASS`);
      } finally {
        await database.close();
      }
    } finally {
      const absolute = resolve(old);
      if (!absolute.startsWith(resolve(tmpdir()) + sep))
        throw new Error('Unsafe test cleanup path.');
      await rm(absolute, { recursive: true, force: true });
    }
  }
}

async function verifyFresh(engine, makeDatabase) {
  const database = await makeDatabase();
  try {
    await database.migrate(folder);
    const ids = await fixture(database.query, 12);
    await database.migrate(folder);
    await assertPreserved(database.query, ids, 12, false);
    const count = await database.query(
      'SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations',
    );
    assert.equal(count[0].count, fullJournal.entries.length);
    console.log(`${engine} fresh migration: PASS`);
  } finally {
    await database.close();
  }
}

if (process.argv[2] === 'pglite') {
  const makeDatabase = async () => {
    const client = new PGlite();
    const db = pgliteDrizzle({ client });
    return {
      query: async (text, params = []) => (await client.query(text, params)).rows,
      migrate: async (migrationsFolder) => pgliteMigrate(db, { migrationsFolder }),
      close: async () => client.close(),
    };
  };
  await verifyFresh('PGlite', makeDatabase);
  await verifyEngine('PGlite', makeDatabase);
} else if (process.argv[2] === 'postgres') {
  const adminUrl = process.env.HABITFLOW_TEST_ADMIN_URL;
  if (!adminUrl) throw new Error('Set HABITFLOW_TEST_ADMIN_URL to a local admin database.');
  const parsed = new URL(adminUrl);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname))
    throw new Error('Release migration tests require a loopback PostgreSQL server.');
  const options = {
    host: parsed.hostname.replace(/^\[|\]$/g, ''),
    port: Number(parsed.port || 5432),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
  const admin = postgres({ ...options, database: parsed.pathname.slice(1), max: 1 });
  try {
    const makeDatabase = async () => {
      const name = `habitflow_release_test_${randomUUID().replaceAll('-', '')}`;
      await admin.unsafe(`CREATE DATABASE "${name}"`);
      const client = postgres({ ...options, database: name, max: 2 });
      return {
        query: (text, params = []) => client.unsafe(text, params),
        migrate: (migrationsFolder) =>
          postgresMigrate(postgresDrizzle(client), { migrationsFolder }),
        close: async () => {
          await client.end();
          if (!name.startsWith('habitflow_release_test_'))
            throw new Error('Unsafe test database cleanup.');
          await admin.unsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
        },
      };
    };
    await verifyFresh('PostgreSQL', makeDatabase);
    await verifyEngine('PostgreSQL', makeDatabase);
  } finally {
    await admin.end();
  }
} else throw new Error('Pass exactly one engine: postgres or pglite.');
