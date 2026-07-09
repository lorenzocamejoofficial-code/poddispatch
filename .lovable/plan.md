
# GEMSIS/NEMSIS v3.5.1 Compliance — Path 2 Spec

## Goal
Bring the PCR to a NEMSIS-aligned data model so every field a Georgia pilot customer captures is structurally compatible with GEMSIS submission — without formally submitting yet. Full NEMSIS TAC certification follows in parallel over the next 6–12 months.

## Architecture decisions (from your answers)
- **One adaptive PCR** — merge EMS and NEMS flows into a single PCR that shows/hides sections based on transport type (emergency vs non-emergency, 911 vs interfacility, etc.)
- **Sequencing:** dropdowns → NEMSIS mandatory elements → GEMSIS state elements
- **No compliance status shown in the UI** — handled in sales conversations only

## Scope of this plan (Phase 1 only — dropdowns)
Phase 1 swaps every free-text or ad-hoc dropdown in the PCR to the official NEMSIS v3.5.1 code sets. This is the foundation — every later phase depends on data being in NEMSIS-shaped values.

Later phases (missing NEMSIS elements, GEMSIS state elements, XSD/Schematron validation, Web Service export, TAC testing) are separate plans.

---

## Phase 1 work

### 1. Add NEMSIS code set library
New file: `src/lib/nemsis-code-sets.ts`
- Contains the official NEMSIS v3.5.1 SNOMED/LOINC/NEMSIS-defined pick lists as typed constants
- One export per element (e.g. `E_AIRWAY_STATUS`, `E_MEDICATION_ROUTE`, `E_PROCEDURE_RESPONSE`)
- Each entry stores `{ code, display, system }` so both the human label and the coded value are captured
- Sourced from NEMSIS v3.5.1 data dictionary (I'll pull the actual code values in build)

### 2. Migrate existing dropdowns
Replace ad-hoc arrays currently in:
- `src/lib/pcr-dropdowns.ts` (oxygen delivery, mobility, etc.)
- `src/components/pcr/AirwayCard.tsx` (airway status, interventions, confirmation methods, suction types)
- Vitals, assessment, medications, procedures, disposition, and other PCR cards

For each: swap the local array for the corresponding `E_*` constant from `nemsis-code-sets.ts`.

### 3. Merge EMS + NEMS into one adaptive PCR
- Introduce a single `transport_category` field on `trip_records`: `911_scene | interfacility_emergency | interfacility_non_emergency | routine_transport | dialysis | hospice`
- Derive it from existing `scheduling_legs` context (already cascaded per your transport-context memory)
- Update `usePCRSectionRules` to drive section visibility from `transport_category` instead of the current EMS/NEMS split
- Retire the "EMS PCR vs NEMS PCR" branching in `PCRPage.tsx`

### 4. Persist coded values alongside displays
- PCR cards write the NEMSIS **code** to the JSONB field, not just the display label
- Existing displays keep working (label rendered from the code set)
- Enables future XSD export without a rewrite

### 5. Backfill safety
- One-time backfill script maps existing free-text values in `trip_records` JSONB columns to the closest NEMSIS code where possible; unmappable values stay as-is and are flagged for QA
- No data loss; historical PCRs remain readable

---

## Out of scope for Phase 1
- Adding missing NEMSIS mandatory elements (Phase 2)
- GEMSIS state-specific required elements (Phase 3)
- XSD validation on finalize (Phase 4)
- Schematron business rules (Phase 5)
- NEMSIS Web Service export endpoint (Phase 6)
- Formal NEMSIS TAC compliance testing (Phase 7)

## Technical details

**Database changes**
- Add `transport_category` enum column to `scheduling_legs` and `trip_records` (cascades via existing transport-context util)
- No destructive changes to existing PCR JSONB columns

**Files touched**
- New: `src/lib/nemsis-code-sets.ts`
- Modified: `src/lib/pcr-dropdowns.ts`, `src/hooks/usePCRSectionRules.ts`, `src/lib/transport-context.ts`, all `src/components/pcr/*Card.tsx` files, `src/pages/PCRPage.tsx`
- Migration: adds `transport_category` column, backfills from existing origin/destination/service_level

**Memory updates**
- New memory: `mem://features/nemsis-alignment-phase-1` documenting the code set library, merged PCR model, and coded-value storage pattern

## Risk & rollback
- Phase 1 is additive at the data layer (new column, coded values stored alongside displays). Existing billing flow reads the same fields it does today — no change to 837 generation.
- If a NEMSIS code set entry breaks a card's UX, individual cards can revert to the old array without unwinding the whole phase.

---

## What I need from you before I start building
Approve this plan and I'll begin with the migration for `transport_category`, then the `nemsis-code-sets.ts` library, then card-by-card dropdown swaps. Estimated Phase 1 build: several sessions of focused work.
