# Audit — Unrecognized denials → creator escalation

Read-only. Nothing changed. Evidence = file:line + live DB reads.

---

## PART A — How an unknown denial code behaves today

### A1. End-to-end path for a code not in the reference table

The table has **43 codes** (`src/lib/denial-code-translations.ts`, CO-4…CO-204, PR-*, OA-*), mirrored for edge functions at `supabase/functions/_shared/denial-code-translations.ts`. Lookup is a plain map read that returns `null` on a miss (`denial-code-translations.ts:354-356`).

What the biller sees, by surface:

| Surface | Behaviour on unknown code | Evidence |
|---|---|---|
| Claim card / work queue | `classifyDenial` finds no CARC → verdict `"Unrecognized denial code"`, recoverable `"maybe"`, CTA `"Review"` | `src/lib/classify-denial.ts:53-61`, `:205-212` |
| Denial Recovery Engine header | Shows the **raw code** verbatim (`claim.denial_code ?? "Unknown Denial"`), then `translation?.plain_english_explanation ?? claim.denial_reason ?? "No details available"` | `DenialRecoveryEngine.tsx:492-502` |
| Engine checklist | Falls to the `default:` branch — since `translation` is null there is no `action_required`, so the biller gets **one generic item**: "Review the denial reason and determine next steps" | `DenialRecoveryEngine.tsx:100-121` |
| Field-correction editor | `FIELDS_FOR_DENIAL` has no entry → the editor never renders | `DenialRecoveryEngine.tsx:126-133`, `:620` |
| Missing Money / Owner dashboard / Revenue Cycle | `getDenialTranslation` returns null and the row degrades to raw code only | `useMissingMoneyScan.ts:313`, `OwnerDashboard.tsx:162,175,209`, `RevenueCycleTab.tsx:274` |
| Helper text | `getActionRequired` returns "Unrecognized denial code. Review the remittance advice for details." — but no UI surface calls it on this path | `denial-code-translations.ts:371-376` |

**Net:** the biller is not lied to, but is handed a dead end — raw code, payer's own reason string, one generic checklist line, no fix fields, no escalation.

### A2. Is the raw payer data preserved? — YES, fully

`claim_records` carries 12 denial/rejection columns (live `information_schema` read):
`denial_code`, `denial_reason`, `denial_category`, `adjustment_codes`, `rejection_codes`, `rejection_reason`, `last_rejection_raw`, `last_rejection_segment`, `last_rejection_loop`, `last_rejection_byte`, `last_rejection_recorded_at`, `last_rejection_recorded_by`.

The 835 parser keeps every CAS pair as `groupCode-reasonCode` in `raw_denial_codes` (`src/lib/edi-835-parser.ts:265`, deduped `:338`) and the poster writes `denial_code = primaryDenial.code` plus the **full array** into `adjustment_codes` (`src/lib/remittance-post.ts:86-88`, mirrored in `supabase/functions/_shared/remittance-post.ts:71-88`). `denial_reason` is the payer's own text, not a lookup, so it survives translation misses. Ack rejections additionally store the raw segment/loop/byte via the `last_rejection_*` columns.

### A3. Is an unknown code logged anywhere? — NO

`rg` across `src/` and `supabase/functions/` for the translation helpers finds only render-time call sites; there is no counter, no insert, no telemetry, no audit event, no notification fired when `getDenialTranslation` returns null (`denial-code-translations.ts:354`, `:371`; all call sites listed in A1). Nothing distinguishes "code we don't know" from "code we know" anywhere in the data. **Unknowns are invisible to you today** — they only exist on the claim row a biller happens to open.

---

## PART B — Existing creator-side review machinery

Everything lives on **one page**: `src/pages/CreatorConsole.tsx:834-889` — 12 tabs.

### B1. Remittance Quarantine (closest existing pattern)

