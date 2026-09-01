# Audit — Denial Rework Loop: environment + workflow readiness

Read-only. Nothing was changed. Evidence = file:line and live queries against the creator test tenant `f53311c3…7789`.

## Live state right now (blocks any test until you seed)

- `claim_records` in the test tenant: **1 row, status `ready_to_bill`**. **Zero `denied` claims exist anywhere** (query on `claim_records where status='denied'` returned 0 rows).
- Last `simulation_runs` row: `Sandbox Reset`, 2026-09-01 01:56 UTC. `claim_records with simulation_run_id not null` = 0 — the reset swept cleanly.
- Patients: 9 (8 templates), all 9 have dob, sex and pickup_address — so injected denials will not be polluted by missing-demographic blockers.

---

## LAYER 1 — Test environment readiness

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1.1 | Injector creates 6 denials with real CARCs: CO-16, CO-50, CO-197, CO-29, CO-11, CO-167 — each sets `status='denied'`, `denial_code`, human `denial_reason`, `denial_category='payer'`, `adjustment_codes`, `submitted_at = now-12d` | PRESENT | `supabase/functions/simulation-lab/index.ts:1662-1669`, `:1809-1828` |
| 1.2 | Denied claims are billing-complete enough to work: `CLEAN_CLAIM_FIELDS` spreads ICD-10, origin/destination type, addresses, ZIPs onto every denied row | PRESENT | `index.ts:1682-1691`, spread at `:1815` |
| 1.3 | Injected claims are visible to the billing board: flipped `is_simulated=false`, `is_test_submission=false`; board query excludes `is_simulated=true` and metrics exclude `is_test_submission` | PRESENT (matched) | `index.ts:1822-1823`; `src/pages/BillingAndClaims.tsx:230`, `:1360` |
| 1.4 | **The pool the injector transforms has no trip** — with the tenant this empty, `createDenialsRemitsClaimPool` synthesises 25 claim rows that set no `trip_id` | **DEGRADES (major)** | `index.ts:1723-1749` (no `trip_id` key), `:1779-1790` |
| 1.5 | Reset exists and is thorough: deletes sim trips/legs/slots/claims, then `claim_records` tagged `simulation_run_id not null`, plus `claim_payments`, `remittance_files`, `plb_adjustments`, clears `SIM_INJECT` secondary-payer fields, deletes cloned patients and all `simulation_runs` | PRESENT | `index.ts:1522-1612`; UI button `src/pages/SimulationLab.tsx:301-316`, `:840-842` |
| 1.6 | Dates are current-relative — all buckets use `isoMinus`/`dateMinus` from `Date.now()`; denied `run_date` = today−10…−16 | PRESENT | `index.ts:1801-1804`, `:1730` |
| 1.7 | **CO-29 ("time limit for filing has expired") is stamped on a 10-day-old claim** — the readiness gate will find no timely-filing blocker, so that denial is trivially "resolvable" and proves nothing | DEGRADES | `index.ts:1730` vs `:1666`; gate at `src/lib/claim-readiness.ts:455` |
| 1.8 | Injector reachable in UI with success/count reporting: creator Simulation Lab card, auto-seeds `billing_risk` when the pool is thin, toasts counts, console-logs each call | PRESENT | `src/pages/SimulationLab.tsx:604-641`, `:198-255` |

---

## LAYER 2 — Plumbing (denial → classify → work → re-stage → resubmit)

| Link | Verdict | Evidence |
|---|---|---|
| Denial lands in the Denied tab with code + $ + blocker list | WORKS | `BillingAndClaims.tsx:168`, `:1381-1383`, `:1426-1428`, `:1492-1501` |
| Card exposes a working "Recover" action | WORKS | `BillingAndClaims.tsx:1871-1878` → `setRecoveryClaimId` → `:2238-2243` |
| Engine shows plain-English reason; all 6 injected codes exist in the translation table (incl. CO-167) | WORKS | `DenialRecoveryEngine.tsx:492-502`; `src/lib/denial-code-translations.ts:189` (43 codes) |
| Per-code checklist renders | PARTIAL — CO-16, CO-11, CO-50, CO-197, CO-29 have real checklists; **CO-167 falls to the generic default** (one line from `action_required`) | `DenialRecoveryEngine.tsx:30-123` (no `CO-167` case) |
| Live blocker list re-reads the DB, re-checks on window focus, has a manual Re-check button and deep-link fixes | WORKS | `DenialRecoveryEngine.tsx:249-272`, `:506-583`; `src/lib/claim-blockers.ts:66-133` |
| Fields needed to resolve are editable | **PARTIAL/BROKEN for the injector** — the editor only renders when `tripData` loads and only for CO-16/4/5/11/55/56; injected claims have `trip_id = null`, so the trip fetch never runs and **the Claim Field Corrections block never appears**; `saveFieldCorrections` early-returns | `DenialRecoveryEngine.tsx:126-133`, `:195-214`, `:280-283`, `:620` |
| Mark-resolved passes the hard blocker gate → `ready_to_bill` | WORKS | `DenialRecoveryEngine.tsx:365-443` (re-fetch, notes required, status write, `resubmission_count++`, `[RESUBMIT]` note, `biller_tasks` auto-complete, audit log, toast) |
| Resolved claim reappears in Ready to Bill | WORKS | status maps 1:1 in `src/lib/claim-status-tabs.ts:41-50` |
| Demotion safety net re-checks promoted claims | NOT EXERCISED by sim data — `demoteBlockedReadyToBill` only considers claims with a `trip_id` | `BillingAndClaims.tsx:899-903` |
| Submit to Office Ally boundary | NOT VERIFIED in this audit |

