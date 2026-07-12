/**
 * NEMSIS v3.5.1 eRecord XML exporter — Phase 6.
 *
 * Pure function: given a `trip_records` row + related agency/personnel/vehicle
 * context, return a NEMSIS 3.5.1 XML string suitable for:
 *   - file-download (StateDataSet / DEMDataSet outer envelope), and
 *   - Web Service POST (single eRecord fragment).
 *
 * IMPORTANT — this exporter is READ-ONLY on the billing pipeline. It never
 * touches `claim_records`, never mutates trip_records, and never reads a
 * `_code` column that doesn't already exist. It maps DISPLAY values from
 * the PCR through the Phase 1 code sets to NEMSIS codes at emit time.
 *
 * State-specific eCustom blocks live under `src/lib/nemsis/states/<st>.ts`
 * so adding AL/FL/SC/TN/NC is one new file, not a rewrite here.
 */

import {
  E_AIRWAY_STATUS,
  E_AIRWAY_INTERVENTIONS,
  E_OXYGEN_DELIVERY,
  E_LEVEL_OF_CONSCIOUSNESS,
  E_SKIN_ASSESSMENT,
  E_MEDICATION_ROUTE,
  E_MEDICATION_RESPONSE,
  E_PATIENT_SEX,
  E_PULSE_QUALITY,
  E_RESPIRATORY_EFFORT,
  E_ETCO2_METHOD,
  E_PROCEDURES_PERFORMED,
  E_PROCEDURE_RESPONSE,
  E_DISPOSITION,
  E_DESTINATION_TYPE,
  type NemsisCode,
} from "@/lib/nemsis-code-sets";
import { toCode } from "@/lib/nemsis-translate";
import { findByCode, findByDisplay } from "@/lib/nemsis-code-sets";
import { el, wrap, xmlEscape } from "./xml-utils";
import { renderGeorgiaCustom } from "./states/ga";

export interface NemsisAgency {
  npi: string | null;
  name: string;
  state_ems_agency_number: string | null;
  state_ems_license_state: string | null;
}

export interface NemsisPersonnel {
  crew_member_id: string;
  full_name: string;
  state_license_number: string | null;    // maps dPersonnel.LicenseIDNumber
  certification_level: string | null;      // e.g. EMT-B, Paramedic
}

export interface NemsisVehicle {
  vehicle_id: string;
  unit_number: string | null;
  vin: string | null;
  license_plate: string | null;
}

export interface ExportContext {
  agency: NemsisAgency;
  vehicle: NemsisVehicle | null;
  personnel: NemsisPersonnel[];
  /** ISO-3166-2 state code (e.g. "GA"). Drives eCustom + endpoint routing. */
  state: string;
  /** True when running against NEMSIS TAC test harness — routed to sandbox. */
  test_mode: boolean;
  /** Software vendor identity — Pod Dispatch. */
  software: {
    name: string;      // "Pod Dispatch"
    version: string;   // semver of the running build
  };
}

/** NEMSIS namespaces required on the root envelope. */
const NEMSIS_NS = 'xmlns="http://www.nemsis.org" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';

/** Convert a stored display value to NEMSIS code, defaulting to
 *  "not-recorded" (NV=7701003) when the field is empty. */
function codeOrNil(codeSet: readonly NemsisCode[], stored: unknown): string | null {
  if (stored == null || stored === "") return null;
  const s = String(stored);
  // Prefer canonical NEMSIS numeric codes over legacy display-aliases so
  // e.g. patient_sex "M" resolves to 9906003, not the M/F/U alias code.
  const byDisplay = findByDisplay(codeSet, s);
  if (byDisplay && /^\d+$/.test(byDisplay.code)) return byDisplay.code;
  const byCode = findByCode(codeSet, s);
  if (byCode) {
    if (/^\d+$/.test(byCode.code)) return byCode.code;
    // Alias hit — try to promote to the numeric canonical via display.
    const promoted = findByDisplay(codeSet, byCode.display);
    if (promoted && /^\d+$/.test(promoted.code)) return promoted.code;
    return byCode.code;
  }
  return toCode(codeSet, s);
}

function renderTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  // NEMSIS uses ISO-8601 with timezone; Postgres timestamptz already qualifies.
  return iso;
}

// ─────────────────────────────────────────────────────────────────────
// Section renderers
// ─────────────────────────────────────────────────────────────────────

function renderHeader(ctx: ExportContext, tripId: string): string {
  // <eRecord> is a single section (record ID + software identity) — it is
  // a SIBLING of eResponse/eDispatch/eTimes/... inside PatientCareReport,
  // not a wrapper around them.
  return wrap("eRecord", null,
    el("eRecord.01", null, tripId) +
    wrap("eRecord.SoftwareApplicationGroup", null,
      el("eRecord.02", null, ctx.software.name) +
      el("eRecord.03", null, ctx.software.name) +
      el("eRecord.04", null, ctx.software.version),
    ),
  );
}

function renderResponse(trip: Record<string, unknown>): string {
  const parts: string[] = [];
  // Agency identity — NEMSIS requires the AgencyGroup wrapper (eResponse.01/.02)
  parts.push(wrap("eResponse.AgencyGroup", null,
    el("eResponse.01", null, String(trip.company_id ?? "")) +
    el("eResponse.02", null, String(trip.company_name ?? "")),
  ));
  // Service level lives in ServiceGroup wrapper (eResponse.05)
  parts.push(wrap("eResponse.ServiceGroup", null,
    el("eResponse.05", null, trip.service_level ? String(trip.service_level) : null),
  ));
  // Response IDs / times / unit
  parts.push(el("eResponse.03", null, trip.incident_number as string ?? null));
  parts.push(el("eResponse.04", null, trip.run_number as string ?? null));
  parts.push(el("eResponse.13", null, trip.unit_number as string ?? null));
  parts.push(el("eResponse.14", null, trip.shift as string ?? null));
  return wrap("eResponse", null, parts.join(""));
}

function renderTimes(trip: Record<string, unknown>): string {
  const parts: string[] = [];
  parts.push(el("eTimes.01", null, renderTime(trip.psap_call_time as string)));
  parts.push(el("eTimes.02", null, renderTime(trip.dispatch_notified_time as string)));
  parts.push(el("eTimes.03", null, renderTime(trip.dispatch_time as string)));
  parts.push(el("eTimes.04", null, renderTime(trip.unit_enroute_time as string)));
  parts.push(el("eTimes.05", null, renderTime(trip.unit_arrived_on_scene_time as string) ?? renderTime(trip.at_scene_time as string)));
  parts.push(el("eTimes.06", null, renderTime(trip.at_scene_time as string)));
  parts.push(el("eTimes.07", null, renderTime(trip.patient_contact_time as string)));
  parts.push(el("eTimes.08", null, renderTime(trip.arrived_at_patient_time as string)));
  parts.push(el("eTimes.09", null, renderTime(trip.left_scene_time as string)));
  parts.push(el("eTimes.10", null, renderTime(trip.arrived_at_destination_time as string)));
  parts.push(el("eTimes.11", null, renderTime(trip.in_service_time as string)));
  parts.push(el("eTimes.12", null, renderTime(trip.back_in_service_time as string)));
  parts.push(el("eTimes.13", null, renderTime(trip.canceled_time as string)));
  return wrap("eTimes", null, parts.join(""));
}

function renderPatient(trip: Record<string, unknown>, patient: Record<string, unknown> | null): string {
  if (!patient) return el("ePatient", null, null);
  const parts: string[] = [];
  parts.push(el("ePatient.NameGroup",
    null,
    el("ePatient.02", null, String(patient.last_name ?? "")) +
    el("ePatient.03", null, String(patient.first_name ?? "")),
  ));
  parts.push(el("ePatient.13", null, codeOrNil(E_PATIENT_SEX, patient.gender ?? patient.patient_sex)));
  parts.push(el("ePatient.14", null, patient.date_of_birth ? String(patient.date_of_birth) : null));
  return wrap("ePatient", null, parts.join(""));
}

