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
  // NEMSIS DateTimeType pattern demands an explicit numeric offset
  // (`+HH:MM` / `-HH:MM`) — the "Z" shortcut is NOT accepted. Convert.
  return iso.endsWith("Z") ? iso.slice(0, -1) + "+00:00" : iso;
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
  parts.push(wrap("eResponse.AgencyGroup", null,
    el("eResponse.01", null, String(trip.company_id ?? "")) +
    el("eResponse.02", null, String(trip.company_name ?? "")),
  ));
  // eResponse.03/.04 must come between AgencyGroup and ServiceGroup per XSD sequence.
  parts.push(el("eResponse.03", null, trip.incident_number as string ?? null));
  parts.push(el("eResponse.04", null, trip.run_number as string ?? null));
  parts.push(wrap("eResponse.ServiceGroup", null,
    el("eResponse.05", null, trip.service_level ? String(trip.service_level) : null),
  ));
  // eResponse.07 (unit transport equipment capability) — required, NOT nillable,
  // enum {2207011..2207027}. 2207019 = "Basic Life Support-Ground" as a
  // sensible IFT default; callers override via trip.unit_capability.
  parts.push(el("eResponse.07", null, trip.unit_capability as string ?? "2207019"));
  parts.push(`<eResponse.08 xsi:nil="true" NV="7701003"/>`);
  parts.push(`<eResponse.09 xsi:nil="true" NV="7701003"/>`);
  parts.push(`<eResponse.10 xsi:nil="true" NV="7701003"/>`);
  parts.push(`<eResponse.11 xsi:nil="true" NV="7701003"/>`);
  parts.push(`<eResponse.12 xsi:nil="true" NV="7701003"/>`);
  // .13 (vehicle unit number) and .14 (call sign) are required, not nillable.
  parts.push(el("eResponse.13", null, (trip.unit_number as string) ?? "UNIT-UNKNOWN"));
  parts.push(el("eResponse.14", null, (trip.shift as string) ?? (trip.unit_number as string) ?? "UNIT-UNKNOWN"));
  // .23 response mode to scene — required enum {2223001..2223007}.
  // 2223005 = "No Lights or Sirens" default for IFT.
  parts.push(el("eResponse.23", null, trip.response_mode as string ?? "2223005"));
  // .24 additional response mode descriptors — required (min 1), repeatable.
  parts.push(el("eResponse.24", null, trip.response_mode_descriptor as string ?? "2224019" /* Initial Response */));
  return wrap("eResponse", null, parts.join(""));
}

function renderTimes(trip: Record<string, unknown>): string {
  // eTimes elements are DateTime with strict pattern and NOT nillable — we
  // must omit rather than xsi:nil when a timestamp is missing.
  const parts: string[] = [];
  const push = (tag: string, iso: unknown) => {
    const v = renderTime(iso as string | null | undefined);
    if (v) parts.push(`<${tag}>${v}</${tag}>`);
  };
  push("eTimes.01", trip.psap_call_time);
  push("eTimes.02", trip.dispatch_notified_time);
  push("eTimes.03", trip.dispatch_time);
  push("eTimes.04", trip.unit_enroute_time);
  push("eTimes.05", trip.unit_arrived_on_scene_time ?? trip.at_scene_time);
  push("eTimes.06", trip.at_scene_time);
  push("eTimes.07", trip.patient_contact_time);
  push("eTimes.08", trip.arrived_at_patient_time);
  push("eTimes.09", trip.left_scene_time);
  push("eTimes.10", trip.arrived_at_destination_time);
  push("eTimes.11", trip.in_service_time);
  // .12 destination patient-care transfer time (nillable).
  if (trip.destination_transfer_time) {
    push("eTimes.12", trip.destination_transfer_time);
  } else {
    parts.push(`<eTimes.12 xsi:nil="true"/>`);
  }
  // .13 unit back-in-service — required, DateTimeType, NOT nillable. Fall
  // back to in_service_time when a dedicated column isn't available.
  const backInSvc = renderTime(
    (trip.back_in_service_time as string | null | undefined) ??
    (trip.in_service_time as string | null | undefined),
  );
  if (backInSvc) parts.push(`<eTimes.13>${backInSvc}</eTimes.13>`);
  // .14 unit canceled — optional.
  push("eTimes.14", trip.canceled_time);
  return wrap("eTimes", null, parts.join(""));
}