- Table `public.remittance_quarantine`, 23 columns (live `\d`): `importing_company_id` + `matched_company_id` (both FK → `companies`), `remittance_file_id`, `posted_to_claim_id`, `patient_control_number`, `payer_claim_control_number`, `billing_npi_in_file`/`expected_billing_npi`, `raw_clp_segment`, `quarantine_reason` (free text, NOT NULL), `status` (default `pending_review`), `file_type` CHECK in `('835','999','277ca')`, `reviewed_by`/`reviewed_at`/`resolution_notes`.
- UI: `src/components/creator/RemittanceQuarantinePanel.tsx`, mounted at `CreatorConsole.tsx:846,874`.
- **Company categorisation:** not grouped, but per-row attributed — company IDs are resolved to names client-side (`RemittanceQuarantinePanel.tsx:86-101`) and both filters are status/file-type, not company (`:57-58`).
- Creator actions: `resolved_posted`, `resolved_ignored`, `resolved_reassigned`, `resolved_routed` (`:41-47`). Routing is the only one with real plumbing — it calls the `route-quarantined-remittance` edge function, which hands the money to the target tenant so **they see it in their own Remittance History** (`:126-152`). Others just stamp status + notes (`:155-176`).
- Writers: `retrieve-remittance-officeally`, `ingest-acks-officeally`, `RemittanceImport.tsx`, `manage-company`.
- Live: 5 rows, all `999 … could not be matched to a submitted batch`.
- **Verdict:** the *shape* is right (creator-only queue, company attribution, review → resolve → push result back to the tenant) but the *meaning* is "inbound file line that was never posted to anyone's books." An escalated denial is the opposite: a claim that IS posted, in a known company, that the biller can't work. The `file_type` CHECK constraint and the NPI/CLP columns would all be dead weight. **Reuse the pattern, not the table.**

### B2. Every creator queue that exists

| Queue | Table | Company-scoped? | Extendable pattern? |
|---|---|---|---|
| Pending approvals / Active / Awaiting payment / Suspended / Rejected / Archived | `companies` (+`company_verifications`) | is the company | No — company lifecycle, not work items |
| Company verification (NPI/Medicare/OIG) | `company_verifications` | yes, FK | No |
| Remittance Quarantine | `remittance_quarantine` | yes, two FKs | Yes — best structural template (B1) |
| Reconciliation | `ReconciliationReportPanel.tsx` over remittance tables | yes | Reporting only, no work state |
| Acknowledgments | `legal_acceptances` | yes | No |
| **Support** | `support_tickets` | yes, `company_id` NOT NULL FK | **Yes — closest behavioural match** |
| Load Test / System Health / Announcements | ops panels | n/a | No |
| Mission Control counters | counts urgent + open `support_tickets` and `pending_review` quarantine | yes | Yes — the badge surface to reuse |

Evidence: `CreatorConsole.tsx:29-38`, `:834-889`; `MissionControlPanel.tsx:77-96`.

### B3. Existing tenant → creator escalation — YES, exactly one

`support_tickets` is a full working loop:

- Tenant creates: `src/components/BugReportDialog.tsx:106-111` (company_id, user_id, page_path, subject, severity, category, client_context) with a `ticket_number` auto-assigned by the `assign_support_ticket_number` trigger.
- Creator reviews: `SupportTicketsPanel.tsx` — severity ranking (urgent/high/normal/low, `:43`), status filter, per-company enrichment via `fetchRealCompanyIds`, status writes (`:144`), `creator_notes` writes (`:154`), and a **reply that reaches the customer** through the `reply-support-ticket` edge function (`:165`).
- Tenant sees it back: their ticket history + status in `BugReportDialog.tsx:80-85`; `useNotificationFeed` surfaces ticket rows.
- RLS: `Creator can read all tickets` / `Creator can update tickets` via `is_system_creator()` (live `\d support_tickets`).

No other tenant-side event creates a creator-side review item.

---

## PART C — Minimum build for company-categorised denial escalation

### C1. Host: a new small table, not quarantine, not raw tickets

`remittance_quarantine` is semantically wrong (B1) and constrained by `file_type`. `support_tickets` is behaviourally right but has no claim linkage, no denial code, and mixes "the app is broken" with "this claim is weird" in one queue you'd have to triage by hand.

Smallest honest design — **one table, modelled on `remittance_quarantine`'s columns and `support_tickets`' loop**:

```
escalated_denials
  id                uuid pk
  company_id        uuid not null  -> companies(id)      -- categorisation key
  claim_id          uuid not null  -> claim_records(id)
  denial_code       text                                  -- raw, as received
  raw_reason        text                                  -- payer text verbatim
  adjustment_codes  text[]                                -- full CAS set
  trigger           text  -- 'unknown_code' | 'biller_flagged'
  biller_note       text
  status            text default 'pending_review'
      -- pending_review | creator_working | resolved_guidance | resolved_no_action
  creator_notes     text
  resolution        text  -- what the biller should do, shown in their claim
  reviewed_by uuid, reviewed_at timestamptz
  created_by  uuid, created_at timestamptz default now()
```
Plus grants + RLS: creator full via `is_system_creator()`; tenant `SELECT`/`INSERT` scoped to `get_my_company_id()` (mirrors the ticket policies).

