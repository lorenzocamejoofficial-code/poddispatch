/**
 * Dev-only fixture: NEMSIS 2026 EMS 1 (respiratory interfacility transfer)
 * as structured data for buildEmsDataSet(). Values transcribed from the
 * official reference; the three vital-sign groups are extracted from the
 * reference XML at load time. No tenant data, no PHI.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { EmsValue, EmsVitalGroup, ExportContext, PcrExportInput } from "../../../src/lib/nemsis/exporter";

const REF = join(dirname(fileURLToPath(import.meta.url)), "../reference/2026-EMS-1-RespiratoryTransfer_v351.xml");
const xml = readFileSync(REF, "utf8").replace(/<!--[\s\S]*?-->/g, "");

const NA = { nv: "7701001" } as const;   // Not Applicable
const NR = { nv: "7701003" } as const;   // Not Recorded

/** Every occurrence of a leaf inside `src`, as an EmsValue (nil NV/PN kept). */
function leaves(src: string, tag: string): EmsValue[] {
  const t = tag.replace(/\./g, "\\.");
  const re = new RegExp(`<${t}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${t}>)`, "g");
  return [...src.matchAll(re)].map((m) => {
    const nv = m[1].match(/NV="([^"]*)"/)?.[1];
    const pn = m[1].match(/PN="([^"]*)"/)?.[1];
    if (pn) return { pn };
    if (nv) return { nv };
    return (m[2] ?? "").trim();
  });
}
const one = (src: string, tag: string) => leaves(src, tag)[0];

const vitalBlocks = [...xml.matchAll(/<eVitals\.VitalGroup>([\s\S]*?)<\/eVitals\.VitalGroup>/g)].map((m) => m[1]);
const vitals: EmsVitalGroup[] = vitalBlocks.map((b) => ({
  datetime: one(b, "eVitals.01"),
  prior_to_care: one(b, "eVitals.02"),
  cardiac_rhythm: leaves(b, "eVitals.03"),
  ecg_type: one(b, "eVitals.04"),
  interpretation_method: leaves(b, "eVitals.05"),
  sbp: one(b, "eVitals.06"),
  heart_rate: one(b, "eVitals.10"),
  spo2: one(b, "eVitals.12"),
  respiratory_rate: one(b, "eVitals.14"),
  etco2: { value: one(b, "eVitals.16"), type: b.match(/ETCO2Type="([^"]*)"/)?.[1] },
  glucose: one(b, "eVitals.18"),
  gcs_eye: one(b, "eVitals.19"),
  gcs_verbal: one(b, "eVitals.20"),
  gcs_motor: one(b, "eVitals.21"),
  gcs_qualifiers: leaves(b, "eVitals.22"),
  avpu: one(b, "eVitals.26"),
  pain_score: one(b, "eVitals.27"),
  stroke_scale_result: one(b, "eVitals.29"),
  stroke_scale_type: one(b, "eVitals.30"),
  reperfusion_checklist: one(b, "eVitals.31"),
}));

const med = (datetime: string, code: string, route: string, dose: string, unit: string) => ({
  datetime, prior_to_care: "9923001", medication: { code, code_type: "9924003" }, route, dose, dose_unit: unit,
  response: "9916003", complications: ["3708031"], crew_role: "9905041",
});

export const EMS1_CTX: ExportContext = {
  agency: {
    npi: null,
    name: "NEMSIS 2026 DEM 1 test agency",
    state_unique_id: "11261",
    state_ems_agency_number: "351-11261",
    state_ems_license_state: "10",
  },
  vehicle: null,
  personnel: [],
  state: "DE",
  test_mode: true,
  software: { name: "Pod Dispatch", version: "1.0" },
  custom_configuration_registered: false,
};

