---
name: Transport Context Cascading
description: Run record is single source of truth — service_level, origin/destination type, is_unscheduled cascade from scheduling_legs to trip_records and all downstream systems
type: feature
---
The scheduling_legs (run record) is the single source of truth for transport context. All downstream behavior is derived from it:

- **service_level** (BLS/ALS1/ALS2/bariatric): Added to scheduling_legs table. Cascades to trip_records at creation. Drives HCPCS code derivation, charge master rate lookup, and BillingCard display via `deriveServiceLevel()` and `deriveHcpcsBaseCode()` in `src/lib/transport-context.ts`.
- **origin_type**: Cascades from scheduling_legs to trip_records. Drives PCS defaults (facility origins require PCS), sending facility visibility, and origin modifier for claims.
- **destination_type**: Cascades from scheduling_legs to trip_records. Drives PCR section requirements (via usePCRSectionRules), destination modifier for claims.
- **is_unscheduled**: Added to scheduling_legs table. Cascades to trip_records. Same-day unscheduled runs: PCS absence downgraded to yellow QA warning (not red blocker), PCS check skipped in PreSubmitChecklist, tagged in biller view.
- **Central utility**: `src/lib/transport-context.ts` provides `buildTransportContext()` and individual derivation functions.
- **QA fix mode**: PCR opened from Compliance/QA page (`mode=qa-fix`) is fully editable (isReadOnly=false on line 718 of PCRPage.tsx).
- **Trip creation points**: Both PCRPage.createTripForRun and TripsAndClinical.syncSlotsToTrips now cascade service_level, is_unscheduled, origin_type, destination_type from scheduling_legs.
