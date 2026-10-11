# LifeOS

For Vercel and Neon production preparation, environment settings, migrations, and the deployment approval checklist, see [DEPLOYMENT.md](DEPLOYMENT.md).

For the double-click Windows application, see [DESKTOP.md](DESKTOP.md).

For the experimental fully offline Android APK build, see [ANDROID.md](ANDROID.md).

For reproducible release gates, migration upgrades, browser coverage, and observed outcomes, see [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md).

For the current daily workflow audit and verified usability changes, see [docs/DAILY-USABILITY-AUDIT.md](docs/DAILY-USABILITY-AUDIT.md).

LifeOS is a Next.js 16 personal planning app built on the existing monthly habit tracker. Today connects three selected tasks, time blocks, applicable habits, and a private daily note. Week, Goals, and Review provide a lightweight planning loop. The monthly tracker remains at `/dashboard?month=YYYY-MM`.

## Requirements

- Node.js 20.9 or newer and npm
- Docker Desktop with Docker Compose, or a PostgreSQL 16 server

For local development without Docker, the project can run its embedded PGlite database instead.

## Local setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and replace `BETTER_AUTH_SECRET` with a unique random value of at least 32 characters. Keep `.env.local` out of source control.
3. Start PostgreSQL: `docker compose up -d postgres`. The container uses host port 5433 by default to avoid clashes with an existing local PostgreSQL server. Set `HABITFLOW_DB_PORT` if you need another port, and match `DATABASE_URL`.
   If you already have a `.env.local` pointing at port 5432, update its `DATABASE_URL` to 5433 for this container.
4. Check connectivity: `npm run db:check`
5. Start Next.js: `npm run dev` and open <http://localhost:3000>.

If Docker Desktop is unavailable, run `npm.cmd run db:embedded` in one terminal instead of step 3. Keep it running while you use the app. Run `npm.cmd run db:check` to confirm the connection, then run `npm.cmd run dev` in another terminal. The embedded command applies the checked-in migrations automatically and keeps local data in the ignored `.local-embedded-db/` directory. Do not run `db:migrate` separately for this mode. The embedded database is separate from Docker and the desktop app.

Run `npm run db:migrate` on the intended **local** database after starting PostgreSQL. Migrations `0003`–`0006` add Life OS tables, ownership constraints, daily priority uniqueness, nullable template keys, and subject assessments without removing existing rows. Review the target and back up its data before applying migrations. `db:push` is for local experimentation only.

## Authentication

Visit `/register` to create an account or `/login` to return. Successful authentication opens Home (`/dashboard`). Better Auth stores password hashes and persistent sessions in PostgreSQL. The app resolves identity from the server session before reading user-owned data; protected routes redirect to `/login` when the session is absent. The older `/sign-in` and `/sign-up` links redirect to the new pages.

## Daily workflow

- `/today`: choose up to three tasks, change day mode, run or reschedule time blocks, record habits, optionally check off planned meals, and write an evening note.
- `/week`: inspect Monday–Sunday blocks, add recurring or one-off blocks, edit times, and override a single occurrence. Fixed commitments resist casual skipping and moving.
- `/goals`: create goals, projects, tasks, and five university subject slots. Grades are entered outcomes, not inferred from habit checks.
- `/goals/evidence`: record topic practice, milestone reviews, interview and English assessments, actual body weight, and internship applications. See [EVIDENCE.md](EVIDENCE.md).
- `/review`: compare fixed-habit adherence, finished tasks, completed blocks, and actual measurements; save a private weekly reflection.
- `/dashboard`: the historical month tracker. Flexible `weekly:N` habits display complete-week quota attainment and monthly raw checks, outside fixed-day percentages. See [SCHEDULING.md](SCHEDULING.md).
- `/settings/life-os`: choose personal setup sections, inspect a read-only record and schedule preview, then explicitly install missing items. Existing customizations, archived items, and previously removed seeded items are preserved. Nothing is seeded at registration. See [LifeOS setup](docs/LIFE_OS_SETUP.md).
- `/settings`: set timezone, week start, and theme; enable or pause an optional meal checklist and edit up to six meal templates; download a versioned JSON backup or restore one on another installation. Import replaces the signed-in account's productivity data in one transaction and accepts version 1 or 2 backups. The backup includes private notes, reviews, and LifeOS setup history; it excludes account credentials and profile details. Export the destination's data first if you need to keep it.

