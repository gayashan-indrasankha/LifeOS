# LifeOS deployment: Vercel + Neon

This is a review checklist and runbook. No cloud resources are created by this repository. Keep local Docker data and production Neon data separate.

## Environment variables

Set these in the Vercel **Production** environment. Use different values and a separate Neon branch for Preview. Never put real values in Git or expose the database URL or auth secret with `NEXT_PUBLIC_`.

| Variable              | Production value                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | Neon **pooled** PostgreSQL URL, ending with `?sslmode=require` (or containing `sslmode=require` among query parameters). Runtime only. |
| `BETTER_AUTH_SECRET`  | Unique random value of at least 32 characters. Do not reuse the development or Preview secret.                                         |
| `BETTER_AUTH_URL`     | Canonical public HTTPS origin, such as `https://lifeos.example.com`. No path.                                                          |
| `NEXT_PUBLIC_APP_URL` | Same canonical HTTPS origin. This value is embedded in client bundles.                                                                 |

`MIGRATION_DATABASE_URL` is optional for a separately run migration process. Use a Neon **direct** URL with TLS when supplied; keep it out of Vercel's application runtime environment. The migration tool falls back to `DATABASE_URL` for local development. `NODE_ENV` and `VERCEL_ENV` are platform managed. Production validation rejects a localhost database, a database URL without `sslmode=require`, or a non-HTTPS/mismatched public origin when `VERCEL_ENV=production`.

Better Auth uses the canonical URL as its sole trusted origin. Each Preview deployment needs its own fixed URL or a reviewed dynamic-origin configuration; do not add a blanket `*.vercel.app` wildcard or point previews at production credentials. Persistent sessions are stored in PostgreSQL. The auth endpoint is `/api/auth/*`.

## Database and migrations

1. Create and review a Neon project/branch and its connection details outside this repository. Keep Preview and Production branches distinct. Back up or snapshot the production branch before schema changes.
2. Review every SQL file in `lib/db/migrations/` and the generated Drizzle journal. Migration `0001` adds nullable `habits.end_date`; `0002` adds auth lookup indexes; `0003` adds Life OS tables and composite owner constraints; `0004` adds unique daily priority slots; `0005` adds nullable habit template keys; `0006` adds subject assessments. These preserve existing rows. Before `0003`, check for any historical `habit_entries.user_id` that differs from its habit owner; the composite constraint will reject such data rather than silently changing it.
3. From a controlled environment with a TLS migration URL, run `npm ci`, `npm run db:check` (using a local env file for this check), then `npm run db:migrate`. Do this **once per target database**, before promoting the matching application build. Never run `db:push` against production. Do not run migrations automatically during every Vercel build or serverless startup.
4. Confirm the migration result with a read-only schema check and `GET /api/health` after deployment. This health endpoint checks database reachability and returns only `ok` or `unavailable`; do not expose connection details.

For migration CLI execution, `drizzle.config.ts` prefers `MIGRATION_DATABASE_URL` over `DATABASE_URL`. Pass secrets through the process environment or a protected, ignored env file. `scripts/check-db.mjs` reads `DATABASE_URL`; test the direct URL by setting that variable for the check process.

Android real-time updates use an authenticated server-sent event stream backed by PostgreSQL `LISTEN/NOTIFY`. The server derives a direct Neon hostname from the pooled `DATABASE_URL`; set `REALTIME_DATABASE_URL` to a direct TLS connection URL if the database provider uses a different naming convention. Each open Android stream holds one direct database connection for up to four minutes, then reconnects. Check direct connection limits before scaling to many simultaneous devices. Apply migration `0024_realtime_changes.sql` before deploying the matching app build.

## Build and release

Vercel: Framework Preset **Next.js**, root directory repository root, install command `npm ci`, build command `npm run build`, no custom output directory. Use Node.js 20.9 or newer supported by the pinned Next.js version. The app uses Node runtime database connections; keep the database access out of Edge middleware.

Before promoting a release run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e` against an isolated test database, and `npm run build`. After applying migrations, deploy the reviewed commit, visit `/api/health`, then verify registration/login, a protected route, a habit toggle, and logout using a dedicated smoke-test account.

Also require `npm run format:check`, fresh and existing-data migrations on disposable PostgreSQL and PGlite, and green GitHub web and Windows package jobs. The CI workflows never connect to Neon or deploy. The release matrix and any outstanding packaged GUI checks are recorded in [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md).

The CI build supplies local test-only `DATABASE_URL`, `BETTER_AUTH_SECRET`, and application URLs because Next.js evaluates server route modules while collecting build data. These values are confined to disposable CI jobs; they are not deployment credentials. Configure actual production values only in the deployment environment.

## Logs, errors, and seeds

Vercel function logs should be retained and monitored for `Health check database connection failed`, failed builds, and 5xx responses. The health response and auth errors must not contain database URLs, tokens, passwords, or raw driver errors. Rotate any credential accidentally logged or exposed.

No production seed runs during build, migration, or startup. Development demo data belongs only in an explicit local script using a local database. A production smoke account, if needed, should be created through the normal registration flow and removed manually after verification.

## Approval checklist before cloud changes

- [ ] Production and Preview Neon branches, credentials, and Vercel environments are separate.
- [ ] Canonical domain, HTTPS, and Better Auth origins are reviewed.
- [ ] Secrets are configured in Vercel and absent from Git and build output.
- [ ] SQL migrations and backup plan are reviewed.
- [ ] Local quality gate and isolated Preview smoke test pass.
- [ ] Migration execution and production deployment are explicitly authorized.