Two writers:
1. **Automatic** — in the remittance poster (`src/lib/remittance-post.ts:69-88` and the `_shared` twin), when `getDenialTranslation(primaryDenial.code)` returns null on a denied claim, insert one row. This is the single place every denial (manual upload *and* Office Ally auto-retrieve) already funnels through, so one insert covers both paths.
2. **Manual** — an "I don't know how to resolve this — escalate" button in the Denial Recovery Engine, next to Save Progress (`DenialRecoveryEngine.tsx:347-363` is the existing pattern to copy).

### C2. Claim flow — stays visible, never disappears

The claim keeps `status='denied'` and **stays in the customer's Denied tab**. No new `claim_status` enum value, so nothing in `claim-status-tabs.ts`, the readiness gate, or the 837 path changes. The card and the engine simply render an "Escalated to support — awaiting review" badge when an open `escalated_denials` row exists (same query shape as the existing blocker snapshot in `src/lib/claim-blockers.ts:66`). The biller is never stuck waiting on an empty screen and can still work the claim if they figure it out first.

### C3. Resolution back to the customer

Creator writes `resolution` + sets status `resolved_guidance`. Then, reusing what already exists:
- the badge on the claim flips to "Support responded" and the engine shows the `resolution` text inline;
- write the resolution as an `ar_followup_notes` row on the claim (already rendered in the engine's history, `DenialRecoveryEngine.tsx:672-684`) so it lands in the claim timeline permanently;
- optional and free: reuse `reply-support-ticket`-style email only if you want out-of-app notification — not required for v1.

No new notification plumbing, no ticket thread, no attachments, no SLA.

### C4. Creator UI — one tab, copied from the quarantine panel

A `Denial Escalations` tab beside `Remittance Quarantine` (`CreatorConsole.tsx:846`), rendering the same table/dialog structure as `RemittanceQuarantinePanel.tsx`: rows with company name (resolved the same way, `:86-101`), denial code, raw reason, claim link, days waiting; filters by status and **by company**; a review dialog that writes `creator_notes` + `resolution` + status. Add the pending count to `MissionControlPanel.tsx:77-96` next to the existing quarantine and urgent-ticket counters so it shows up on your overview without a new page.

That is the whole minimum: one table, one auto-insert, one button, one tab, one counter.

### C5. Learn-from-traffic (do this in v1 — it's nearly free)

Yes, flag it. Without it you are personally in the loop for every odd code forever. Because every escalation row stores `denial_code` + `company_id`, the graduation loop is a `group by denial_code` read over the same table:

- Add a small "Unknown code frequency" summary to the same tab: code, occurrence count, distinct companies affected, total dollars, first/last seen. No extra table.
- Rule of thumb: any code seen 3+ times, or across 2+ companies, gets promoted into `denial-code-translations.ts` (both copies — `src/lib/` and `supabase/functions/_shared/`, kept in sync by `scripts/sync-billing-to-edge.sh`) plus a checklist case in `DenialRecoveryEngine.tsx:30-123` and, where a field fix applies, an entry in `FIELDS_FOR_DENIAL:126-133`.
- Each promotion permanently removes that code from your inbox. The manual queue then drains toward genuinely rare/odd denials only.

One caveat worth designing around now: the auto-insert must dedupe. Keyed on `(claim_id)` for open rows, or a payer sending an unknown code across a 40-claim remittance file creates 40 escalations. Group by code within a file, or insert one row per claim but let the creator resolve in bulk by code.

---

## Punch list

**Present today:** raw code, raw payer reason, full CAS array and rejection segment/loop/byte are all persisted on `claim_records` — no data is lost. An honest "Unrecognized denial code / Review" verdict exists. A proven creator review pattern exists twice over (quarantine: company-attributed queue with routing back to the tenant; support tickets: tenant-initiated escalation with creator notes and a reply that reaches the customer).

**Missing:** zero logging or counting of unknown codes anywhere — you cannot currently answer "which codes are we blind to, and for whom." No escalation path from a denial. No creator queue that knows about claims. The unknown-code checklist is a single generic line with no fix fields and no way out.

**Recommendation:** new `escalated_denials` table (structure copied from `remittance_quarantine`, loop copied from `support_tickets`), claim stays in the Denied tab with an escalated badge, resolution returns as an `ar_followup_notes` entry, one creator tab plus one Mission Control counter, and a frequency rollup from day one so common unknowns graduate into the automated table instead of staying manual.

No changes were made.
