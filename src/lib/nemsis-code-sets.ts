/**
 * NEMSIS v3.5.1 Code Sets — Phase 1 of GEMSIS/NEMSIS compliance alignment.
 *
 * Each entry stores { code, display, system } so the PCR persists BOTH the
 * human-readable label (for existing display code) AND the coded value
 * (required for future NEMSIS XSD export + GEMSIS Web Service submission).
 *
 * Sources:
 *   - NEMSIS v3.5.1 Data Dictionary (https://nemsis.org)
 *   - SNOMED CT via NEMSIS pick-list mappings
 *   - LOINC where noted
 *
 * Naming convention: E_<ELEMENT_NAME> mirrors the NEMSIS element (e.g. eAirway.02).
 * Phase 1a covers the elements used by AirwayCard (pilot). Phase 1b will extend
 * to Vitals, Medications, Procedures, Assessment, Disposition, etc.
 */

export type CodeSystem = "SNOMED-CT" | "NEMSIS" | "LOINC";

export interface NemsisCode {
  /** The coded value transmitted in NEMSIS XSD / Web Service payloads */
  code: string;
  /** The human-readable label shown in the PCR UI */
  display: string;
  /** The code system the `code` value belongs to */
  system: CodeSystem;
}

/** Helper: derive a shadcn <Select> option list from a code set. */
export const toOptions = (codes: readonly NemsisCode[]) =>
  codes.map((c) => ({ value: c.code, label: c.display }));

/** Helper: look up a code entry by its `code` value. */
export const findByCode = (codes: readonly NemsisCode[], code: string | null | undefined) =>
  code ? codes.find((c) => c.code === code) ?? null : null;

/** Helper: look up a code entry by legacy free-text display (for backfill). */
export const findByDisplay = (codes: readonly NemsisCode[], display: string | null | undefined) => {
  if (!display) return null;
  const norm = display.trim().toLowerCase();
  return codes.find((c) => c.display.trim().toLowerCase() === norm) ?? null;
};

// ─────────────────────────────────────────────────────────────────────
// eAirway — Airway management elements
// ─────────────────────────────────────────────────────────────────────

/** eAirway.02 — Airway indications for advanced airway management (subset used in UI) */
export const E_AIRWAY_STATUS: readonly NemsisCode[] = [
  { code: "3005001", display: "Patent and self-maintained",    system: "NEMSIS"    },
  { code: "272679005", display: "Snoring respirations",        system: "SNOMED-CT" },
  { code: "70143000", display: "Gurgling respirations",        system: "SNOMED-CT" },
  { code: "70172004", display: "Stridor present",              system: "SNOMED-CT" },
  { code: "271597004", display: "Apneic",                      system: "SNOMED-CT" },
  { code: "301282008", display: "Obstructed",                  system: "SNOMED-CT" },
] as const;

/** eAirway.03 — Airway devices / interventions performed */
export const E_AIRWAY_INTERVENTIONS: readonly NemsisCode[] = [
  { code: "3003001", display: "None required",                              system: "NEMSIS"    },
  { code: "371911009", display: "Repositioning and airway opening maneuver", system: "SNOMED-CT" },
  { code: "51779000",  display: "Oral airway adjunct (OPA)",                system: "SNOMED-CT" },
  { code: "40617009",  display: "Nasal airway adjunct (NPA)",               system: "SNOMED-CT" },
  { code: "371907003", display: "Bag valve mask ventilation",               system: "SNOMED-CT" },
  { code: "281611007", display: "Suction performed",                        system: "SNOMED-CT" },
  { code: "428361000124107", display: "CPAP applied",                       system: "SNOMED-CT" },
  { code: "426096001", display: "King airway inserted",                     system: "SNOMED-CT" },
  { code: "112798008", display: "Endotracheal intubation",                  system: "SNOMED-CT" },
] as const;

/** eAirway suction device types (agency pick list, mapped to NEMSIS suggested list) */
export const E_SUCTION_TYPE: readonly NemsisCode[] = [
  { code: "9990001", display: "Bulb",     system: "NEMSIS" },
  { code: "9990002", display: "Yankauer", system: "NEMSIS" },
  { code: "9990003", display: "In-line",  system: "NEMSIS" },
] as const;

/** eAirway.19 — Confirmation methods for advanced airway placement */
export const E_AIRWAY_CONFIRMATION: readonly NemsisCode[] = [
  { code: "9995001", display: "Bilateral breath sounds",       system: "NEMSIS" },
  { code: "9995002", display: "Waveform capnography",          system: "NEMSIS" },
  { code: "9995003", display: "Colorimetric CO2 detector",     system: "NEMSIS" },
  { code: "9995004", display: "Chest rise visualization",      system: "NEMSIS" },
] as const;

// ─────────────────────────────────────────────────────────────────────
// eVitals — Oxygen delivery (used by Airway + Vitals cards)
// ─────────────────────────────────────────────────────────────────────

/** eVitals oxygen delivery device — NEMSIS pick list */
export const E_OXYGEN_DELIVERY: readonly NemsisCode[] = [
  { code: "3406001", display: "None",                          system: "NEMSIS" },
  { code: "3406003", display: "Nasal cannula",                 system: "NEMSIS" },
  { code: "3406005", display: "Simple face mask",              system: "NEMSIS" },
  { code: "3406007", display: "Non-rebreather mask",           system: "NEMSIS" },
  { code: "3406009", display: "Venturi mask",                  system: "NEMSIS" },
  { code: "3406011", display: "Bag valve mask",                system: "NEMSIS" },
  { code: "3406013", display: "CPAP / BiPAP",                  system: "NEMSIS" },
  { code: "3406015", display: "Tracheostomy collar",           system: "NEMSIS" },
  { code: "3406017", display: "Ventilator (patient's own)",    system: "NEMSIS" },
] as const;

/**
 * Registry of all Phase 1a code sets — used by future backfill and export code.
 * Each key mirrors the NEMSIS element identifier where applicable.
 */
export const NEMSIS_CODE_SETS = {
  airway_status:         E_AIRWAY_STATUS,
  airway_interventions:  E_AIRWAY_INTERVENTIONS,
  suction_type:          E_SUCTION_TYPE,
  airway_confirmation:   E_AIRWAY_CONFIRMATION,
  oxygen_delivery:       E_OXYGEN_DELIVERY,
} as const;

export type NemsisCodeSetKey = keyof typeof NEMSIS_CODE_SETS;