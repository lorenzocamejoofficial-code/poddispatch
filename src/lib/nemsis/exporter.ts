/**
 * NEMSIS v3.5.0 eRecord XML exporter — Phase 6.
 *
 * Pure function: given a `trip_records` row + related agency/personnel/vehicle
 * context, return a NEMSIS 3.5.0 XML string suitable for:
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
  return toCode(codeSet, String(stored));
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
  const parts: string[] = [];
  parts.push(el("eRecord.01", null, tripId));
  parts.push(el("eRecord.SoftwareName", null, ctx.software.name));
  parts.push(el("eRecord.SoftwareVersion", null, ctx.software.version));
  return wrap("eRecord.RecordHeader", null, parts.join(""));
}

function renderResponse(trip: Record<string, unknown>): string {
  const parts: string[] = [];
  // eResponse.05 — response mode (BLS/ALS + emergency flag lives in transport level)
  // eResponse.14 — additional response mode not recorded here yet
  parts.push(el("eResponse.01", null, String(trip.company_id ?? "")));
  return wrap("eResponse", null, parts.join(""));
}

function renderTimes(trip: Record<string, unknown>): string {
  const parts: string[] = [];
  parts.push(el("eTimes.03", null, renderTime(trip.dispatch_time as string)));
  parts.push(el("eTimes.06", null, renderTime(trip.at_scene_time as string)));
  parts.push(el("eTimes.07", null, renderTime(trip.patient_contact_time as string)));
  parts.push(el("eTimes.09", null, renderTime(trip.left_scene_time as string)));
  parts.push(el("eTimes.11", null, renderTime(trip.in_service_time as string)));
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
  if (trip.chief_complaint) parts.push(el("eSituation.11", null, String(trip.chief_complaint)));
  if (trip.level_of_consciousness) {
    parts.push(el("eExam.11", null, codeOrNil(E_LEVEL_OF_CONSCIOUSNESS, trip.level_of_consciousness)));
  }
  if (trip.skin_condition) {
    parts.push(el("eExam.13", null, codeOrNil(E_SKIN_ASSESSMENT, trip.skin_condition)));
  }
  return wrap("eExam", null, parts.join(""));
}

function renderDisposition(trip: Record<string, unknown>): string {
  const parts: string[] = [];
  parts.push(el("eDisposition.12", null, codeOrNil(E_DISPOSITION, trip.disposition)));
  return wrap("eDisposition", null, parts.join(""));
}

function renderNarrative(trip: Record<string, unknown>): string {
  return wrap("eNarrative", null,
    el("eNarrative.01", null, trip.narrative ? String(trip.narrative) : null),
  );
}

function renderAgency(agency: NemsisAgency): string {
  const parts: string[] = [];
  parts.push(el("dAgency.01", null, agency.state_ems_license_state));
  parts.push(el("dAgency.02", null, agency.state_ems_agency_number));
  parts.push(el("dAgency.03", null, agency.name));
  parts.push(el("dAgency.04", null, agency.npi));
  return wrap("dAgency.AgencyGroup", null, parts.join(""));
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

/** Produce a single-eRecord NEMSIS 3.5.0 XML string (Web Service payload). */
export function buildERecord(input: PcrExportInput, ctx: ExportContext): string {
  const { trip, patient } = input;
  const tripId = String(trip.id ?? "");

  const body = [
    renderHeader(ctx, tripId),
    renderResponse(trip),
    renderTimes(trip),
    renderPatient(trip, patient),
    renderExam(trip),
    renderVitals(trip),
    renderAirway(trip),
    renderMedications(trip),
    renderProcedures(trip),
    renderDisposition(trip),
    renderNarrative(trip),
  ].join("");

  // State-specific eCustom block, isolated per-state.
  const custom = ctx.state === "GA" ? renderGeorgiaCustom(trip, ctx) : "";

  return wrap("eRecord", { [NEMSIS_NS.split("=")[0]]: undefined }, body + custom);
}

/** Produce a DEMDataSet envelope wrapping agency/personnel/vehicle context. */
export function buildDemDataSet(ctx: ExportContext): string {
  const body =
    renderAgency(ctx.agency) +
    renderPersonnel(ctx.personnel) +
    renderVehicle(ctx.vehicle);
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<DEMDataSet ${NEMSIS_NS}>${body}</DEMDataSet>`;
}

/** Produce a full StateDataSet envelope: dem + one eRecord for the trip.
 *  Used for the file-download submission format. */
export function buildStateDataSet(input: PcrExportInput, ctx: ExportContext): string {
  const eRecord = buildERecord(input, ctx);
  const dem =
    renderAgency(ctx.agency) +
    renderPersonnel(ctx.personnel) +
    renderVehicle(ctx.vehicle);
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<StateDataSet ${NEMSIS_NS} testMode="${ctx.test_mode ? "true" : "false"}">` +
    `<Header>${dem}</Header>` +
    `<PatientCareReport>${eRecord}</PatientCareReport>` +
    `</StateDataSet>`;
}

// Re-export for callers that want to render just the custom block.
export { renderGeorgiaCustom };
// xmlEscape re-export lets tests assert escaping without touching internals.
export { xmlEscape };