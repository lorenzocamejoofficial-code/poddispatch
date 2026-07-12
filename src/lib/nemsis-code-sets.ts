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

// ─────────────────────────────────────────────────────────────────────
// eExam — Level of Consciousness & Skin
// ─────────────────────────────────────────────────────────────────────
//
// PCR cards write internal slugs (e.g. `alert_ox3`, `pale`) to the
// `level_of_consciousness` and `skin_condition` columns. Billing does NOT
// read these columns; only pcr-narrative reads them via slug→prose maps.
//
// These code sets map the slug (used as `code` here so lookups by the
// stored slug work with `findByCode`) → NEMSIS/SNOMED coded value that
// the future NEMSIS/GEMSIS export layer will emit. No card write change
// is required because slugs already round-trip; the exporter looks up the
// SNOMED code from `system` + a slug→SNOMED table it maintains separately
// (kept out of this file to avoid coupling the UI slug to a specific code).

/** eExam.11 — Level of Consciousness. `code` is the internal slug so
 *  `toDisplay(E_LEVEL_OF_CONSCIOUSNESS, trip.level_of_consciousness)` works
 *  today; a future export layer replaces `code` with the SNOMED value. */
export const E_LEVEL_OF_CONSCIOUSNESS: readonly NemsisCode[] = [
  { code: "alert_ox4",                display: "Alert and Oriented x4",              system: "NEMSIS" },
  { code: "alert_ox3",                display: "Alert and Oriented x3",              system: "NEMSIS" },
  { code: "alert_ox2",                display: "Alert and Oriented x2",              system: "NEMSIS" },
  { code: "alert_ox1",                display: "Alert and Oriented x1",              system: "NEMSIS" },
  { code: "baseline_self_only",       display: "Baseline cognitive impairment",      system: "NEMSIS" },
  { code: "non_verbal_baseline",      display: "Non-verbal at baseline",             system: "NEMSIS" },
  { code: "sedated",                  display: "Sedated",                            system: "NEMSIS" },
  { code: "sleeping_arousable",       display: "Sleeping but arousable",             system: "NEMSIS" },
  { code: "combative",                display: "Combative",                          system: "NEMSIS" },
  { code: "confused",                 display: "Confused",                           system: "NEMSIS" },
  { code: "verbal_only",              display: "Verbal Response Only",               system: "NEMSIS" },
  { code: "unresponsive_verbal_only", display: "Unresponsive to verbal stimuli only",system: "NEMSIS" },
  { code: "pain_only",                display: "Pain Response Only",                 system: "NEMSIS" },
  { code: "unresponsive",             display: "Unresponsive",                       system: "NEMSIS" },
] as const;

/** eExam.13 — Skin Assessment. Same slug-as-code convention as LOC above. */
export const E_SKIN_ASSESSMENT: readonly NemsisCode[] = [
  { code: "normal",                   display: "Normal (warm, dry, pink)",           system: "NEMSIS" },
  { code: "dry_intact",               display: "Dry, intact",                        system: "NEMSIS" },
  { code: "pale",                     display: "Pale",                               system: "NEMSIS" },
  { code: "cyanotic",                 display: "Cyanotic",                           system: "NEMSIS" },
  { code: "diaphoretic",              display: "Diaphoretic",                        system: "NEMSIS" },
  { code: "flushed",                  display: "Flushed",                            system: "NEMSIS" },
  { code: "mottled",                  display: "Mottled",                            system: "NEMSIS" },
  { code: "jaundiced",                display: "Jaundiced",                          system: "NEMSIS" },
  { code: "cool_dry",                 display: "Cool and Dry",                       system: "NEMSIS" },
  { code: "hot_dry",                  display: "Hot and Dry",                        system: "NEMSIS" },
  { code: "fragile_tears",            display: "Fragile, tears noted",               system: "NEMSIS" },
  { code: "bruising",                 display: "Bruising present",                   system: "NEMSIS" },
  { code: "rash",                     display: "Rash",                               system: "NEMSIS" },
  { code: "edematous",                display: "Edematous",                          system: "NEMSIS" },
  { code: "surgical_dressing_intact", display: "Surgical site visible",              system: "NEMSIS" },
  { code: "tenting",                  display: "Tenting / poor turgor",              system: "NEMSIS" },
  { code: "petechiae",                display: "Petechiae",                          system: "NEMSIS" },
] as const;

// ─────────────────────────────────────────────────────────────────────
// eMedications — Route and Response
// ─────────────────────────────────────────────────────────────────────
// MedicationsCard stores route/effect as human labels; nothing in the
// billing pipeline reads medications_json. Registering these mappings lets
// the future NEMSIS export encode eMedications.06 (Route) and
// eMedications.10 (Response) without changing card writes.

/** eMedications.06 — Medication Route */
export const E_MEDICATION_ROUTE: readonly NemsisCode[] = [
  { code: "3006001", display: "IV",              system: "NEMSIS" },
  { code: "3006003", display: "IO",              system: "NEMSIS" },
  { code: "3006005", display: "IM",              system: "NEMSIS" },
  { code: "3006007", display: "SubQ",            system: "NEMSIS" },
  { code: "3006009", display: "PO (oral)",       system: "NEMSIS" },
  { code: "3006011", display: "SL (sublingual)", system: "NEMSIS" },
  { code: "3006013", display: "Intranasal",      system: "NEMSIS" },
  { code: "3006015", display: "Inhaled",         system: "NEMSIS" },
  { code: "3006017", display: "Topical",         system: "NEMSIS" },
  { code: "3006019", display: "ET tube",         system: "NEMSIS" },
  { code: "3006021", display: "Rectal",          system: "NEMSIS" },
] as const;

/** eMedications.10 — Medication Response */
export const E_MEDICATION_RESPONSE: readonly NemsisCode[] = [
  { code: "3010001", display: "Improved",  system: "NEMSIS" },
  { code: "3010003", display: "No change", system: "NEMSIS" },
  { code: "3010005", display: "Worsened",  system: "NEMSIS" },
  { code: "3010007", display: "Unknown",   system: "NEMSIS" },
] as const;

/**
 * ePatient.13 — Patient Gender.
 * The 837P generator normalizes patient_sex to M/F/U via dmgSexCode(), so those
 * three letters are the canonical stored values today. We register both the
 * NEMSIS codes and the M/F/U aliases so findByCode() and findByDisplay() both
 * resolve the value already sitting in claim_records.patient_sex.
 */
export const E_PATIENT_SEX: readonly NemsisCode[] = [
  { code: "9906001", display: "Female",  system: "NEMSIS" },
  { code: "9906003", display: "Male",    system: "NEMSIS" },
  { code: "9906005", display: "Newborn", system: "NEMSIS" },
  { code: "9906007", display: "Unknown", system: "NEMSIS" },
  // Aliases matching the M/F/U letters the 837P pipeline uses today.
  { code: "F", display: "Female",  system: "NEMSIS" },
  { code: "M", display: "Male",    system: "NEMSIS" },
  { code: "U", display: "Unknown", system: "NEMSIS" },
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
  level_of_consciousness: E_LEVEL_OF_CONSCIOUSNESS,
  skin_assessment:        E_SKIN_ASSESSMENT,
  medication_route:       E_MEDICATION_ROUTE,
  medication_response:    E_MEDICATION_RESPONSE,
  patient_sex:            E_PATIENT_SEX,
} as const;

export type NemsisCodeSetKey = keyof typeof NEMSIS_CODE_SETS;