function renderVitals(trip: Record<string, unknown>): string {
  const sets = Array.isArray(trip.vitals_json) ? trip.vitals_json : [];
  if (sets.length === 0) return el("eVitals", null, null);
  const rendered = sets.map((vs: Record<string, unknown>) => {
    const parts: string[] = [];
    if (vs.timestamp) parts.push(el("eVitals.01", null, String(vs.timestamp)));
    if (vs.bp_systolic)   parts.push(el("eVitals.06", null, String(vs.bp_systolic)));
    if (vs.bp_diastolic)  parts.push(el("eVitals.07", null, String(vs.bp_diastolic)));
    if (vs.pulse)         parts.push(el("eVitals.10", null, String(vs.pulse)));
    if (vs.pulse_quality) parts.push(el("eVitals.11", null, codeOrNil(E_PULSE_QUALITY, vs.pulse_quality)));
    if (vs.respiratory_rate)    parts.push(el("eVitals.14", null, String(vs.respiratory_rate)));
    if (vs.respiratory_quality) parts.push(el("eVitals.15", null, codeOrNil(E_RESPIRATORY_EFFORT, vs.respiratory_quality)));
    if (vs.spo2)          parts.push(el("eVitals.12", null, String(vs.spo2)));
    if (vs.etco2_value)   parts.push(el("eVitals.16", null, String(vs.etco2_value)));
    if (vs.etco2_method)  parts.push(el("eVitals.17", null, codeOrNil(E_ETCO2_METHOD, vs.etco2_method)));
    if (vs.temperature)   parts.push(el("eVitals.24", null, String(vs.temperature)));
    if (vs.blood_glucose) parts.push(el("eVitals.18", null, String(vs.blood_glucose)));
    if (vs.pain_scale)    parts.push(el("eVitals.27", null, String(vs.pain_scale)));
    if (vs.gcs_eyes)   parts.push(el("eVitals.19", null, String(vs.gcs_eyes)));
    if (vs.gcs_verbal) parts.push(el("eVitals.20", null, String(vs.gcs_verbal)));
    if (vs.gcs_motor)  parts.push(el("eVitals.21", null, String(vs.gcs_motor)));
    return wrap("eVitals.VitalGroup", null, parts.join(""));
  }).join("");
  return wrap("eVitals", null, rendered);
}

