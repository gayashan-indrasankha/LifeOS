# Populated-account performance fix — October 16, 2026

## Cause

Read-only production diagnostics found 23 tasks containing 1,015 checklist items, including lists of 392 and 617 items. The application rendered the individual interactive item forms even when their checklist and section disclosures were closed. Week repeated the checklist contents for each recurring occurrence. Task editors also rendered their full contents before being opened.

The anonymized backup fixture was 212,086 bytes, but the original implementation expanded it into multi-megabyte pages and thousands of hidden controls. No original account records were changed during diagnosis or verification.

## Changes

- Checklist disclosures mount their contents only after opening. Grouped checklists mount item forms only for sections the user opens. All items, progress and editing behavior remain available.
- Once opened, contents stay mounted when closed again, retaining unsaved form state and pending feedback.
- Task editors mount on first opening instead of initializing every editor during navigation.
- Review and the Goals/Projects tabs omit unused checklist bodies from database reads. The Tasks tab retains the complete checklist data.
- Mobile destinations outside the navigation viewport warm gradually. Visible links retain full prefetching for fast warm navigation.

No schema changes, data pruning, item limits or calculation changes were introduced.

## Evidence

The same anonymized populated-account fixture was reproduced locally, then imported under new IDs into a dedicated production smoke account. That temporary account was deleted after verification.

| Measurement                   |          Before |         After |
| ----------------------------- | --------------: | ------------: |
| Today HTML response           | 1,707,039 bytes | 282,600 bytes |
| Week HTML response            | 6,460,884 bytes | 789,353 bytes |
| Tasks HTML response           | 3,152,374 bytes | 366,592 bytes |
| Initially mounted Today forms |           1,038 |            23 |
| Initially mounted Week forms  |               — |            54 |
| Initially mounted Tasks forms |               — |            39 |

Response size comparisons use the local baseline and the live deployment with the equivalent anonymized data. Small differences in generated IDs and server metadata affect exact byte counts. The initial Today form count was verified against the local fixture; live checks also enforced the absence of the hidden item forms.

The pre-fix Week navigation did not finish within the original five-second assertion window. The fixed local fixture navigated successfully, with habit saves of 110–132 ms in the measured desktop and Android-profile runs. Live single-request response times for the populated clone were Dashboard 519 ms, Today 309 ms, Week 207 ms, Tasks 221 ms and Review 194 ms. These include network time and do not establish a percentile or universal speed guarantee.

Verification passed:

- 112 regression tests across 28 files, production build, and lint for changed code.
- Opening the 617-item checklist by section, recording completion and verifying it after reload.
- Editing the large task and confirming that all 1,015 items remained, including all 617 items in the edited checklist.
- Android browser-profile Today/Week navigation and absence of hidden item forms.
- Production error-log scan: zero error records returned after the live checks.

The expanded synthetic benchmark now includes 1,015 checklist items in addition to its existing 13,000 historical habit completions. Its persistence checks passed, but its strict 300 ms budget did not pass in the combined stress run. This fix removes the identified rendering bottleneck; it does not establish a product-wide 300 ms guarantee. The benchmark now measures action completion when the control is usable again and independently checks the persisted value, instead of relying on an optional RSC streaming tail to close. It runs the supported standalone server output.

## Deployment

Production website: [LifeOS](https://lifeos-gayashan-2026.vercel.app).

Deployment: `dpl_HuvUWTw3ZnonvGLpdFLqLZCiTyhc` (`lifeos-gayashan-2026-3e832id56.vercel.app`), promoted after its build and database health check passed. This supersedes `dpl_3axNn72eAdDZ5ozvRERruzfJs8pU`. The cloud Android app uses this same deployment.

The signed Android package was rebuilt and installed in place on the connected Infinix X6858 at 14:53 Asia/Colombo. Signature verification matched the installed app, installation and launch succeeded, and the original October 12 installation date was retained. No uninstall or app-data clearing was performed. The package includes the fix for bundled local mode as well as the online deployment.

APK: `dist-android/LifeOS-0.1.0-arm64-release.apk`.
SHA-256: `bdadebac74d421d4a1eae8e3f7cb39a82ae149832a2971a487e1c4e465eedf56`.