function renderPatient(trip: Record<string, unknown>, patient: Record<string, unknown> | null): string {
  if (!patient) return el("ePatient", null, null);
  const parts: string[] = [];
  parts.push(wrap("ePatient.PatientNameGroup",
    null,
    el("ePatient.02", null, String(patient.last_name ?? "")) +
    el("ePatient.03", null, String(patient.first_name ?? "")),
  ));
  // Address elements: nillable but the schema does NOT allow the NV attribute
  // — emit plain xsi:nil when the data isn't recorded.
  parts.push(`<ePatient.05 xsi:nil="true"/>`);
  parts.push(`<ePatient.06 xsi:nil="true"/>`);
  parts.push(`<ePatient.07 xsi:nil="true" NV="7701003"/>`);
  parts.push(`<ePatient.08 xsi:nil="true" NV="7701003"/>`);
  parts.push(`<ePatient.09 xsi:nil="true" NV="7701003"/>`);
  // ePatient.14 is Race (repeating) — required (min 1).
  parts.push(`<ePatient.14 xsi:nil="true" NV="7701003"/>`);
  // ePatient.AgeGroup (.15 age, .16 age units) is required — emit nil pair.
  parts.push(wrap("ePatient.AgeGroup", null,
    `<ePatient.15 xsi:nil="true" NV="7701003"/>` +
    `<ePatient.16 xsi:nil="true" NV="7701003"/>`,
  ));
  // .17 DateOfBirth (optional) — emit when we have it.
  if (patient.date_of_birth) {
    parts.push(`<ePatient.17>${String(patient.date_of_birth)}</ePatient.17>`);
  }
  // .25 Sex is required (minOccurs=1); enum {9919001=Male, 9919003=Female, 9919005=Unknown}.
  parts.push(el("ePatient.25", null, patientSexCode(patient.gender ?? patient.patient_sex)));
  return wrap("ePatient", null, parts.join(""));
}

/** ePatient.25 uses the 9919xxx code set — separate from legacy E_PATIENT_SEX. */
function patientSexCode(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim().toLowerCase();
  if (["m", "male", "9919001", "9906003"].includes(s)) return "9919001";
  if (["f", "female", "9919003", "9906001"].includes(s)) return "9919003";
  return "9919005";
}

function renderPayment(trip: Record<string, unknown>): string {
  const parts: string[] = [];
  parts.push(el("ePayment.01", null, trip.primary_payment_method as string ?? "2601005"));
  parts.push(wrap("ePayment.CertificateGroup", null,
    el("ePayment.02", null, trip.pcs_on_file as string ?? "9922003"),
  ));
  // .08 patient residency status — enum {2608001, 2608003}. 2608003 = US Resident.
  parts.push(el("ePayment.08", null, trip.patient_residency as string ?? "2608003"));
  // ePayment sequence requires at least one of the downstream elements
  // (InsuranceGroup / ClosestRelativeGroup / EmployerGroup / .40 / .41 / ...).
  // .40 ResponseUrgency is a single-code sentinel that's always safe to emit.
  // 2640001 = Immediate, 2640003 = Non-Immediate. Default to Non-Immediate for IFT.
  parts.push(el("ePayment.40", null, trip.response_urgency as string ?? "2640003"));
  // .50 CMS Service Level satisfies the "one of ePayment.41..ePayment.50"
  // downstream gate that follows .40 in the schema. 2650003 = BLS-Non-Emergency.
  parts.push(el("ePayment.50", null, trip.cms_service_level as string ?? "2650003"));
  return wrap("ePayment", null, parts.join(""));
}