The web PostgreSQL and desktop PGlite databases remain separate. No automatic synchronization is provided.

## Development commands

| Command                                      | Purpose                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`                                | Start the development server                                                    |
| `npm run lint`                               | Run ESLint                                                                      |
| `npm run typecheck`                          | Run strict TypeScript checks                                                    |
| `npm run format:check`                       | Check formatting                                                                |
| `npm run format`                             | Format source files                                                             |
| `npm test`                                   | Run Vitest unit tests                                                           |
| `npm run test:e2e`                           | Run Playwright flows against an isolated test database with a browser installed |
| `npm run build`                              | Create a production build                                                       |
| `npm run db:check`                           | Test the PostgreSQL connection using `.env.local`                               |
| `npm run db:generate`                        | Generate a Drizzle migration from the schema                                    |
| `npm run db:migrate`                         | Apply reviewed migrations                                                       |
| `node scripts/check-embedded-migrations.mjs` | Check migrations and owner constraints in fresh PGlite                          |
| `npm run desktop:smoke`                      | Smoke test the built standalone server with a fresh embedded database           |

Scheduling regression checks use a disposable database on a local PostgreSQL server. Set `HABITFLOW_TEST_ADMIN_URL` to a loopback admin database URL, then run `node tests/integration/scheduling-postgres.mjs` for fresh and upgrade migrations or `node tests/e2e/run-scheduling.mjs` for the focused browser flow. Each runner creates a randomly named database and drops only that database afterward. The browser runner uses port 3100 and a separate `.next-e2e` output directory. For a desktop server smoke using that build, set `HABITFLOW_SMOKE_BUILD_DIR=.next-e2e` before `npm run desktop:smoke`.

The P4 release suite uses `node tests/integration/release-upgrade.mjs pglite` for seven historical PGlite upgrade boundaries, including the schema immediately before migration `0014`. With a loopback-only `HABITFLOW_TEST_ADMIN_URL` set, run `node tests/integration/release-upgrade.mjs postgres` for disposable PostgreSQL databases and `npm run test:e2e` for all browser workflows. `npm run test:e2e -- release-core.spec.ts` selects a file. Browser tests use a fixed application clock and Playwright-managed Chromium (`npx playwright install chromium` locally). CI runs the same checks on pushes and pull requests. The Windows job packages the portable launcher and runs `node tests/desktop/portable.mjs` against the packaged Electron executable, including a clean restart and PGlite persistence check.

On Windows PowerShell systems that block `npm.ps1`, use `npm.cmd` in place of `npm`.

## Structure

- `app/`: App Router pages and layouts
- `components/ui/`: shared shadcn-style UI primitives
- `components/`: feature and layout components
- `lib/env.ts`: server environment validation
- `lib/db/`: Drizzle schema and connection
- `lib/{dal,actions,analytics,validations}/`: existing feature boundaries
- `tests/`: unit, integration, and end-to-end test locations
- `scripts/`: local development checks

The application uses Tailwind CSS 4, shadcn component conventions, Drizzle ORM, PostgreSQL, and Zod. No credentials are stored in tracked files.

## Editing workflows (P1)

On Goals & Projects, open **Edit goal** or **Edit project** to change saved fields. Empty optional fields clear their values. Archive hides an item from the active list and retains its linked tasks, milestones, and history; the collapsed archived list provides Restore.

On Today, **Add to Today** searches the full available task backlog and filters by life area or project. Choose an empty priority slot to assign, or explicitly confirm replacement of an occupied slot. Move, swap, and remove controls keep three ordered task references. Removing a priority leaves the task and its associations intact. Completed priorities remain visible. Changing Normal, Reduced, or Minimum mode does not alter the saved ranks.

On Week, the weekday checkboxes encode the Monday-first recurrence mask. Series edits take effect on the chosen date and preserve prior recorded occurrences. One-occurrence changes use **Change occurrence**. Fixed commitment changes require confirmation. See [SCHEDULING.md](SCHEDULING.md) for the calendar rules.

Migration `0008` adds goal/project archive timestamps and revisioned block end dates, fixed flags, and task/goal/project links. Apply it only to the intended local database. Run `node tests/integration/p1-pglite.mjs` for an isolated embedded upgrade check. For PostgreSQL and browser verification, set `HABITFLOW_TEST_ADMIN_URL` to a loopback PostgreSQL admin URL and run `node tests/integration/scheduling-postgres.mjs`, `node tests/integration/p1-postgres.mjs`, and `node tests/e2e/run-scheduling.mjs tests/e2e/scheduling.spec.ts tests/e2e/p1-editing.spec.ts`. The E2E runner creates and drops its own random database and uses port 3100.

## Flexible weekly planning (P2)

On Week, the workload card separates fixed commitments from flexible planned time, shows daily and life-area totals, completed sessions, and actual minutes only where recorded. Set an optional daily flexible capacity to highlight overloaded days. Open **Adjust** on a flexible session to move it, change its time, shorten it, skip it, or restore its original slot. These actions retain the original occurrence identity and check collisions on Save.

The optional fifth gym visit has a configurable day, time, and activity type. Disable it to plan rest without recording a failed workout. The original four template workouts and their completion records are retained. **Plan time off** previews fixed and flexible commitments for a chosen date; you explicitly choose flexible sessions to excuse. Fixed commitments and habits remain unchanged. You can edit or cancel a time-off plan, and excused sessions remain visible in history.

Today now uses task-based planning: focus tasks, habit checkoffs, and an optional shorter task list. **Show less today** displays one unfinished focus task; **Show full day** restores the complete task list. Time blocks and their recorded history remain in Week and no longer appear on Today.

Additive migrations `0009` and `0010` store planning capacity, one-off time-off records and linked excusals, and minimum actions. The JSON backup includes these records and revision history. For isolated checks, run `node tests/integration/p1-pglite.mjs` and, with `HABITFLOW_TEST_ADMIN_URL` set to a loopback admin URL, `node tests/e2e/run-scheduling.mjs tests/e2e/p2-planning.spec.ts`. No production migration or deployment is automatic.

## Evidence and career tracking (P3)

Goals & Projects links to one nested Evidence view for university topic practice, project milestone criteria and reviews, interview sessions, English sessions and grammar corrections, actual body-weight measurements, and internship applications. Weekly Review distinguishes recorded practice from grades, completed tasks from quality acceptance, and actual measurements from targets. Today shows a small number of due follow-ups. Evidence rules, formulas, assessment labels, and missing-data behavior are documented in [EVIDENCE.md](EVIDENCE.md).

Additive migrations `0011`–`0013` store P3 records, append-only milestone review history, and optional scored interview results. The explicit JSON backup includes these private records. Apply migrations only to the intended local database after backup. Run `node tests/integration/p3-pglite.mjs` for a fresh embedded check, `node tests/integration/p1-pglite.mjs` for an embedded upgrade check, and, with `HABITFLOW_TEST_ADMIN_URL` set to a loopback PostgreSQL admin URL, `node tests/integration/p3-postgres.mjs` and `node tests/e2e/run-scheduling.mjs tests/e2e/p3-evidence.spec.ts`. The tests use disposable databases. No production migration or deployment is part of P3.

## Final refinement

Migration `0014` adds dated habit rules and optional meal templates/logs. Existing habits receive a current-state legacy revision; unknown earlier schedule rules are not inferred. Historical completions remain visible. Schedule edits take effect on a selected date from today onward, and archive/restore retain earlier rules. The Week workload counts a task linked to a moved session once across displayed weeks, and the gym card deduplicates same-day habit signals against recorded sessions. Weight averages label coverage separately for each calendar week. See [SCHEDULING.md](SCHEDULING.md) and [EVIDENCE.md](EVIDENCE.md).

The personal setup preset proposes separate academic, career, interview, fitness, and recovery sessions while keeping Sunday lighter. Existing template-managed schedules remain intact by default. A separate, confirmed option offers effective-dated updates for a small set of unchanged flexible sessions from the earlier preset; customized and fixed schedules stay intact. Review all conflicts in the setup preview or edit a series directly in Week.

The meal checklist is off by default. Enable it in Settings, save planned meals, then mark each Today item **Followed** or **Not followed**. No entry means **Not recorded**. Planned calories or protein are reference values only; the app does not infer what was eaten or calculate actual intake. Pausing the checklist retains templates and logs. Meal data is included in the private JSON backup.
