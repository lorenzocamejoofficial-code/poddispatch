# AUDIT — Post-Denial Rework Loop (read-only report, nothing changed)

## The chain in one line

835 arrives → payment/denial posted on the claim → denial code translated to plain English → claim shows in the Denied tab / AR queue → biller opens Denial Recovery Engine, fixes real blockers → claim flips to `needs_correction` → a manual "Refresh Claims" pass promotes it to `ready_to_bill` → re-queued to Office Ally. The loop is closed, but with two real seams (auto-retrieval loses denial codes; `needs_correction` doesn't auto-return to the submit queue).

---

## 1. 835 / Remittance ingestion — PARTIAL (two paths, unequal)

**Path A — manual upload (full fidelity): WORKS**
- `src/lib/edi-835-parser.ts` — parses BPR (payment total), CLP (claim ref, status code, charged/paid/patient-resp), CAS adjustment groups with group code + reason code, PLB provider-level adjustments. `raw_denial_codes` built as `CO-45`, `PR-1` style strings (`edi-835-parser.ts:34, 242, 265, 338`); `getPrimaryDenialCode` skips CO-45 (`:418`).
- `src/pages/RemittanceImport.tsx` — matches by patient control number, then member ID + date of service, then charge amount (`:100-147`). Writes a `claim_payments` row per claim carrying `denial_code`, `denial_reason` (plain English), `adjustment_codes`, full `cas_adjustments` JSON, `write_off`, `allowed_amount`, capped `patient_responsibility` (`:334-354`). A DB trigger (`recompute_claim_from_payments`) rolls those into `claim_records`. File stored in `remittance_files`; PLBs in `plb_adjustments`.

**Path B — automated Office Ally pull: PARTIAL / this is the important gap**
- `supabase/functions/retrieve-remittance-officeally/index.ts:183-243` uses an inline "minimal parser" that reads only NM1*85 (billing NPI) and CLP. **It never reads CAS segments**, so no CARC/RARC is captured.
- It updates `claim_records` with `amount_paid`, `patient_responsibility_amount`, `status`, `paid_at`, `remittance_date`, `payer_claim_control_number` only (`:315-324`) — **no `denial_code`, no `denial_reason`, no `claim_payments` row**.
- Status is derived from CLP02 alone: `1|19 → paid`, `3|4 → denied`, else `needs_correction` (`:313`).
- Net effect: a claim denied via the automated pull lands in the Denied tab with a blank reason, and every downstream classifier/checklist falls through to "Unrecognized denial code."
- NPI-mismatch and no-match CLPs are diverted to `remittance_quarantine` (`:257, :345`) and reviewed in `src/components/creator/RemittanceQuarantinePanel.tsx` — that part WORKS.
- `supabase/functions/ingest-acks-officeally/index.ts` handles 999/277CA acknowledgments (front-end rejections), not 835s.

## 2. Denial classification — WORKS

- `src/lib/denial-code-translations.ts` (389 lines) — plain-English text, category, and `typical_resolution` per code.
  - CARC handled: CO-4, CO-5, CO-11, CO-15, CO-16, CO-18, CO-22, CO-23, CO-26, CO-27, CO-29, CO-31, CO-45, CO-50, CO-55, CO-56, CO-96, CO-97, CO-109, CO-119, CO-167, CO-197, CO-204; PR-1, PR-2, PR-3, PR-26, PR-27, PR-96; OA-18, OA-23, OA-96.
  - RARC handled: N30, N115, N180, N210, N211, N570.
- `src/lib/classify-denial.ts` — wraps the table, prefers `denial_code`, falls back to `rejection_codes`, treats partial pay as coordination-of-benefits rather than denial (`:53-70`), and returns an honest "Unrecognized denial code" fallback (`:207`).
- Also a DB-side `categorize_denial_code(text)` for bucketing.
- Categories map to your list (medical necessity CO-50, prior auth CO-15/CO-197, timely filing CO-29, wrong level CO-4/CO-55, missing info CO-16, patient responsibility PR-*).

## 3. Rework queue — WORKS

- `src/pages/BillingAndClaims.tsx` — status tabs including a **Denied** tab (`:163, :1265-1282`) with denied count, dollars recoverable, and denial rate (`:1249, :1311`). A banner deep-links straight to it (`:1376-1382`).
- Supporting surfaces: `BillerTaskQueue.tsx` (auto-generated `denial_unworked` tasks), `MissingMoneyPanel.tsx` (incl. paid-short), `TimelyFilingStrip.tsx` (tracks `denied` and `needs_correction` as still-active), `RemittanceActivityPanel.tsx` / `RemittanceHistoryPanel.tsx`, `ClaimTimelineDrawer.tsx`.
- It is actionable, not a static list — each denied row opens the recovery engine.

## 4. Fix step — WORKS

`src/components/billing/DenialRecoveryEngine.tsx`:
- Denial-specific checklists per CARC (`:30-123`).
- Editable claim/trip fields per denial code (`FIELDS_FOR_DENIAL`, `:126-133`) that actually persist via `saveFieldCorrections`.
- **Live blocker re-read** from `src/lib/claim-blockers.ts` (`:249-260`), the same rules the pre-submit checklist uses, so a fix made elsewhere (patient chart, PCS panel, trip) clears here on return; deep-links to those pages, and `onOpenPcsPanel` opens the PCS panel in place.
- Timely-filing countdown badge on the dialog (`:136-146, :191`).

## 5. Re-stage / resubmit — PARTIAL (one manual hop)

- `handleMarkReady` (`DenialRecoveryEngine.tsx:365-433`) hard-gates on fresh blockers, requires correction notes, saves field edits, then sets `status: "needs_correction"`, bumps `resubmission_count`, stamps `resubmitted_at`, writes a `[RESUBMIT]` note, auto-completes the `denial_unworked` biller task, and audit-logs.
- **`needs_correction` is not submittable.** Bulk submit filters `status === "ready_to_bill"` (`BillingAndClaims.tsx:469`) and the single-claim Submit button only renders for `ready_to_bill` (`:2004`). `queueClaimsForSubmission` is only ever called with those.
- The only bridge is the manual **Refresh Claims** action (`BillingAndClaims.tsx:730-820`), which re-derives the claim from the trip and promotes `needs_correction → ready_to_bill` when the gate is clean. Nothing calls it automatically after recovery.
- Once `ready_to_bill`, `src/lib/queue-claims-for-submission.ts` builds the 837P and inserts into `claim_submission_queue` with `status: submitted` (`:534-542`), blocking unmapped payers as `blocked_payer_mapping` (`:498-506`) and hard-blocking self-pay.
- **Where the loop ends with no live customer:** at the clearinghouse boundary. Without Office Ally credentials the claim can be built and queued (and exported via `/edi-export`), but nothing transmits and no real 835 ever comes back. Everything past "queued" must be simulated.

## 6. Simulation — EXISTS (two ways), no injector needs building from scratch

- **Simulation Lab injector — WORKS.** `supabase/functions/simulation-lab/index.ts`, action `inject_denials_remits` (`:2006`, implementation `:1740-1935`), driven from `src/pages/SimulationLab.tsx:199-251, 621`. It transforms up to 21 sim claims into: 6 denials with recoverable CARCs (CO-16, CO-50, CO-197, CO-29, CO-11, CO-167) setting `denial_code` / `denial_reason` / `adjustment_codes`, 4 paid-with-secondary, 5 aging >45d, 3 timely-filing, 3 paid-short. Every row is tagged with a `simulation_run_id` so reset can sweep it (`:1561-1580`).
- **Manual 835 upload — WORKS as a fuller test.** `RemittanceImport.tsx` accepts any hand-written 835 text file; on a sandbox/creator-test tenant `useIsSimulationCompany` flags the resulting `remittance_files` / `claim_payments` / `plb_adjustments` as simulated, and the DB guard `guard_simulated_payment` refuses that flag on real tenants. This is the only path that exercises the real CAS parser end to end.
- **Gap:** the Lab injector writes `denial_code` straight onto `claim_records` — it does not produce an 835 file, so it never exercises `edi-835-parser.ts`, `claim_payments`, or the trigger. Full-fidelity denial testing today means hand-crafting an 835 and uploading it.

## 7. Dead ends / seams to flag

1. **Auto-retrieved denials have no reason code** (`retrieve-remittance-officeally/index.ts:183-243`) — the highest-value gap. Recovery checklists degrade to generic for any claim denied through the automated pull.
2. **`needs_correction` limbo** — recovery marks a claim "ready for resubmission" but no submit control accepts that status; the biller must know to press Refresh Claims. The toast says "marked ready for resubmission," which overstates it.
3. **Auto pull writes no `claim_payments` row**, so the remittance/timeline panels and the recompute trigger see nothing for those claims — history is thinner than for manual imports.
4. **Auto pull ignores PLB** provider-level adjustments entirely.
5. **CLP02 fallback to `needs_correction`** for any status code other than 1/19/3/4 silently reclassifies odd payer responses as internal rework.
6. No auto re-check after a fix: blockers only refresh when the recovery dialog is open.

## Bottom line

Ingest **PARTIAL** · classify **WORKS** · queue **WORKS** · fix **WORKS** · re-stage **PARTIAL** · resubmit **WORKS (to the OA boundary)** · simulate **EXISTS**. A test-denial injector does **not** need to be built — but if you want the simulated denial to travel the same road a real one does, the missing piece is a canned 835 fixture pushed through the real parser, plus CAS parsing added to the automated Office Ally retrieval.

No files were changed.