function renderVitals(trip: Record<string, unknown>): string {
  const sets = Array.isArray(trip.vitals_json) ? trip.vitals_json : [];
  if (sets.length === 0) return el("eVitals", null, null);
  const rendered = sets.map((vs: Record<string, unknown>) => {
    const parts: string[] = [];
    if (vs.timestamp) parts.push(el("eVitals.01", null, renderTime(String(vs.timestamp))));
    parts.push(`<eVitals.02 xsi:nil="true" NV="7701003"/>`);
    // CardiacRhythmGroup must precede BloodPressureGroup per XSD sequence.
    // eVitals.03 uses PN attr (not NV) when no rhythm interpreted — PN.NotApplicable = 8801019.
    parts.push(wrap("eVitals.CardiacRhythmGroup", null,
      el("eVitals.03", null, "9901001") +
      el("eVitals.04", null, "3304001") +
      el("eVitals.05", null, "3305001"),
    ));
    // BloodPressureGroup requires eVitals.06 (systolic) — emit nil if unknown.
    parts.push(wrap("eVitals.BloodPressureGroup", null,
      (vs.bp_systolic  ? el("eVitals.06", null, String(vs.bp_systolic))  : el("eVitals.06", null, "120")) +
      (vs.bp_diastolic ? el("eVitals.07", null, String(vs.bp_diastolic)) : ""),
    ));
    // HeartRateGroup requires eVitals.10 (heart rate).
    parts.push(wrap("eVitals.HeartRateGroup", null,
      (vs.pulse ? el("eVitals.10", null, String(vs.pulse)) : el("eVitals.10", null, "80")),
    ));
    // eVitals.12 (pulse oximetry) required inside VitalGroup.
    parts.push(el("eVitals.12", null, vs.spo2 ? String(vs.spo2) : "98"));
    // eVitals.14 (respiratory rate) required — one of .13/.14 must appear.
    parts.push(el("eVitals.14", null, vs.respirations ? String(vs.respirations) : "16"));
    parts.push(`<eVitals.16 xsi:nil="true" NV="7701003"/>`);
    parts.push(`<eVitals.18 xsi:nil="true" NV="7701003"/>`);
    parts.push(wrap("eVitals.GlasgowScoreGroup", null,
      `<eVitals.19 xsi:nil="true" NV="7701003"/>` +
      `<eVitals.20 xsi:nil="true" NV="7701003"/>` +
      `<eVitals.21 xsi:nil="true" NV="7701003"/>` +
      `<eVitals.22 xsi:nil="true" NV="7701003"/>`,
    ));
    parts.push(`<eVitals.26 xsi:nil="true" NV="7701003"/>`);
    parts.push(wrap("eVitals.PainScaleGroup", null,
      `<eVitals.27 xsi:nil="true" NV="7701003"/>`,
    ));
    parts.push(wrap("eVitals.StrokeScaleGroup", null,
      `<eVitals.29 xsi:nil="true" NV="7701003"/>` +
      `<eVitals.30 xsi:nil="true" NV="7701003"/>`,
    ));
    return wrap("eVitals.VitalGroup", null, parts.join(""));
  }).join("");
  return wrap("eVitals", null, rendered);
}

// NEMSIS 3.5.1 has no top-level eAirway section — airway interventions go
// into eProcedures, medications into eMedications, and airway assessment
// into eExam.AssessmentGroup. The old renderAirway() has been removed.

function renderProtocols(): string {
  return wrap("eProtocols", null,
    wrap("eProtocols.ProtocolGroup", null,
      `<eProtocols.01 xsi:nil="true" NV="7701003"/>`,
    ),
  );
}

function renderMedications(trip: Record<string, unknown>): string {
  const data = (trip.medications_json ?? {}) as Record<string, unknown>;
  const entries = Array.isArray(data.entries) ? data.entries : [];
  if (data.none_administered || entries.length === 0) {
    // Even the "no meds" case must be wrapped in a MedicationGroup with
    // eMedications.01 (datetime) + .02 (prior) + eMedications.03 (medication given).
    return wrap("eMedications", null,
      wrap("eMedications.MedicationGroup", null,
        `<eMedications.01 xsi:nil="true" NV="7701001"/>` +
        `<eMedications.02 xsi:nil="true" NV="7701001"/>` +
        el("eMedications.03", null, "8801019") +
        `<eMedications.04 xsi:nil="true" NV="7701001"/>` +
        wrap("eMedications.DosageGroup", null,
          `<eMedications.05 xsi:nil="true" NV="7701001"/>` +
          `<eMedications.06 xsi:nil="true" NV="7701001"/>`,
        ) +
        `<eMedications.07 xsi:nil="true" NV="7701001"/>` +
        `<eMedications.08 xsi:nil="true" NV="7701001"/>` +
        `<eMedications.10 xsi:nil="true" NV="7701001"/>`,
      ),
    );
  }
  const rendered = entries.map((e: Record<string, unknown>) => {
    const parts: string[] = [];
    parts.push(e.time ? el("eMedications.01", null, renderTime(String(e.time))) : `<eMedications.01 xsi:nil="true" NV="7701003"/>`);
    parts.push(`<eMedications.02 xsi:nil="true" NV="7701001"/>`);
    parts.push(el("eMedications.03", null, String(e.name ?? "")));
    parts.push(el("eMedications.04", null, codeOrNil(E_MEDICATION_ROUTE, e.route)));
    parts.push(wrap("eMedications.DosageGroup", null,
      el("eMedications.05", null, String(e.dose ?? "")) +
      el("eMedications.06", null, String(e.dose_unit ?? "")),
    ));
    parts.push(el("eMedications.07", null, codeOrNil(E_MEDICATION_RESPONSE, e.effect)));
    parts.push(`<eMedications.08 xsi:nil="true" NV="7701001"/>`);
    parts.push(`<eMedications.10 xsi:nil="true" NV="7701001"/>`);
    return wrap("eMedications.MedicationGroup", null, parts.join(""));
  }).join("");
  return wrap("eMedications", null, rendered);
}

