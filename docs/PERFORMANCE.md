# Performance verification

The [populated-account follow-up](POPULATED_ACCOUNT_PERFORMANCE.md) records the subsequently identified large-checklist bottleneck, its fix, deployment and remaining performance-budget limits. The measurements below describe the earlier optimization release.

Measured on October 16, 2026 using a local Next.js production build, Chrome desktop and a Pixel 7 browser profile with the Android app user agent. Each account had 20 habits, approximately 13,000 historical completions and 30 tasks. The database was an isolated PGlite instance with one application connection. No account data or configured application database was used.

## Results

All measured warm route requests, navigation samples and habit saves passed the 300 ms budget in the final run. Times include the complete HTML or action response; browser interactions also include Playwright click and locator overhead. These are small local smoke samples, not a production percentile or availability guarantee.

| Measurement                         | Web before | Web after | Android profile before | Android profile after |
| ----------------------------------- | ---------: | --------: | ---------------------: | --------------------: |
| Dashboard response, median          |     209 ms |    155 ms |                 170 ms |                113 ms |
| Habit save response, median         |     351 ms |    209 ms |                 436 ms |                181 ms |
| Habit save response, slowest sample |     388 ms |    253 ms |                 444 ms |                187 ms |
| Today navigation                    |     184 ms |    130 ms |                 872 ms |                114 ms |
| Week navigation                     |     203 ms |    131 ms |                 379 ms |                 79 ms |
| Home navigation                     |     310 ms |    191 ms |                 197 ms |                128 ms |

Five warm response samples were collected for each of `/dashboard`, `/today`, `/week`, `/habits`, `/goals`, `/review`, `/notes` and `/settings`; one navigation sample per destination and three habit save samples per client were collected. The reported `p95` in the JSON is the largest sample at these sample counts. Initial warm-up requests are excluded.

Raw reports: [baseline](performance-baseline.json), [optimized](performance-optimized.json). The optimized fixture also includes an enabled meal checklist for persistence verification.

## Changes

- Removed database session validation from the proxy. Authenticated pages, actions and API handlers still validate sessions against the database. Missing and expired sessions retain the login return path.
- Combined overlapping dashboard entry reads, deduplicated schedule revision reads within each render, and transferred historical habit metadata once per habit.
- Ran independent reads together in Today, Week, Settings and habit saves. Goals loads weight history only for the Goals tab and checklist completion data only for Tasks.
- Replaced one update per reordered habit with one parameterized update inside the existing transaction and ownership checks.
- Removed redundant client refreshes after meal saves and habit reordering. Android now uses one realtime subscription and fallback refresh timer, including resume handling.
- Enabled full mobile navigation prefetching, reused the date formatter, skipped hidden-page date checks, and avoided rendering unchanged habit rows after server refreshes.
- Displayed chart updates immediately instead of replaying chart animations. Labels, data, tooltips and calculations are retained.

There are no schema migrations or content edits. Changes to scheduling and streak code retain the same eligibility and calculation rules.

## Repeat the checks

```sh
npm run build
npm run perf:check
```

`perf:check` starts a production server with a fresh isolated database, checks the warm 300 ms budget and exits nonzero for an exceeded measurement. `perf:benchmark` runs the same scenarios without enforcing the budget. Chrome must be installed, or set `HABITFLOW_E2E_BROWSER_CHANNEL` to another installed Chromium channel. Raw results and server output are written under `.desktop-test/performance-*/`.

The browser scenarios also verify missing/forged session rejection, separate accounts, and persistence after reload for habit completion, habit ordering, meal status and actual meal amounts. Regression checks passed: the original full run plus added tests total 108 tests across 27 files; the production build, TypeScript and ESLint checks passed.

## Deployment scope

The changes were deployed to [the production website](https://lifeos-gayashan-2026.vercel.app) on October 16, 2026. Deployment `dpl_3axNn72eAdDZ5ozvRERruzfJs8pU` is READY and serves the public URL. It was built from the local performance changes on base commit `8e1fc47`; these changes were uncommitted when uploaded. The prior production deployment is `dpl_JEK4zrE4FPAMRfRGkgSEuyQUedig`.

The signed release APK was rebuilt and installed in place on the connected Infinix X6858 at 14:06 Asia/Colombo. Its signing certificate matches the existing installation. The original October 12 installation date was retained, and the existing signed-in dashboard and habits remained visible after launch. No uninstall or app-data clearing was performed.

APK: `dist-android/LifeOS-0.1.0-arm64-release.apk`.
SHA-256: `f635da7dad64b8415ae9e301a44d6064cc7ebf562f972792f63af5bd66b570dd`.

Before promotion, the staged deployment passed the database health check and rendered the LifeOS login form. After promotion, live checks using a dedicated smoke account passed registration, login/logout, protected routes, habit creation, saved completion after reload, private export, and Android-profile navigation and persistence. Single authenticated responses for the eight main routes took 106–216 ms from the build computer. These live smoke timings use a small test account and do not establish production tail latency. The physical phone's updated app also launched and displayed its existing authenticated dashboard. A deployment-scoped error-log scan through 14:09 Asia/Colombo returned zero error records.

Cold starts, other actions, the complete route inventory, representative production data volumes and mobile network latency are not covered by the local budget. Physical Android launch was verified, but device interaction timings were not measured. No production-wide 300 ms guarantee is established by these checks.
