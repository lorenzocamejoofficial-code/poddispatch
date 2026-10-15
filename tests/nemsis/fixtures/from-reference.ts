/**
 * Dev-only fixture loader: maps an official NEMSIS EMS reference XML onto the
 * structured EmsRecordData model, field by field. Used by the EMS 2–5
 * compliance fixtures so every value (including nil NV/PN forms and repeating
 * lists) comes from NEMSIS's own file. No tenant data, no PHI.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { EmsRecordData, EmsValue, ExportContext, PcrExportInput } from "../../../src/lib/nemsis/exporter";

const esc = (t: string) => t.replace(/\./g, "\\.");

function blocks(src: string, tag: string): string[] {
  return [...src.matchAll(new RegExp(`<${esc(tag)}\\b[^>]*>([\\s\\S]*?)</${esc(tag)}>`, "g"))].map((m) => m[1]);
}
const block = (src: string, tag: string) => blocks(src, tag)[0] ?? "";

/** Every occurrence of a leaf as an EmsValue (nil NV/PN preserved). */
function many(src: string, tag: string): EmsValue[] {
  const re = new RegExp(`<${esc(tag)}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${esc(tag)}>)`, "g");
  return [...src.matchAll(re)].map((m) => {
    const pn = m[1].match(/PN="([^"]*)"/)?.[1];
    const nv = m[1].match(/NV="([^"]*)"/)?.[1];
    if (pn) return { pn };
    if (nv) return { nv };
    return (m[2] ?? "").trim();
  });
}
/** First occurrence, or undefined when the reference omits the element. */
const one = (src: string, tag: string) => many(src, tag)[0] as EmsValue;
const attr = (src: string, tag: string, a: string) =>
  src.match(new RegExp(`<${esc(tag)}\\b[^>]*\\b${a}="([^"]*)"`))?.[1];