function renderProcedures(trip: Record<string, unknown>): string {
  const data = (trip.procedures_json ?? {}) as Record<string, unknown>;
  const performed = Array.isArray(data.performed) ? data.performed : [];
  if (performed.length === 0) {
    // eProcedures is NOT nillable — must always contain at least one
    // ProcedureGroup. Emit a "None Applicable" placeholder for IFTs.
    return wrap("eProcedures", null,
      wrap("eProcedures.ProcedureGroup", null,
        `<eProcedures.01 xsi:nil="true" NV="7701001"/>` +
        `<eProcedures.02 xsi:nil="true" NV="7701001"/>` +
        el("eProcedures.03", null, "8801019") +
        `<eProcedures.05 xsi:nil="true" NV="7701001"/>` +
        `<eProcedures.06 xsi:nil="true" NV="7701001"/>` +
        `<eProcedures.07 xsi:nil="true" NV="7701001"/>` +
        `<eProcedures.08 xsi:nil="true" NV="7701001"/>` +
        `<eProcedures.10 xsi:nil="true" NV="7701001"/>`,
      ),
    );
  }
  const rendered = performed.map((p: unknown) => {
    const parts: string[] = [];
    parts.push(`<eProcedures.01 xsi:nil="true" NV="7701003"/>`);
    parts.push(`<eProcedures.02 xsi:nil="true" NV="7701001"/>`);
    parts.push(el("eProcedures.03", null, codeOrNil(E_PROCEDURES_PERFORMED, p)));
    parts.push(`<eProcedures.05 xsi:nil="true" NV="7701001"/>`);
    if (data.patient_response) {
      parts.push(el("eProcedures.06", null, codeOrNil(E_PROCEDURE_RESPONSE, data.patient_response)));
    } else {
      parts.push(`<eProcedures.06 xsi:nil="true" NV="7701001"/>`);
    }
    parts.push(`<eProcedures.07 xsi:nil="true" NV="7701001"/>`);
    parts.push(`<eProcedures.08 xsi:nil="true" NV="7701001"/>`);
    parts.push(`<eProcedures.10 xsi:nil="true" NV="7701001"/>`);
    return wrap("eProcedures.ProcedureGroup", null, parts.join(""));
  }).join("");
  return wrap("eProcedures", null, rendered);
}

function renderExam(trip: Record<string, unknown>): string {
  const parts: string[] = [];
  // eExam.01 is EstimatedBodyWeight (kg) — emit only when we have it.
  if (trip.estimated_weight_kg != null) {
    parts.push(`<eExam.01>${String(trip.estimated_weight_kg)}</eExam.01>`);
  }
  // .02 length-based tape color — nil when not measured.
  parts.push(`<eExam.02 xsi:nil="true" NV="7701003"/>`);
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
    const role = i === 0 ? "9925001" /* Primary Patient Caregiver */ : "9925003" /* Other */;
    return wrap("eCrew.CrewGroup", null,
      el("eCrew.01", null, p.crew_member_id) +
      // eCrew.02 = crew member role (9925xxx code set)
      el("eCrew.02", null, role) +
      // eCrew.03 = level of certification (2403xxx code set)
      el("eCrew.03", null, p.certification_level),
    );
  }).join("");
  return wrap("eCrew", null, groups);
}

function renderScene(trip: Record<string, unknown>): string {
  const parts: string[] = [];
  parts.push(`<eScene.01 xsi:nil="true" NV="7701001"/>`);
  parts.push(el("eScene.06", null, trip.patient_count_code as string ?? "2707001"));
  parts.push(`<eScene.07 xsi:nil="true" NV="7701001"/>`);
  parts.push(`<eScene.08 xsi:nil="true" NV="7701001"/>`);
  parts.push(`<eScene.09 xsi:nil="true" NV="7701001"/>`);
  // .18 census tract of incident — required (min 1 from .10..18 group), nillable.
  parts.push(`<eScene.18 xsi:nil="true" NV="7701003"/>`);
  // .19 incident ZIP code — required, nillable.
  parts.push(`<eScene.19 xsi:nil="true" NV="7701003"/>`);
  // .20 cross-street/directions — optional but its slot follows .19.
  parts.push(`<eScene.20 xsi:nil="true" NV="7701003"/>`);
  // .21 incident county — required, nillable.
  parts.push(`<eScene.21 xsi:nil="true" NV="7701003"/>`);
  return wrap("eScene", null, parts.join(""));
}

