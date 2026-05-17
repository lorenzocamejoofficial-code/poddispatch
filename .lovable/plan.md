
# Rate auto-seeding — full plumbing plan

Anchor year: **CMS 2025** ambulance fee schedule (conversion factor $262.59, current RVUs, current $7.71/mi base + super-rural mileage bonus).

## The gap you spotted

`companies` has `address_street/city/state/zip` columns — but the signup form never asks for them and `company-signup` never writes them. So today the only geo signal we have is the State dropdown + an Urban/Rural radio button the owner self-selects. That's not enough to pick the right CMS locality rate.

## Phase 1 — what ships now

### 1. Capture address at signup (frontend + edge function)

`src/pages/CompanySignup.tsx`:
- Add 4 fields to the company info step: Street, City, State (already there as `state_of_operation`), **ZIP (5-digit, required, validated)**.
- ZIP regex: `^\d{5}(-\d{4})?$`, store as 5-digit.
- Auto-derive `service_area_type` from ZIP lookup (urban/rural/super_rural) instead of asking the owner — keep the radio as an override only.

`supabase/functions/company-signup/index.ts`:
- Accept and validate `addressStreet`, `addressCity`, `addressZip` (required), `addressState`.
- Write them onto the `companies` insert.

### 2. CMS ZIP → locality reference table

New table `cms_zip_locality` (global reference, not company-scoped, RLS = read-only to authenticated):
```
zip5            text PK
state           text
carrier         text     -- MAC carrier number
locality        text     -- locality code
rural_flag      text     -- 'U' urban, 'R' rural, 'B' super-rural
effective_year  int
```
Seed via a one-time migration from the **CMS 2025 ZIP Code to Carrier Locality File** (public CSV, ~30k rows). Bundled as a SQL migration so it travels with the codebase — no runtime download.

New table `cms_locality_gaf`:
```
carrier, locality, gaf_ambulance, effective_year   (PK = carrier+locality+year)
```
~100 rows. Seeded from the CMS 2025 Ambulance Fee Schedule public use file.

### 3. Rate calculator (shared helper)

New `supabase/functions/_shared/medicare-rates.ts`:
- Input: `zip5`
- Lookup locality + GAF + rural flag
- 2025 constants: CF = 262.59, RVUs (BLS-NE 1.0, BLS-E 1.6, ALS1 1.2, ALS1-E 1.9, ALS2 2.75, SCT 3.25), mileage = $7.71/mi (super-rural gets +50% on miles 1–17)
- Returns base + mileage rate per HCPCS

### 4. Seed `charge_master` on company creation

In both `company-signup` and `create-company` edge functions, after the company insert:
- If `address_zip` present → call helper, insert 5 rows into `charge_master`:
  - `medicare` — real calculated rates, flagged `auto_seeded=true`, `needs_review=false`
  - `medicaid` — placeholder ($0 or state-typical), `needs_review=true`
  - `private` — placeholder, `needs_review=true`
  - `self_pay` — placeholder, `needs_review=true`
  - `default` — fallback, `needs_review=true`
- Add two columns to `charge_master`: `auto_seeded boolean`, `needs_review boolean`.

### 5. Harden the wizard "Verify Your Rates" gate

`useOnboardingProgress` rate check changes from "≥1 row with base+mileage > 0" to:
- All 5 standard payer types present, AND
- None still flagged `needs_review = true`.

This forces the owner to open each payer in the Charge Master and confirm/edit the placeholder before the step turns green. Medicare is already real, so they'd typically just confirm it.

UI on `/billing?tab=charge-master`: yellow "Needs verification" badge on placeholder rows + a "Confirm rate" button that flips `needs_review=false`.

## Phase 2 (deferred, not in this change)

- Per-state Medicaid fee schedule table (start with GA).
- Annual CF/RVU refresh job each January.
- Editable GAF override for owners in unusual localities.

## Technical details

- The CMS ZIP file is public — bundled as a migration is fine size-wise (~2 MB SQL). If too large for a single migration we'll split into 4–5 migration files by state range.
- ZIP lookup is a single PK fetch — no perf concern.
- Override path: owner can always edit `charge_master` rows directly; auto-seed only runs once on company creation.
- Existing companies (you + the simulation tenant) are unaffected — the change only fires on `INSERT companies`. We can run a one-shot backfill after if you want.

## Order of work

1. Migration: add `auto_seeded`, `needs_review` to `charge_master`; create `cms_zip_locality` + `cms_locality_gaf` tables with RLS.
2. Migration(s): seed CMS 2025 ZIP + GAF data.
3. `_shared/medicare-rates.ts` helper.
4. Edit `company-signup` + `create-company` to capture address and call seeder.
5. Edit `CompanySignup.tsx` to collect Street/City/ZIP and validate.
6. Update wizard rate-gate logic + Charge Master "needs review" UI.
7. Update memory: `onboarding-wizard-v2` (new gate) + new `billing/auto-rate-seeding` memory.

Want me to proceed end-to-end, or stop after Phase 1 step 1–2 (schema + data) so you can sanity-check the ZIP table before I wire the rest?