export const EMS1_INPUT: PcrExportInput = {
  trip: {},
  patient: null,
  pcr_uuid: "b518e65f-6d6e-47e4-9884-8a32bcb13b60",
  nemsis: {
    record_id: "2026-EMS-1-RespiratoryTransfer_v350",
    response: {
      agency_number: "351-11261", incident_number: "351-25844", response_number: "351-25844-1",
      type_of_service: "2205005", unit_transport_capability: "2207019",
      dispatch_delays: ["2208013"], response_delays: ["2209011"], scene_delays: ["2210017"],
      transport_delays: ["2211011"], turnaround_delays: ["2212015"],
      vehicle_number: "ECA1105", call_sign: "M-12",
      response_mode: "2223005", response_mode_descriptors: ["2224007", "2224019"],
    },
    dispatch: { complaint: "2301071", emd_performed: NA },
    times: {
      psap_call: NA,
      unit_notified: "2025-10-26T09:30:04-04:00",
      unit_en_route: "2025-10-26T09:41:12-04:00",
      unit_on_scene: "2025-10-26T09:49:55-04:00",
      at_patient: "2025-10-26T10:00:37-04:00",
      left_scene: "2025-10-26T10:06:31-04:00",
      at_destination: "2025-10-26T12:07:50-04:00",
      destination_transfer_of_care: "2025-10-26T12:09:00-04:00",
      back_in_service: "2025-10-26T13:51:32-04:00",
    },
    patient: {
      home_county: "10001", home_state: "10", home_zip: "19904",
      gender: NR, race: ["2514011"], age: "67", age_units: "2516009", sex: "9919001",
    },
    payment: { primary_method: "2601005", cms_service_level: "2650015" },
    scene: {
      first_unit_on_scene: NA, patient_count: "2707005", mass_casualty: "9923001",
      triage_classification: NA, location_type: "Y92.23", census_tract: "10", zip: "19901", county: "10001",
    },
    situation: {
      symptom_onset: "2025-10-24T08:00:00-04:00", possible_injury: "9922001",
      complaint_anatomic_location: "2807005", complaint_organ_system: "2808019",
      primary_symptom: "R06.89", other_symptoms: ["R50.9", "R69"],
      primary_impression: "J80", secondary_impressions: ["J11", "J18.9"],
      initial_acuity: "2813003", last_known_well: NR, reason_for_transfer: "2820015",
    },
    injury: { cause: [NA], trauma_triage_high: [NA], trauma_triage_moderate: [NA] },
    arrest: {
      cardiac_arrest: "3001001", etiology: NA, resuscitation_attempted: [NA], witnessed_by: [NA],
      aed_prior: NA, cpr_type: [NA], first_rhythm: NA, rosc: [NA], arrest_datetime: NA,
      reason_cpr_discontinued: NA, rhythm_at_destination: [NA], end_of_event: NA,
      who_first_cpr: NA, who_first_aed: NA, who_first_defib: NA,
    },
    history: { barriers_to_care: ["3101027"], alcohol_drug_indicators: [{ pn: "8801015" }] },
    vitals,
    protocols: [{ protocol: "9914181" }],
    medications: [
      med("2025-10-26T10:00:37-04:00", "7806", "9927051", "40", "3706035"),
      med("2025-10-26T10:18:56-04:00", "2573160", "9927023", "2", "3706001"),
      med("2025-10-26T10:18:56-04:00", "313002", "9927023", "50", "3706027"),
    ],
    procedures: [
      {
        datetime: "2025-10-26T10:00:37-04:00", prior_to_care: "9923001", procedure: "385857005",
        attempts: "1", successful: "9923003", complications: ["3907033"], response: "9916003", crew_role: "9905041",
      },
      {
        datetime: NR, prior_to_care: "9923003", procedure: "392230005",
        attempts: NR, successful: "9923003", complications: [NR], response: NR, crew_role: "9905019",
      },
    ],
    disposition: {
      destination: { state: "11", county: "11001", zip: "20007" },
      unit_disposition: "4227001", patient_evaluation: "4228001",
      crew_disposition: "4229001", transport_disposition: "4230001",
      transport_method: "4216005", transport_mode: "4217005", transport_mode_descriptors: ["4218015"],
      acuity_at_release: "4219003", destination_reasons: ["4220017", "4220021"],
      destination_type: "4221005", inpatient_destination: "4222005", hospital_capability: ["9908007"],
      team_activation: [{ activation: "4224001", datetime: NA }],
      level_of_care: "4232009",
    },
    outcome: {
      ed_disposition: NA, hospital_disposition: "03",
      ed_procedures: [{ procedure: NA, datetime: NA }],
      ed_diagnoses: [NA], ed_admit_datetime: "2025-10-26T12:09:51-04:00",
      hospital_procedures: [{ procedure: NR, datetime: NR }],
      hospital_diagnoses: [NR], discharge_datetime: "2025-11-07T12:30:01-05:00",
      outcome_at_discharge: NA,
    },
  },
};