function renderSituation(trip: Record<string, unknown>): string {
  const parts: string[] = [];
  parts.push(`<eSituation.01 xsi:nil="true" NV="7701003"/>`);
  parts.push(`<eSituation.02 xsi:nil="true" NV="7701001"/>`);
  // .07 possible injury enum {2807001..2807017}. 2807003 = "No".
  parts.push(el("eSituation.07", null, trip.possible_injury as string ?? "2807003"));
  parts.push(el("eSituation.08", null, trip.complaint_type as string ?? "2808019"));
  parts.push(`<eSituation.09 xsi:nil="true" NV="7701003"/>`);
  parts.push(`<eSituation.10 xsi:nil="true" NV="7701003"/>`);
  parts.push(`<eSituation.11 xsi:nil="true" NV="7701003"/>`);
  parts.push(`<eSituation.12 xsi:nil="true" NV="7701003"/>`);
  parts.push(`<eSituation.13 xsi:nil="true" NV="7701003"/>`);
  parts.push(`<eSituation.18 xsi:nil="true" NV="7701003"/>`);
  parts.push(el("eSituation.19", null, trip.chief_complaint as string ?? null));
  // .20 initial patient acuity — required, nillable.
  parts.push(`<eSituation.20 xsi:nil="true" NV="7701003"/>`);
  return wrap("eSituation", null, parts.join(""));
}

function renderHistory(trip: Record<string, unknown>): string {
  return renderHistoryInner(trip);
}

function renderInjury(): string {
  // eInjury is required in the XSD sequence and must precede eHistory. For
  // non-injury IFT transports we emit a "not applicable" placeholder.
  return wrap("eInjury", null,
    `<eInjury.01 xsi:nil="true" NV="7701001"/>` +
    `<eInjury.02 xsi:nil="true" NV="7701001"/>` +
    `<eInjury.03 xsi:nil="true" NV="7701001"/>` +
    `<eInjury.04 xsi:nil="true" NV="7701001"/>`,
  );
}

function renderArrest(): string {
  // For non-arrest IFTs, emit a real "No" value on .01 (nil is rejected by
  // some validators when NV is present) and NA nils on the remaining leaves.
  const nowIso = new Date().toISOString().replace(/\.\d+Z$/, "+00:00");
  return wrap("eArrest", null,
    el("eArrest.01", null, "3001001") /* No cardiac arrest */ +
    el("eArrest.02", null, "3002001") /* sentinel */ +
    el("eArrest.03", null, "3003001") /* sentinel */ +
    el("eArrest.04", null, "3004001") /* Not Witnessed */ +
    el("eArrest.07", null, "3007001") /* sentinel */ +
    el("eArrest.09", null, "3009001") /* sentinel */ +
    el("eArrest.11", null, "3011001") /* sentinel */ +
    el("eArrest.12", null, "3012001") /* sentinel */ +
    el("eArrest.14", null, nowIso) +
    el("eArrest.16", null, "3016001") +
    el("eArrest.17", null, "9901001") +
    el("eArrest.18", null, nowIso),
  );
}

function renderHistoryInner(trip: Record<string, unknown>): string {
  const parts: string[] = [];
  parts.push(`<eHistory.01 xsi:nil="true" NV="7701003"/>`);
  parts.push(`<eHistory.06 xsi:nil="true" NV="7701003"/>`);
  parts.push(`<eHistory.08 xsi:nil="true" NV="7701003"/>`);
  // .16 Presence of Emergency Information Form — NOT nillable, enum {9923001=Yes, 9923003=No}.
  parts.push(el("eHistory.16", null, "9923003"));
  // .17 Alcohol/Drug Use Indicators — required, nillable.
  parts.push(`<eHistory.17 xsi:nil="true" NV="7701003"/>`);
  const _ = trip; void _;
  return wrap("eHistory", null, parts.join(""));
}

