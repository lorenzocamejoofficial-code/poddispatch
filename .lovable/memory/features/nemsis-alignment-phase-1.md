---
name: NEMSIS/GEMSIS Alignment Phase 1
description: NEMSIS v3.5.1 code sets library, transport_category enum, and coded-value persistence pattern for the adaptive PCR
type: feature
---
Georgia pilot targets GEMSIS (NEMSIS v3.5.1). Both EMS and non-emergency PCRs must be NEMSIS-aligned — GA requires submission from every licensed EMS provider regardless of call type. Compliance status is intentionally NOT shown in the UI (sales-conversation only).

**Code set library**
- `src/lib/nemsis-code-sets.ts` is the single source of truth for NEMSIS-defined pick lists. Every entry is `{ code, display, system }` where `system` is `"SNOMED-CT" | "NEMSIS" | "LOINC"`.
- Naming convention: `E_<ELEMENT_NAME>` mirrors the NEMSIS element id (e.g. `E_AIRWAY_STATUS` ≈ eAirway.02).
- Helpers: `toOptions(codes)` for shadcn Select, `findByCode(codes, value)` for lookup, `findByDisplay(codes, value)` for legacy free-text backfill.
- Registry `NEMSIS_CODE_SETS` indexes every code set — used by future backfill and XSD export code.

**Persistence pattern (write code, read either)**
- PCR cards WRITE the NEMSIS `code` to the JSONB field (not the display string).
- On read, cards accept EITHER the NEMSIS code OR the legacy free-text display (via `findByCode` then `findByDisplay` fallback) so historical PCRs remain viewable.
- Never rip out `findByDisplay` fallback — it protects data written before the swap.

**Transport category (adaptive PCR foundation)**
- New enum `public.transport_category` on `scheduling_legs` and `trip_records`: `911_scene | interfacility_emergency | interfacility_non_emergency | routine_transport | dialysis | hospice | unknown`.
- Cascades from run → trip like existing service_level/origin_type/destination_type per transport-context-cascading memory.
- Merges the old EMS/NEMS distinction into a single adaptive PCR driven by this field.

**Rollout order (locked)**
1. Dropdowns → NEMSIS code sets (Phase 1)
2. Add missing NEMSIS mandatory elements (Phase 2)
3. GEMSIS state-specific required elements (Phase 3)
4. XSD + Schematron validation on finalize (Phase 4)
5. NEMSIS Web Service export (Phase 5)
6. Formal NEMSIS TAC compliance testing (Phase 6)

**Phase 1a status (shipped)**
- Code set library created with airway_status, airway_interventions, suction_type, airway_confirmation, oxygen_delivery.
- `src/components/pcr/AirwayCard.tsx` is the pilot — refactored to read/write NEMSIS codes.

**Phase 1b remaining PCR cards to swap** (next session)
- VitalsCard, AssessmentCards, MedicationsCard, ProceduresCard, IVAccessCard, ConditionCard, EquipmentCard, StretcherMobilityCard, IsolationPrecautionsCard, BehavioralHealthCard, PatientInfoCard (race/ethnicity/sex/gender), SignaturesCard (signature type), NarrativeCard (disposition).
- `src/lib/pcr-dropdowns.ts` legacy exports (OXYGEN_DELIVERY, LEVEL_OF_CONSCIOUSNESS, SKIN_CONDITIONS, WOUND_TYPES, PRESSURE_ULCER_STAGES, MEDICAL_NECESSITY_REASONS) stay in place until their consuming cards migrate.