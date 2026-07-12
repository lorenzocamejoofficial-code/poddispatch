---
name: NEMSIS/GEMSIS submission pipeline
description: How PCR submissions to state EMS repositories are queued, submitted, and retried
type: feature
---
Every finalized PCR generates a `nemsis_submissions` row via the `submit-gemsis-pcr` edge function.

- Status flow: `queued` → `submitting` → `accepted` | `rejected` | `error`
- `test_mode=true` routes to NEMSIS TAC sandbox (used during compliance testing). Default until vendor cert lands.
- `STATE_ENDPOINTS` in `supabase/functions/submit-gemsis-pcr/index.ts` is empty until GA DPH issues real endpoints. Until then submissions stay `queued` (no external POST).
- Retries: rows with status `queued` or `error` are picked up by nightly retry cron (to be scheduled once endpoints exist).
- XML built by `src/lib/nemsis/exporter.ts` (`buildERecord` for Web Service, `buildStateDataSet` for file download).
- GA-specific eCustom lives in `src/lib/nemsis/states/ga.ts`. Adding neighboring states = one new sibling file.
- Billing pipeline never reads `nemsis_submissions`. Submission failures do NOT block claims.