function renderAirway(trip: Record<string, unknown>): string {
  const airway = (trip.airway_json ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  parts.push(el("eAirway.02", null, codeOrNil(E_AIRWAY_STATUS, airway.status)));
  const interventions = Array.isArray(airway.interventions) ? airway.interventions : [];
  for (const intv of interventions) {
    parts.push(el("eAirway.03", null, codeOrNil(E_AIRWAY_INTERVENTIONS, intv)));
  }
  if (airway.oxygen_delivery) {
    parts.push(el("eVitals.02", null, codeOrNil(E_OXYGEN_DELIVERY, airway.oxygen_delivery)));
  }
  return wrap("eAirway", null, parts.join(""));
}

function renderMedications(trip: Record<string, unknown>): string {
  const data = (trip.medications_json ?? {}) as Record<string, unknown>;
  const entries = Array.isArray(data.entries) ? data.entries : [];
  if (data.none_administered || entries.length === 0) {
    return wrap("eMedications", null,
      el("eMedications.03", null, "8801019") /* None administered */,
    );
  }
  const rendered = entries.map((e: Record<string, unknown>) => {
    const parts: string[] = [];
    parts.push(el("eMedications.03", null, String(e.name ?? "")));
    parts.push(el("eMedications.05", null, String(e.dose ?? "")));
    parts.push(el("eMedications.05_unit", null, String(e.dose_unit ?? "")));
    parts.push(el("eMedications.06", null, codeOrNil(E_MEDICATION_ROUTE, e.route)));
    parts.push(el("eMedications.10", null, codeOrNil(E_MEDICATION_RESPONSE, e.effect)));
    if (e.time) parts.push(el("eMedications.02", null, String(e.time)));
    return wrap("eMedications.MedicationGroup", null, parts.join(""));
  }).join("");
  return wrap("eMedications", null, rendered);
}

function renderProcedures(trip: Record<string, unknown>): string {
  const data = (trip.procedures_json ?? {}) as Record<string, unknown>;
  const performed = Array.isArray(data.performed) ? data.performed : [];
  if (performed.length === 0) return el("eProcedures", null, null);
  const rendered = performed.map((p: unknown) => {
    const parts: string[] = [];
    parts.push(el("eProcedures.03", null, codeOrNil(E_PROCEDURES_PERFORMED, p)));
    if (data.patient_response) {
      parts.push(el("eProcedures.06", null, codeOrNil(E_PROCEDURE_RESPONSE, data.patient_response)));
    }
    return wrap("eProcedures.ProcedureGroup", null, parts.join(""));
  }).join("");
  return wrap("eProcedures", null, rendered);
}

function renderExam(trip: Record<string, unknown>): string {
  const parts: string[] = [];
  // Chief complaint belongs in eSituation, not eExam — moved to renderSituation.
  parts.push(el("eExam.01", null, renderTime(trip.exam_time as string ?? trip.patient_contact_time as string)));
  if (trip.level_of_consciousness) {
    parts.push(el("eExam.11", null, codeOrNil(E_LEVEL_OF_CONSCIOUSNESS, trip.level_of_consciousness)));
  }
  if (trip.skin_condition) {
    parts.push(el("eExam.13", null, codeOrNil(E_SKIN_ASSESSMENT, trip.skin_condition)));
  }
  return wrap("eExam", null, parts.join(""));
}

function renderDispatch(trip: Record<string, unknown>): string {
  // eDispatch.01 — complaint reported by dispatch (code)
  // eDispatch.02 — EMD performed (nil="not applicable" for non-emergency IFT)
  const parts: string[] = [];
  parts.push(el("eDispatch.01", null, trip.dispatch_complaint as string ?? null));
  parts.push(`<eDispatch.02 xsi:nil="true" NV="7701001"/>`);
  return wrap("eDispatch", null, parts.join(""));
}

function renderCrew(personnel: NemsisPersonnel[]): string {
  if (personnel.length === 0) {
    return wrap("eCrew", null,
      wrap("eCrew.CrewGroup", null,
        el("eCrew.01", null, null) +
        el("eCrew.02", null, null) +
        el("eCrew.03", null, null),
      ),
    );
  }
  const groups = personnel.map((p, i) => {
    const primary = i === 0 ? "9925001" /* Primary Patient Caregiver */ : "9925003" /* Other */;
    return wrap("eCrew.CrewGroup", null,
      el("eCrew.01", null, p.crew_member_id) +
      el("eCrew.02", null, p.certification_level) +
      el("eCrew.03", null, primary),
    );
  }).join("");
  return wrap("eCrew", null, groups);
}

function renderScene(trip: Record<string, unknown>): string {
  const parts: string[] = [];
  // eScene.06 — number of patients at scene
  parts.push(el("eScene.06", null, trip.patients_at_scene ? String(trip.patients_at_scene) : "1"));
  // eScene.07 — mass casualty incident (nil=NA for routine IFT)
  parts.push(`<eScene.07 xsi:nil="true" NV="7701001"/>`);
  // eScene.09 — incident address street
  parts.push(el("eScene.09", null, trip.scene_address as string ?? trip.pickup_address as string ?? null));
  // eScene.13 — incident city, .15 state, .17 zip, .19 county
  parts.push(el("eScene.13", null, trip.scene_city as string ?? trip.pickup_city as string ?? null));
  parts.push(el("eScene.15", null, trip.scene_state as string ?? trip.pickup_state as string ?? null));
  parts.push(el("eScene.17", null, trip.scene_zip as string ?? trip.pickup_zip as string ?? null));
  parts.push(el("eScene.19", null, trip.scene_county as string ?? null));
  parts.push(el("eScene.21", null, trip.scene_country as string ?? "US"));
  return wrap("eScene", null, parts.join(""));
}

function renderSituation(trip: Record<string, unknown>): string {
  const parts: string[] = [];
  // eSituation.02 — date/time symptom onset (nil=not applicable for IFT)
  parts.push(`<eSituation.02 xsi:nil="true" NV="7701001"/>`);
  // eSituation.07 — possible injury indicator
  parts.push(el("eSituation.07", null, trip.possible_injury as string ?? "9922003" /* No */));
  // eSituation.09 — complaint reported by dispatch (patient-side)
  parts.push(el("eSituation.09", null, trip.dispatch_complaint as string ?? null));
  // eSituation.10 — chief complaint anatomic location (nil if unknown)
  parts.push(`<eSituation.10 xsi:nil="true" NV="7701003"/>`);
  // eSituation.11 — primary complaint statement (free text)
  parts.push(el("eSituation.11", null, trip.chief_complaint as string ?? null));
  // eSituation.12 — duration of complaint
  parts.push(`<eSituation.12 xsi:nil="true" NV="7701003"/>`);
  // eSituation.13 — time units for duration
  parts.push(`<eSituation.13 xsi:nil="true" NV="7701003"/>`);
  // eSituation.18 — initial patient acuity
  parts.push(el("eSituation.18", null, trip.patient_acuity as string ?? "2318003" /* Lower Acuity */));
  return wrap("eSituation", null, parts.join(""));
}

function renderHistory(trip: Record<string, unknown>): string {
  // eHistory carries advance directives, medical/surgical history, allergies.
  // For a minimal IFT record we emit "not recorded" placeholders for the
  // required elements plus any real data we happen to have on trip.
  const parts: string[] = [];
  // eHistory.06 — barriers to care (nil=none for routine)
  parts.push(el("eHistory.06", null, "3505001" /* None */));
  // eHistory.08 — medical/surgical history (repeatable, use "None reported")
  parts.push(el("eHistory.08", null, trip.medical_history as string ?? "3108001" /* None reported */));
  // eHistory.12 — medication allergies (repeatable)
  parts.push(el("eHistory.12", null, trip.allergies as string ?? "3112001" /* NKA */));
  // eHistory.13 — environmental/food allergies
  parts.push(el("eHistory.13", null, "3113001" /* NKA */));
  return wrap("eHistory", null, parts.join(""));
}

function renderDisposition(trip: Record<string, unknown>): string {
  const parts: string[] = [];
  // eDisposition.01 — destination/transferred to name
  parts.push(el("eDisposition.01", null, trip.destination_name as string ?? null));
  // eDisposition.02 — destination street address
  parts.push(el("eDisposition.02", null, trip.destination_address as string ?? null));
  // eDisposition.05 — destination city, .07 state, .09 zip, .11 country
  parts.push(el("eDisposition.05", null, trip.destination_city as string ?? null));
  parts.push(el("eDisposition.07", null, trip.destination_state as string ?? null));
  parts.push(el("eDisposition.09", null, trip.destination_zip as string ?? null));
  parts.push(el("eDisposition.11", null, trip.destination_country as string ?? "US"));
  // eDisposition.12 — incident/patient disposition (existing behavior)
  parts.push(el("eDisposition.12", null, codeOrNil(E_DISPOSITION, trip.disposition)));
  // eDisposition.16 — level of care of this unit
  parts.push(el("eDisposition.16", null, trip.level_of_care as string ?? null));
  // eDisposition.17 — patient evaluation/care category
  parts.push(el("eDisposition.17", null, trip.evaluation_care as string ?? null));
  // eDisposition.19 — transport disposition
  parts.push(el("eDisposition.19", null, codeOrNil(E_DISPOSITION, trip.disposition)));
  // eDisposition.20 — reason for choosing destination (nil=NA if unknown)
  parts.push(`<eDisposition.20 xsi:nil="true" NV="7701003"/>`);
  // eDisposition.21 — type of destination
  parts.push(el("eDisposition.21", null, codeOrNil(E_DESTINATION_TYPE, trip.destination_type)));
  // eDisposition.23 — transport mode from scene
  parts.push(el("eDisposition.23", null, trip.transport_mode as string ?? "4523003" /* Ground */));
  // eDisposition.27 — condition of patient at destination
  parts.push(el("eDisposition.27", null, trip.patient_condition_at_destination as string ?? null));
  // eDisposition.28 — transferred patient care to
  parts.push(el("eDisposition.28", null, trip.transferred_care_to as string ?? null));
  return wrap("eDisposition", null, parts.join(""));
}

function renderNarrative(trip: Record<string, unknown>): string {
  return wrap("eNarrative", null,
    el("eNarrative.01", null, trip.narrative ? String(trip.narrative) : null),
  );
}

function renderDemographicGroup(agency: NemsisAgency): string {
  // Header/DemographicGroup uses a subset of dAgency elements with narrower
  // typing than the full dAgency block:
  //   dAgency.01 — state agency number (numeric)
  //   dAgency.02 — state-issued license identifier
  //   dAgency.04 — ANSI state code, 2-digit numeric (e.g. GA=13)
  const parts: string[] = [];
  parts.push(el("dAgency.01", null, agency.state_ems_agency_number));
  parts.push(el("dAgency.02", null, agency.state_ems_agency_number));
  parts.push(el("dAgency.04", null, stateAnsiCode(agency.state_ems_license_state)));
  return wrap("DemographicGroup", null, parts.join(""));
}

/** Convert a USPS state abbreviation to its 2-digit ANSI FIPS code, which is
 *  what NEMSIS Header/DemographicGroup/dAgency.04 expects (pattern `[0-9]{2}`).
 *  Only US states + DC + territories that Pod Dispatch touches are wired. */
function stateAnsiCode(usps: string | null | undefined): string | null {
  if (!usps) return null;
  const map: Record<string, string> = {
    AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09",
    DE: "10", DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17",
    IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24",
    MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31",
    NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38",
    OH: "39", OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46",
    TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54",
    WI: "55", WY: "56", PR: "72", VI: "78",
  };
  return map[usps.toUpperCase()] ?? null;
}

function renderAgency(agency: NemsisAgency): string {
  // Full dAgency block for DEMDataSet submissions.
  const parts: string[] = [];
  parts.push(el("dAgency.01", null, agency.state_ems_license_state));
  parts.push(el("dAgency.02", null, agency.state_ems_agency_number));
  parts.push(el("dAgency.03", null, agency.name));
  parts.push(el("dAgency.04", null, agency.npi));
  return wrap("dAgency", null, parts.join(""));
}

function renderDRecord(ctx: ExportContext): string {
  return wrap("dRecord", null,
    wrap("dRecord.SoftwareApplicationGroup", null,
      el("dRecord.01", null, ctx.software.name) +
      el("dRecord.02", null, ctx.software.name) +
      el("dRecord.03", null, ctx.software.version),
    ),
  );
}

function renderPersonnel(personnel: NemsisPersonnel[]): string {
  if (personnel.length === 0) return el("dPersonnel", null, null);
  const rendered = personnel.map((p) => {
    const parts: string[] = [];
    parts.push(el("dPersonnel.01", null, p.crew_member_id));
    parts.push(el("dPersonnel.NameGroup", null, el("dPersonnel.02", null, p.full_name)));
    parts.push(el("dPersonnel.LicenseIDNumber", null, p.state_license_number));
    parts.push(el("dPersonnel.LevelOfCertification", null, p.certification_level));
    return wrap("dPersonnel.PersonnelGroup", null, parts.join(""));
  }).join("");
  return wrap("dPersonnel", null, rendered);
}

function renderVehicle(vehicle: NemsisVehicle | null): string {
  if (!vehicle) return el("dVehicle", null, null);
  const parts: string[] = [];
  parts.push(el("dVehicle.01", null, vehicle.vehicle_id));
  parts.push(el("dVehicle.02", null, vehicle.unit_number));
  parts.push(el("dVehicle.03", null, vehicle.vin));
  parts.push(el("dVehicle.04", null, vehicle.license_plate));
  return wrap("dVehicle", null, parts.join(""));
}

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

export interface PcrExportInput {
  trip: Record<string, unknown>;
  patient: Record<string, unknown> | null;
}

/** Produce a single-eRecord NEMSIS 3.5.1 XML string (Web Service payload). */
export function buildERecord(input: PcrExportInput, ctx: ExportContext): string {
  const { trip, patient } = input;
  const tripId = String(trip.id ?? "");

  const body = [
    renderHeader(ctx, tripId),
    renderResponse(trip),
    renderDispatch(trip),
    renderCrew(ctx.personnel),
    renderTimes(trip),
    renderPatient(trip, patient),
    renderScene(trip),
    renderSituation(trip),
    renderHistory(trip),
    renderNarrative(trip),
    renderVitals(trip),
    renderExam(trip),
    renderAirway(trip),
    renderMedications(trip),
    renderProcedures(trip),
    renderDisposition(trip),
  ].join("");

  // State-specific eCustom block, isolated per-state.
  const custom = ctx.state === "GA" ? renderGeorgiaCustom(trip, ctx) : "";

  // Returns the ordered sibling sections that go inside <PatientCareReport>.
  // (The name buildERecord is historical — kept for API stability.)
  return body + custom;
}

/** Generate a v4 UUID suitable for PatientCareReport/@UUID. */
function uuidv4(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback — deterministic-shape v4 (not crypto-strong).
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
  return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h.slice(6, 8).join("")}-${h.slice(8, 10).join("")}-${h.slice(10, 16).join("")}`;
}

/** Produce a DEMDataSet envelope wrapping agency/personnel/vehicle context. */
export function buildDemDataSet(ctx: ExportContext): string {
  const demoBody =
    renderDRecord(ctx) +
    renderAgency(ctx.agency) +
    renderPersonnel(ctx.personnel) +
    renderVehicle(ctx.vehicle);
  const timeStamp = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<DEMDataSet ${NEMSIS_NS}>` +
    `<DemographicReport timeStamp="${timeStamp}">${demoBody}</DemographicReport>` +
    `</DEMDataSet>`;
}

