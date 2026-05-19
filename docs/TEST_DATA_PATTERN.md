# Test Data Pattern — Payment / Remittance Seeding

**Effective 2026-05-19 (Phase 5.7+).**

## Rule

There is exactly one acceptable way to seed payment data (`claim_payments`,
`plb_adjustments`, `remittance_files`) for testing purposes:

> **Import a synthetic X12 5010 835 file through the real parser path at
> `/remittance-import` (`RemittanceImport.tsx` → `edi-835-parser.ts`),
> running inside a tenant where `companies.creator_test_tenant = true` OR
> `companies.is_sandbox = true`.**

The parser propagates `is_simulated = true` automatically into all three
tables when the active tenant is a test/sandbox tenant. Real customer
tenants always import with `is_simulated = false`.

## What is FORBIDDEN

- `INSERT INTO public.claim_payments` inside any migration file.
- `INSERT INTO public.plb_adjustments` inside any migration file.
- `INSERT INTO public.remittance_files` inside any migration file.
- Direct `psql` / SQL-tool inserts into the above for "test fixtures".
- Any code path that bypasses the 835 parser to construct payment rows.

## Why

1. Direct inserts skip `is_simulated` propagation. A row with no flag is
   indistinguishable from real revenue and pollutes AR aging, DSO,
   collection rate, missing-money scans, claim-probability scoring, the
   secondary-claim opportunity detector, and the SaaS metrics dashboard.
2. Direct inserts skip the `cas_adjustments` shape that the 837P secondary
   COB emitter depends on. Phase 5.5 was bitten by exactly this.
3. Direct inserts skip BPR/PLB reconciliation, so the imported "file" has
   no `remittance_file_id` and looks orphaned to every downstream consumer.

## Enforcement

- DB trigger `guard_simulated_payment` rejects any `is_simulated = true`
  row on `claim_payments` / `plb_adjustments` / `remittance_files` whose
  `company_id` is not flagged as a test or sandbox tenant. This makes
  cross-tenant pollution physically impossible.
- Future migration reviews must reject any new `INSERT INTO` on these three
  tables. If a future feature genuinely needs server-side seed data, the
  correct path is a synthetic 835 file fixture under `tests/fixtures/835/`
  imported through the parser in a test setup script.

## How to generate a synthetic 835

1. Pick the primary claim(s) you want to mark "paid".
2. Construct an 835 with: `ISA*…~GS*HP~ST*835*…~BPR*I*<sumPaid>*C*ACH…~
   TRN*…~DTM*405*<paydate>~N1*PR*<Payer>~N1*PE*<Provider>~LX*1~
   CLP*<patient_control_number>*<status>*<charge>*<paid>*<patResp>*<payer_id>*<ICN>~
   CAS*CO*45*<amount>~CAS*PR*1*<amount>~AMT*B6*<allowed>~SE*…~GE*…~IEA*…~`.
   The `patient_control_number` must match the existing `claim_records.id`
   convention used in 837P generation (typically `<MMDDYY>-<short-id>`).
3. Upload via `/remittance-import` while signed in as the test/sandbox tenant.
4. Verify: `SELECT is_simulated FROM claim_payments WHERE …` returns `true`.

## History

- **Phase 5.5** (`20260519010020`) introduced direct `INSERT` of a seeded
  `claim_payments` row to test the secondary-claim (COB) feature. This
  predated the `is_simulated` column on `claim_payments`. The row was
  cleaned up and the column / guardrail were added in Phase 5.6 / 5.7.
  That migration is the **only** historical violation; it should not be
  used as precedent.