export function loadEmsReference(file: string): { input: PcrExportInput; ctx: ExportContext } {
  const path = join(dirname(fileURLToPath(import.meta.url)), "../reference", file);
  const xml = readFileSync(path, "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const demo = block(xml, "DemographicGroup");
  const R = block(xml, "eResponse"), D = block(xml, "eDispatch"), T = block(xml, "eTimes");
  const P = block(xml, "ePatient"), Pay = block(xml, "ePayment"), S = block(xml, "eScene");
  const Si = block(xml, "eSituation"), I = block(xml, "eInjury"), A = block(xml, "eArrest");
  const H = block(xml, "eHistory"), Di = block(xml, "eDisposition"), O = block(xml, "eOutcome");
  const t = (k: string) => one(T, `eTimes.${k}`);

  const nemsis: EmsRecordData = {
    record_id: String(one(block(xml, "eRecord"), "eRecord.01")),
    response: {
      agency_number: one(R, "eResponse.01"), agency_name: one(R, "eResponse.02"),
      incident_number: one(R, "eResponse.03"), response_number: one(R, "eResponse.04"),
      type_of_service: one(R, "eResponse.05"), unit_transport_capability: one(R, "eResponse.07"),
      dispatch_delays: many(R, "eResponse.08"), response_delays: many(R, "eResponse.09"),
      scene_delays: many(R, "eResponse.10"), transport_delays: many(R, "eResponse.11"),
      turnaround_delays: many(R, "eResponse.12"), vehicle_number: one(R, "eResponse.13"),
      call_sign: one(R, "eResponse.14"), response_mode: one(R, "eResponse.23"),
      response_mode_descriptors: many(R, "eResponse.24"),
    },
    dispatch: { complaint: one(D, "eDispatch.01"), emd_performed: one(D, "eDispatch.02") },
    times: {
      psap_call: t("01"), dispatch_notified: t("02"), unit_notified: t("03"), dispatch_acknowledged: t("04"),
      unit_en_route: t("05"), unit_on_scene: t("06"), at_patient: t("07"), transfer_of_ems_care: t("08"),
      left_scene: t("09"), landing_area: t("10"), at_destination: t("11"), destination_transfer_of_care: t("12"),
      back_in_service: t("13"), unit_canceled: t("14"), back_at_home: t("15"), ems_call_completed: t("16"),
    },
    patient: {
      last_name: one(P, "ePatient.02"), first_name: one(P, "ePatient.03"),
      home_county: one(P, "ePatient.07"), home_state: one(P, "ePatient.08"), home_zip: one(P, "ePatient.09"),
      gender: one(P, "ePatient.13"), race: many(P, "ePatient.14"), age: one(P, "ePatient.15"),
      age_units: one(P, "ePatient.16"), date_of_birth: one(P, "ePatient.17"), sex: one(P, "ePatient.25"),
    },
    payment: {
      primary_method: one(Pay, "ePayment.01"), pcs_on_file: one(Pay, "ePayment.02"),
      residency_status: one(Pay, "ePayment.08"), response_urgency: one(Pay, "ePayment.40"),
      cms_service_level: one(Pay, "ePayment.50"),
    },
    scene: {
      first_unit_on_scene: one(S, "eScene.01"), patient_count: one(S, "eScene.06"),
      mass_casualty: one(S, "eScene.07"), triage_classification: one(S, "eScene.08"),
      location_type: one(S, "eScene.09"), census_tract: one(S, "eScene.18"), zip: one(S, "eScene.19"),
      cross_street: one(S, "eScene.20"), county: one(S, "eScene.21"),
    },
    situation: {
      symptom_onset: one(Si, "eSituation.01"), possible_injury: one(Si, "eSituation.02"),
      complaint_anatomic_location: one(Si, "eSituation.07"), complaint_organ_system: one(Si, "eSituation.08"),
      primary_symptom: one(Si, "eSituation.09"), other_symptoms: many(Si, "eSituation.10"),
      primary_impression: one(Si, "eSituation.11"), secondary_impressions: many(Si, "eSituation.12"),
      initial_acuity: one(Si, "eSituation.13"), last_known_well: one(Si, "eSituation.18"),
      chief_complaint_text: one(Si, "eSituation.19"), reason_for_transfer: one(Si, "eSituation.20"),
    },
    injury: {
      cause: many(I, "eInjury.01"), trauma_triage_high: many(I, "eInjury.03"),
      trauma_triage_moderate: many(I, "eInjury.04"),
    },
    arrest: {
      cardiac_arrest: one(A, "eArrest.01"), etiology: one(A, "eArrest.02"),
      resuscitation_attempted: many(A, "eArrest.03"), witnessed_by: many(A, "eArrest.04"),
      aed_prior: one(A, "eArrest.07"), cpr_type: many(A, "eArrest.09"), first_rhythm: one(A, "eArrest.11"),
      rosc: many(A, "eArrest.12"), arrest_datetime: one(A, "eArrest.14"),
      reason_cpr_discontinued: one(A, "eArrest.16"), rhythm_at_destination: many(A, "eArrest.17"),
      end_of_event: one(A, "eArrest.18"), who_first_cpr: one(A, "eArrest.20"),
      who_first_aed: one(A, "eArrest.21"), who_first_defib: one(A, "eArrest.22"),
    },
    history: {
      barriers_to_care: many(H, "eHistory.01"), allergies: many(H, "eHistory.06"),
      medical_history: many(H, "eHistory.08"), emergency_info_form: one(H, "eHistory.16"),
      alcohol_drug_indicators: many(H, "eHistory.17"),
    },
    vitals: blocks(xml, "eVitals.VitalGroup").map((b) => ({
      datetime: one(b, "eVitals.01"), prior_to_care: one(b, "eVitals.02"),
      cardiac_rhythm: many(b, "eVitals.03"), ecg_type: one(b, "eVitals.04"),
      interpretation_method: many(b, "eVitals.05"), sbp: one(b, "eVitals.06"), dbp: one(b, "eVitals.07"),
      heart_rate: one(b, "eVitals.10"), spo2: one(b, "eVitals.12"), respiratory_rate: one(b, "eVitals.14"),
      etco2: one(b, "eVitals.16") !== undefined
        ? { value: one(b, "eVitals.16"), type: attr(b, "eVitals.16", "ETCO2Type") } : undefined,
      glucose: one(b, "eVitals.18"), gcs_eye: one(b, "eVitals.19"), gcs_verbal: one(b, "eVitals.20"),
      gcs_motor: one(b, "eVitals.21"), gcs_qualifiers: many(b, "eVitals.22"), avpu: one(b, "eVitals.26"),
      pain_score: one(b, "eVitals.27"), stroke_scale_result: one(b, "eVitals.29"),
      stroke_scale_type: one(b, "eVitals.30"), reperfusion_checklist: one(b, "eVitals.31"),
    })),
    protocols: blocks(xml, "eProtocols.ProtocolGroup").map((b) => ({
      protocol: one(b, "eProtocols.01"), age_category: one(b, "eProtocols.02"),
    })),
    medications: blocks(xml, "eMedications.MedicationGroup").map((b) => ({
      datetime: one(b, "eMedications.01"), prior_to_care: one(b, "eMedications.02"),
      medication: { code: one(b, "eMedications.03"), code_type: attr(b, "eMedications.03", "CodeType") },
      route: one(b, "eMedications.04"), dose: one(b, "eMedications.05"), dose_unit: one(b, "eMedications.06"),
      response: one(b, "eMedications.07"), complications: many(b, "eMedications.08"),
      crew_member_id: one(b, "eMedications.09"), crew_role: one(b, "eMedications.10"),
    })),
    procedures: blocks(xml, "eProcedures.ProcedureGroup").map((b) => ({
      datetime: one(b, "eProcedures.01"), prior_to_care: one(b, "eProcedures.02"),
      procedure: one(b, "eProcedures.03"), device_size: one(b, "eProcedures.04"),
      attempts: one(b, "eProcedures.05"), successful: one(b, "eProcedures.06"),
      complications: many(b, "eProcedures.07"), response: one(b, "eProcedures.08"),
      crew_member_id: one(b, "eProcedures.09"), crew_role: one(b, "eProcedures.10"),
    })),
    disposition: {
      destination: {
        name: one(Di, "eDisposition.01"), code: one(Di, "eDisposition.02"), street: one(Di, "eDisposition.03"),
        city: one(Di, "eDisposition.04"), state: one(Di, "eDisposition.05"), county: one(Di, "eDisposition.06"),
        zip: one(Di, "eDisposition.07"),
      },
      unit_disposition: one(Di, "eDisposition.27"), patient_evaluation: one(Di, "eDisposition.28"),
      crew_disposition: one(Di, "eDisposition.29"), transport_disposition: one(Di, "eDisposition.30"),
      transport_method: one(Di, "eDisposition.16"), transport_mode: one(Di, "eDisposition.17"),
      transport_mode_descriptors: many(Di, "eDisposition.18"), acuity_at_release: one(Di, "eDisposition.19"),
      destination_reasons: many(Di, "eDisposition.20"), destination_type: one(Di, "eDisposition.21"),
      inpatient_destination: one(Di, "eDisposition.22"), hospital_capability: many(Di, "eDisposition.23"),
      team_activation: blocks(Di, "eDisposition.HospitalTeamActivationGroup").map((b) => ({
        activation: one(b, "eDisposition.24"), datetime: one(b, "eDisposition.25"),
      })),
      level_of_care: one(Di, "eDisposition.32"),
    },
    outcome: {
      ed_disposition: one(O, "eOutcome.01"), hospital_disposition: one(O, "eOutcome.02"),
      ed_procedures: blocks(O, "eOutcome.EmergencyDepartmentProceduresGroup").map((b) => ({
        procedure: one(b, "eOutcome.09"), datetime: one(b, "eOutcome.19"),
      })),
      ed_diagnoses: many(O, "eOutcome.10"), ed_admit_datetime: one(O, "eOutcome.11"),
      hospital_procedures: blocks(O, "eOutcome.HospitalProceduresGroup").map((b) => ({
        procedure: one(b, "eOutcome.12"), datetime: one(b, "eOutcome.20"),
      })),
      hospital_diagnoses: many(O, "eOutcome.13"), discharge_datetime: one(O, "eOutcome.16"),
      outcome_at_discharge: one(O, "eOutcome.18"),
    },
  };

  const ctx: ExportContext = {
    agency: {
      npi: null,
      name: "NEMSIS 2026 DEM 1 test agency",
      state_unique_id: String(one(demo, "dAgency.01")),
      state_ems_agency_number: String(one(demo, "dAgency.02")),
      state_ems_license_state: String(one(demo, "dAgency.04")),
    },
    vehicle: null,
    personnel: [],
    state: "DE",
    test_mode: true,
    software: { name: "Pod Dispatch", version: "1.0" },
    custom_configuration_registered: false,
  };
  const pcr_uuid = xml.match(/<PatientCareReport UUID="([^"]*)"/)?.[1];
  return { input: { trip: {}, patient: null, pcr_uuid, nemsis }, ctx };
}