### 2.6 Where the sim path diverges from a real 835

The injector writes denial fields **directly onto `claim_records`**. It therefore never exercises, and will never prove:

- `src/lib/edi-835-parser.ts` — CLP/CAS/SVC/PLB segment parsing and line-level vs claim-level adjustment split
- `src/lib/remittance-match.ts` — matching CLP01 to a claim, NPI verification, and the **remittance quarantine** path
- `remittance_files` / `claim_payments` / `plb_adjustments` row creation and the `recompute_claim_from_payments` trigger (paid/allowed/PR math, underpayment "paid short")
- `src/lib/classify-denial.ts` categorisation from a parsed CAS group code (the injector hardcodes `denial_category='payer'`)
- Partial denials (paid + denied lines on one claim) and multi-CARC denials — every injected claim has exactly one code
- The automated Office Ally retrieval function end-to-end

Only a real or uploaded 835 proves those. The injector proves the **downstream** half: Denied tab → recovery UI → blocker gate → re-stage.

---

## LAYER 3 — Visual / UX completeness

| # | Finding | Evidence |
|---|---|---|
| 3.1 | Blockers with no `fixPath` render the dead-end text "no direct fix link" — no action for the biller | `DenialRecoveryEngine.tsx:569-573` |
| 3.2 | Filing-deadline badge is hardcoded to **365 days** in the engine, ignoring the payer directory (GA Medicaid = 180) — a Medicaid denial shows an optimistic countdown | `DenialRecoveryEngine.tsx:136-140`, `:479-482` |
| 3.3 | `fetchClaimBlockerSnapshot` returns `{blockers: []}` when the claim row can't be read (RLS/network) — a failed read looks *clean* and would let `handleMarkReady` pass | `claim-blockers.ts:74-75` |
| 3.4 | `handleSaveProgress` toasts "Progress saved" without checking the insert error | `DenialRecoveryEngine.tsx:347-363` |
| 3.5 | Unknown/unmapped denial code → generic explanation + a single "Review the denial reason" checklist item, no guidance, no fix path | `DenialRecoveryEngine.tsx:100-121`; `denial-code-translations.ts:371-376` |
| 3.6 | Denial with a blank `denial_reason` and unknown code renders "No details available" | `DenialRecoveryEngine.tsx:497` |
| 3.7 | Present and good: tab empty state, blocker loading state, green "structurally clean" confirmation, last-checked timestamp, resubmission history, claim Timeline drawer trigger | `BillingAndClaims.tsx:1718-1719`; `DenialRecoveryEngine.tsx:531-582`, `:467`, `:672-684` |

---

## Punch list, ranked

**BLOCKS a trustworthy test**
1. Environment is empty — 0 denied claims. Run Reset → seed → Inject Denials & Remits before testing (Layer 1 live query).
2. Injected denials carry no `trip_id`, so the Claim Field Corrections editor — the actual fix surface for CO-16 and CO-11 — never renders. The "work the denial by editing data" link of the loop cannot be tested with injector data as-is (1.4, Layer 2 row 6).

**DEGRADES the test**
3. CO-29 timely-filing denial dated 10 days ago is self-contradictory and resolves without any real work (1.7).
4. CO-167 has no dedicated checklist — generic fallback (Layer 2 row 4).
5. Every injected denial is single-CARC, claim-level, `denial_category='payer'` — no partial denial, no line-level CAS, no unknown-code case in the seed set (2.6).
6. The `demoteBlockedReadyToBill` safety net is skipped for trip-less claims, so the re-stage guard goes unverified (Layer 2 row 9).
7. Silent-clean failure mode in `fetchClaimBlockerSnapshot` (3.3) — a network blip during the test would read as "clean to resubmit".

**POLISH**
8. Engine filing countdown should use the payer directory instead of a hardcoded 365 (3.2).
9. "no direct fix link" dead-end text (3.1).
10. `handleSaveProgress` unchecked error (3.4).
11. Blank-reason / unknown-code rendering (3.5, 3.6).

**Untested by the injector regardless of the above** — 835 parsing, claim matching, quarantine, payment posting/variance math, PLB, and denial classification. Those need a real or uploaded 835 file (2.6).

No changes were made.
