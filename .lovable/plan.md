## Goal

Mirror how primary/secondary insurance flows through PodDispatch today, and extend it so:

1. The Patient form shows a **Verify / Discover** tab strip up top (disabled, "Activate with Office Ally" tooltip) so the UX is built and visible.
2. **Tertiary insurance** becomes a real, end-to-end field — captured on the patient, carried into the trip/PCR, and able to spawn a tertiary claim after the secondary pays.
3. Nothing actually pings Office Ally yet — Verify/Discover buttons stay disabled, same pattern as the existing eligibility button.

---

## What gets built

### 1. Database (one migration)

Add tertiary columns mirroring the existing secondary shape:

- `patients`: `tertiary_payer_id`, `tertiary_member_id`, `tertiary_group_number`, `tertiary_relationship`, `tertiary_payer_name`
- `trip_records` (or whichever table snapshots payer info onto the trip — same place `secondary_*` lives): matching `tertiary_*` columns so the claim generator has them at submission time
- `claims`: `claim_level` already supports `primary`/`secondary`; extend the enum/check to also accept `tertiary`
- `eligibility_checks`: add an `inquiry_mode` column (`verify` | `discover`) so when OA goes live we can route both flows through the same table

Plus a tiny `coverage_discoveries` table to hold the multi-coverage results Discover returns (one patient → many discovered policies, each with payer, member id, rank, confidence). Empty until OA is live, but the schema + RLS are ready.

### 2. Patient form UI

At the top of the Add/Edit Patient dialog, add a `Tabs` strip:

- **Verify** (default) — current form, with primary/secondary/**tertiary** insurance sections. Tertiary section looks identical to secondary. A disabled "Check Eligibility" button sits next to each payer row with the "Activate with Office Ally" tooltip.
- **Discover** — a placeholder panel: name + DOB inputs, a disabled "Discover Coverage" button, and an empty results table styled to show how discovered policies would appear (Payer / Member ID / Rank / Confidence / "Use as Primary/Secondary/Tertiary").

Both tabs save into the same patient record. Discover results, when wired up later, will pre-fill the Verify tab's payer fields.

### 3. PCR / Billing card

`src/components/pcr/BillingCard.tsx` already shows primary + secondary. Add a tertiary block beneath secondary with the same fields and the same conditional show/hide (only render if a tertiary payer is set on the patient). No new logic — just mirror the secondary block.

### 4. Claim pipeline

- `src/lib/create-secondary-claim.ts` currently spawns a secondary claim after the primary pays. Add a sibling `create-tertiary-claim.ts` (or extend the existing file with a `targetLevel` param) that spawns a tertiary claim after the secondary pays, using the patient's tertiary payer.
- 835 remittance import: when a secondary CLP posts and a tertiary payer exists on the trip, queue a tertiary claim — same trigger point that today queues secondary.
- Claim readiness / pre-submit checklist: extend the existing payer-aware gates so tertiary claims run through the same validation.

Office Ally itself routes whichever payer is on the 837P loop 2010BB — so yes, OA will submit the tertiary claim for us. No separate integration needed; we just generate a third 837P with the tertiary payer in the right loop.

### 5. Memory

Add `mem://billing/tertiary-coverage` documenting:
- Patient → Trip → Claim carries primary/secondary/tertiary symmetrically
- Tertiary claim is spawned by the same engine that spawns secondary, after secondary pays
- Verify vs Discover modes share `eligibility_checks` via `inquiry_mode`
- Discover results land in `coverage_discoveries`; user promotes them into the patient's payer slots

---

## What stays disabled

- Verify "Check Eligibility" button per payer row
- Discover "Discover Coverage" button
- Both show the same "Activate with Office Ally" tooltip used by the existing eligibility button

When you sign with Brett and paste the REST URLs into `vendor_clearinghouse_settings`, those buttons light up automatically — no further UI work needed.

---

## Technical notes (skip if not interested)

- Tertiary claim trigger lives in the 835 import path, same place secondary is triggered today. Single new branch: `if (level === 'secondary' && trip.tertiary_payer_id) queueTertiary()`.
- `claim_level` is currently a check constraint, not a Postgres enum, so extending it is a one-line `ALTER TABLE ... DROP CONSTRAINT / ADD CONSTRAINT`.
- `coverage_discoveries` gets standard tenant RLS (`company_id = current_company()`), `service_role` full access for the edge function, `authenticated` read/write scoped to company.
- Discover edge function will be a sibling of `check-eligibility` (`discover-coverage`) using OA's REST JSON discovery endpoint — stub it now with the same "endpoint not configured" fail-fast so the UI has something to call when activated.

---

Want me to build this as described, or adjust scope first (e.g. skip Discover entirely for now, or skip the tertiary claim generator and just do the patient-side fields)?