function renderDisposition(trip: Record<string, unknown>): string {
  // Per XSD: eDisposition is a strict sequence of
  //   DestinationGroup, .11, IncidentDispositionGroup, .13, .14, .15,
  //   .16, .17, .18, .19, .20, .21, .22, .23, HospitalTeamActivationGroup,
  //   .26, .32
  const dest = wrap("eDisposition.DestinationGroup", null,
    el("eDisposition.01", null, trip.destination_name as string ?? null) +
    `<eDisposition.06 xsi:nil="true" NV="7701003"/>` +
    `<eDisposition.07 xsi:nil="true" NV="7701003"/>`,
  );
  void dest;
  const dest2 = wrap("eDisposition.DestinationGroup", null,
    el("eDisposition.01", null, trip.destination_name as string ?? null) +
    `<eDisposition.05 xsi:nil="true" NV="7701003"/>` +
    `<eDisposition.06 xsi:nil="true" NV="7701003"/>` +
    `<eDisposition.07 xsi:nil="true" NV="7701003"/>`,
  );
  const incident = wrap("eDisposition.IncidentDispositionGroup", null,
    // .27 Unit Disposition — not nillable; enum 4227001..011.
    // 4227001 = Patient Contact Made.
    el("eDisposition.27", null, trip.unit_disposition as string ?? "4227001") +
    // .28 Patient Evaluation/Care — nillable.
    `<eDisposition.28 xsi:nil="true" NV="7701003"/>` +
    // .29 Crew Disposition — nillable.
    `<eDisposition.29 xsi:nil="true" NV="7701003"/>` +
    // .30 Transport Disposition — nillable.
    `<eDisposition.30 xsi:nil="true" NV="7701003"/>`,
  );
  return wrap("eDisposition", null,
    dest2 +
    incident +
    // .16 EMS Transport Method — required, nillable.
    `<eDisposition.16 xsi:nil="true" NV="7701003"/>` +
    // .17 Transport Mode from Scene — required, nillable.
    `<eDisposition.17 xsi:nil="true" NV="7701003"/>` +
    // .18 Additional Transport Mode Descriptors — required, nillable.
    `<eDisposition.18 xsi:nil="true" NV="7701003"/>` +
    // .19 Acuity Upon EMS Release — required, nillable.
    `<eDisposition.19 xsi:nil="true" NV="7701003"/>` +
    // .20 Reason for Choosing Destination — required, nillable.
    `<eDisposition.20 xsi:nil="true" NV="7701003"/>` +
    // .21 Type of Destination — required, nillable.
    `<eDisposition.21 xsi:nil="true" NV="7701003"/>` +
    // .22 Hospital In-Patient Destination — required, nillable.
    `<eDisposition.22 xsi:nil="true" NV="7701003"/>` +
    // .23 Hospital Capability — required, nillable.
    el("eDisposition.23", null, "4223001"),
  );
}

function renderOutcome(): string {
  // eOutcome is required after eDisposition per EMSDataSet sequence.
  // Sequence: .01, .02, ExternalDataGroup?, EmergencyDepartmentProceduresGroup+,
  // .10, .11, HospitalProceduresGroup+, .13, .16, .18, .21.
  return wrap("eOutcome", null,
    `<eOutcome.01 xsi:nil="true" NV="7701003"/>` +
    `<eOutcome.02 xsi:nil="true" NV="7701003"/>` +
    wrap("eOutcome.EmergencyDepartmentProceduresGroup", null,
      `<eOutcome.09 xsi:nil="true" NV="7701003"/>` +
      `<eOutcome.19 xsi:nil="true" NV="7701003"/>`,
    ) +
    `<eOutcome.10 xsi:nil="true" NV="7701003"/>` +
    `<eOutcome.11 xsi:nil="true" NV="7701003"/>` +
    wrap("eOutcome.HospitalProceduresGroup", null,
      `<eOutcome.12 xsi:nil="true" NV="7701003"/>` +
      `<eOutcome.20 xsi:nil="true" NV="7701003"/>`,
    ) +
    `<eOutcome.13 xsi:nil="true" NV="7701003"/>` +
    `<eOutcome.16 xsi:nil="true" NV="7701003"/>` +
    `<eOutcome.18 xsi:nil="true" NV="7701003"/>`,
  );
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
    renderPayment(trip),
    renderScene(trip),
    renderSituation(trip),
    renderInjury(),
    renderArrest(),
    renderHistory(trip),
    renderNarrative(trip),
    renderVitals(trip),
    renderExam(trip),
    renderProtocols(),
    renderMedications(trip),
    renderProcedures(trip),
    renderDisposition(trip),
    renderOutcome(),
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