/** Produce a full EMSDataSet envelope: Header/DemographicGroup + one
 *  PatientCareReport containing the eRecord. This is the shape the NEMSIS
 *  Compliance Testing web service (and the TAC pre-testing tools) expect
 *  for both file-upload and Web Service POST submissions. */
export function buildEmsDataSet(input: PcrExportInput, ctx: ExportContext): string {
  const eRecord = buildERecord(input, ctx);
  const pcrUuid = uuidv4();
  const pcr = `<PatientCareReport UUID="${pcrUuid}">${eRecord}</PatientCareReport>`;
  // NEMSIS 3.5.1: PatientCareReport lives INSIDE Header, after DemographicGroup.
  const header = wrap("Header", null, renderDemographicGroup(ctx.agency) + pcr);
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<EMSDataSet ${NEMSIS_NS}` +
    ` xsi:schemaLocation="http://www.nemsis.org https://nemsis.org/media/nemsis_v3/3.5.1.251001CP2/XSDs/NEMSIS_XSDs/EMSDataSet_v3.xsd">` +
    `${header}` +
    `</EMSDataSet>`;
}

/** @deprecated Use buildEmsDataSet — StateDataSet is a config/reporting
 *  envelope in NEMSIS, not a PCR carrier. Kept as an alias for one release
 *  so callers don't break, but forwards to buildEmsDataSet. */
export const buildStateDataSet = buildEmsDataSet;

// Re-export for callers that want to render just the custom block.
export { renderGeorgiaCustom };
// xmlEscape re-export lets tests assert escaping without touching internals.
export { xmlEscape };