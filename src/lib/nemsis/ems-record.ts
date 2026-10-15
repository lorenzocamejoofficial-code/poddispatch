/**
 * Data-driven NEMSIS 3.5.1 EMSDataSet section renderers.
 *
 * Used by buildERecord when PcrExportInput.nemsis is supplied (compliance
 * fixtures today; a fully-mapped live PCR later). Every element is emitted
 * from data; an element is omitted when its field is undefined, and emitted
 * as xsi:nil with NV/PN when the field is an explicit Not Value / Pertinent
 * Negative. Sequence order follows EMSDataSet_v3.xsd.
 */
import { el, wrap, xmlEscape } from "./xml-utils";

/** A leaf value, an explicit Not Value (NV), a nil Pertinent Negative (PN),
 *  or a real value qualified by a PN (e.g. 8801029 "Approximate"). */
export type EmsValue = string | { nv: string } | { pn: string; value?: string };
type Many = EmsValue[] | undefined;

export interface EmsResponse {
  agency_number: EmsValue;                 // .01
  agency_name?: EmsValue;                  // .02
  incident_number?: EmsValue;              // .03
  response_number: EmsValue;               // .04
  type_of_service: EmsValue;               // .05
  unit_transport_capability: EmsValue;     // .07
  dispatch_delays: EmsValue[];             // .08
  response_delays: EmsValue[];             // .09
  scene_delays: EmsValue[];                // .10
  transport_delays: EmsValue[];            // .11
  turnaround_delays: EmsValue[];           // .12
  vehicle_number: EmsValue;                // .13
  call_sign: EmsValue;                     // .14
  response_mode: EmsValue;                 // .23
  response_mode_descriptors: EmsValue[];   // .24
}

export interface EmsDispatch {
  complaint: EmsValue;                     // .01
  emd_performed: EmsValue;                 // .02
}

/** eTimes keyed by element number (01..17). */
export type EmsTimes = Partial<Record<
  "psap_call" | "dispatch_notified" | "unit_notified" | "dispatch_acknowledged" |
  "unit_en_route" | "unit_on_scene" | "at_patient" | "transfer_of_ems_care" |
  "left_scene" | "landing_area" | "at_destination" | "destination_transfer_of_care" |
  "back_in_service" | "unit_canceled" | "back_at_home" | "ems_call_completed",
  EmsValue>>;

const TIME_ORDER: [keyof EmsTimes, string][] = [
  ["psap_call", "01"], ["dispatch_notified", "02"], ["unit_notified", "03"],
  ["dispatch_acknowledged", "04"], ["unit_en_route", "05"], ["unit_on_scene", "06"],
  ["at_patient", "07"], ["transfer_of_ems_care", "08"], ["left_scene", "09"],
  ["landing_area", "10"], ["at_destination", "11"], ["destination_transfer_of_care", "12"],
  ["back_in_service", "13"], ["unit_canceled", "14"], ["back_at_home", "15"],
  ["ems_call_completed", "16"],
];

export interface EmsPatient {
  last_name?: EmsValue;                    // .02
  first_name?: EmsValue;                   // .03
  home_county?: EmsValue;                  // .07
  home_state?: EmsValue;                   // .08
  home_zip?: EmsValue;                     // .09
  gender: EmsValue;                        // .13
  race: EmsValue[];                        // .14
  age: EmsValue;                           // .15
  age_units: EmsValue;                     // .16
  date_of_birth?: EmsValue;                // .17
  sex: EmsValue;                           // .25
}

export interface EmsPayment {
  primary_method: EmsValue;                // .01
  pcs_on_file?: EmsValue;                  // .02 (CertificateGroup)
  residency_status?: EmsValue;             // .08
  response_urgency?: EmsValue;             // .40
  cms_service_level?: EmsValue;            // .50
}

export interface EmsScene {
  first_unit_on_scene: EmsValue;           // .01
  patient_count: EmsValue;                 // .06
  mass_casualty: EmsValue;                 // .07
  triage_classification: EmsValue;         // .08
  location_type: EmsValue;                 // .09
  census_tract?: EmsValue;                 // .18
  zip: EmsValue;                           // .19
  cross_street?: EmsValue;                 // .20
  county: EmsValue;                        // .21
}

export interface EmsSituation {
  symptom_onset: EmsValue;                 // .01
  possible_injury: EmsValue;               // .02
  complaint_anatomic_location: EmsValue;   // .07
  complaint_organ_system: EmsValue;        // .08
  primary_symptom: EmsValue;               // .09
  other_symptoms: EmsValue[];              // .10
  primary_impression: EmsValue;            // .11
  secondary_impressions: EmsValue[];       // .12
  initial_acuity: EmsValue;                // .13
  last_known_well: EmsValue;               // .18
  chief_complaint_text?: EmsValue;         // .19
  reason_for_transfer: EmsValue;           // .20
}

export interface EmsInjury {
  cause: EmsValue[];                       // .01
  trauma_triage_high: EmsValue[];          // .03
  trauma_triage_moderate: EmsValue[];      // .04
}

export interface EmsArrest {
  cardiac_arrest: EmsValue;                // .01
  etiology: EmsValue;                      // .02
  resuscitation_attempted: EmsValue[];     // .03
  witnessed_by: EmsValue[];                // .04
  aed_prior: EmsValue;                     // .07
  cpr_type: EmsValue[];                    // .09
  first_rhythm: EmsValue;                  // .11
  rosc: EmsValue[];                        // .12
  arrest_datetime: EmsValue;               // .14
  reason_cpr_discontinued: EmsValue;       // .16
  rhythm_at_destination: EmsValue[];       // .17
  end_of_event: EmsValue;                  // .18
  who_first_cpr: EmsValue;                 // .20
  who_first_aed: EmsValue;                 // .21
  who_first_defib: EmsValue;               // .22
}

export interface EmsHistory {
  barriers_to_care: EmsValue[];            // .01
  allergies?: EmsValue[];                  // .06
  medical_history?: EmsValue[];            // .08
  emergency_info_form?: EmsValue;          // .16
  alcohol_drug_indicators: EmsValue[];     // .17
}

export interface EmsVitalGroup {
  datetime: EmsValue;                      // .01
  prior_to_care: EmsValue;                 // .02
  cardiac_rhythm: EmsValue[];              // .03
  ecg_type: EmsValue;                      // .04
  interpretation_method: EmsValue[];       // .05
  sbp: EmsValue;                           // .06
  dbp?: EmsValue;                          // .07
  heart_rate: EmsValue;                    // .10
  spo2: EmsValue;                          // .12
  respiratory_rate: EmsValue;              // .14
  etco2?: { value: EmsValue; type?: string }; // .16 @ETCO2Type
  glucose: EmsValue;                       // .18
  gcs_eye: EmsValue;                       // .19
  gcs_verbal: EmsValue;                    // .20
  gcs_motor: EmsValue;                     // .21
  gcs_qualifiers: EmsValue[];              // .22
  avpu: EmsValue;                          // .26
  pain_score: EmsValue;                    // .27
  stroke_scale_result: EmsValue;           // .29
  stroke_scale_type: EmsValue;             // .30
  reperfusion_checklist: EmsValue;         // .31
}

export interface EmsProtocol { protocol: EmsValue; age_category?: EmsValue }

export interface EmsMedicationGroup {
  datetime: EmsValue;                      // .01
  prior_to_care: EmsValue;                 // .02
  medication: { code: EmsValue; code_type?: string }; // .03 @CodeType
  route: EmsValue;                         // .04
  dose: EmsValue;                          // .05
  dose_unit: EmsValue;                     // .06
  response: EmsValue;                      // .07
  complications: EmsValue[];               // .08
  crew_member_id?: EmsValue;               // .09
  crew_role: EmsValue;                     // .10
}

export interface EmsProcedureGroup {
  datetime: EmsValue;                      // .01
  prior_to_care: EmsValue;                 // .02
  procedure: EmsValue;                     // .03
  device_size?: EmsValue;                  // .04
  attempts: EmsValue;                      // .05
  successful: EmsValue;                    // .06
  complications: EmsValue[];               // .07
  response: EmsValue;                      // .08
  crew_member_id?: EmsValue;               // .09
  crew_role: EmsValue;                     // .10
}

export interface EmsDisposition {
  destination: {
    name?: EmsValue; code?: EmsValue; street?: EmsValue; city?: EmsValue; // .01-.04
    state: EmsValue; county: EmsValue; zip: EmsValue;                     // .05-.07
  };
  unit_disposition: EmsValue;              // .27
  patient_evaluation: EmsValue;            // .28
  crew_disposition: EmsValue;              // .29
  transport_disposition: EmsValue;         // .30
  transport_method: EmsValue;              // .16
  transport_mode: EmsValue;                // .17
  transport_mode_descriptors: EmsValue[];  // .18
  acuity_at_release: EmsValue;             // .19
  destination_reasons: EmsValue[];         // .20
  destination_type: EmsValue;              // .21
  inpatient_destination: EmsValue;         // .22
  hospital_capability: EmsValue[];         // .23
  team_activation: { activation: EmsValue; datetime: EmsValue }[]; // .24/.25
  level_of_care: EmsValue;                 // .32
}

export interface EmsOutcome {
  ed_disposition: EmsValue;                // .01
  hospital_disposition: EmsValue;          // .02
  ed_procedures: { procedure: EmsValue; datetime: EmsValue }[]; // .09/.19
  ed_diagnoses: EmsValue[];                // .10
  ed_admit_datetime: EmsValue;             // .11
  hospital_procedures: { procedure: EmsValue; datetime: EmsValue }[]; // .12/.20
  hospital_diagnoses: EmsValue[];          // .13
  discharge_datetime: EmsValue;            // .16
  outcome_at_discharge: EmsValue;          // .18
}

/** Complete structured eRecord content, section by section. */
export interface EmsRecordData {
  record_id: string;
  response: EmsResponse;
  dispatch: EmsDispatch;
  times: EmsTimes;
  patient: EmsPatient;
  payment: EmsPayment;
  scene: EmsScene;
  situation: EmsSituation;
  injury: EmsInjury;
  arrest: EmsArrest;
  history: EmsHistory;
  vitals: EmsVitalGroup[];
  protocols: EmsProtocol[];
  medications: EmsMedicationGroup[];
  procedures: EmsProcedureGroup[];
  disposition: EmsDisposition;
  outcome: EmsOutcome;
}

// ── leaf helpers ─────────────────────────────────────────────────────

function v(tag: string, val: EmsValue | undefined, attrs: Record<string, string> | null = null): string {
  if (val === undefined) return "";
  if (typeof val === "object") {
    if ("pn" in val) {
      if (val.value !== undefined) return el(tag, { ...(attrs ?? {}), PN: val.pn }, val.value);
      return `<${tag} xsi:nil="true" PN="${xmlEscape(val.pn)}"/>`;
    }
    return `<${tag} xsi:nil="true" NV="${xmlEscape(val.nv)}"/>`;
  }
  return el(tag, attrs, val);
}
/** Wrap only when the group has content — groups absent from the data are omitted. */
const wrapIf = (tag: string, inner: string) => (inner ? wrap(tag, null, inner) : "");
const many = (tag: string, vals: Many) => (vals ?? []).map((x) => v(tag, x)).join("");
const n = (s: string, k: string) => `${s}.${k}`;

// ── sections ─────────────────────────────────────────────────────────

export function renderRecordSection(id: string, software: { name: string; version: string }): string {
  return wrap("eRecord", null,
    el("eRecord.01", null, id) +
    wrap("eRecord.SoftwareApplicationGroup", null,
      el("eRecord.02", null, software.name) +
      el("eRecord.03", null, software.name) +
      el("eRecord.04", null, software.version)));
}

function response(r: EmsResponse): string {
  const s = "eResponse";
  return wrap(s, null,
    wrapIf("eResponse.AgencyGroup", v(n(s, "01"), r.agency_number) + v(n(s, "02"), r.agency_name)) +
    v(n(s, "03"), r.incident_number) +
    v(n(s, "04"), r.response_number) +
    wrapIf("eResponse.ServiceGroup", v(n(s, "05"), r.type_of_service)) +
    v(n(s, "07"), r.unit_transport_capability) +
    many(n(s, "08"), r.dispatch_delays) + many(n(s, "09"), r.response_delays) +
    many(n(s, "10"), r.scene_delays) + many(n(s, "11"), r.transport_delays) +
    many(n(s, "12"), r.turnaround_delays) +
    v(n(s, "13"), r.vehicle_number) + v(n(s, "14"), r.call_sign) +
    v(n(s, "23"), r.response_mode) + many(n(s, "24"), r.response_mode_descriptors));
}

function times(t: EmsTimes): string {
  return wrap("eTimes", null, TIME_ORDER.map(([k, num]) => v(`eTimes.${num}`, t[k])).join(""));
}

function patient(p: EmsPatient): string {
  const s = "ePatient";
  const name = p.last_name !== undefined || p.first_name !== undefined
    ? wrap("ePatient.PatientNameGroup", null, v(n(s, "02"), p.last_name) + v(n(s, "03"), p.first_name))
    : "";
  return wrap(s, null,
    name + v(n(s, "07"), p.home_county) + v(n(s, "08"), p.home_state) + v(n(s, "09"), p.home_zip) +
    v(n(s, "13"), p.gender) + many(n(s, "14"), p.race) +
    wrapIf("ePatient.AgeGroup", v(n(s, "15"), p.age) + v(n(s, "16"), p.age_units)) +
    v(n(s, "17"), p.date_of_birth) + v(n(s, "25"), p.sex));
}

function payment(p: EmsPayment): string {
  const s = "ePayment";
  return wrap(s, null,
    v(n(s, "01"), p.primary_method) +
    (p.pcs_on_file !== undefined ? wrap("ePayment.CertificateGroup", null, v(n(s, "02"), p.pcs_on_file)) : "") +
    v(n(s, "08"), p.residency_status) + v(n(s, "40"), p.response_urgency) + v(n(s, "50"), p.cms_service_level));
}

function scene(c: EmsScene): string {
  const s = "eScene";
  return wrap(s, null,
    v(n(s, "01"), c.first_unit_on_scene) + v(n(s, "06"), c.patient_count) + v(n(s, "07"), c.mass_casualty) +
    v(n(s, "08"), c.triage_classification) + v(n(s, "09"), c.location_type) + v(n(s, "18"), c.census_tract) +
    v(n(s, "19"), c.zip) + v(n(s, "20"), c.cross_street) + v(n(s, "21"), c.county));
}

function situation(x: EmsSituation): string {
  const s = "eSituation";
  return wrap(s, null,
    v(n(s, "01"), x.symptom_onset) + v(n(s, "02"), x.possible_injury) +
    v(n(s, "07"), x.complaint_anatomic_location) + v(n(s, "08"), x.complaint_organ_system) +
    v(n(s, "09"), x.primary_symptom) + many(n(s, "10"), x.other_symptoms) +
    v(n(s, "11"), x.primary_impression) + many(n(s, "12"), x.secondary_impressions) +
    v(n(s, "13"), x.initial_acuity) + v(n(s, "18"), x.last_known_well) +
    v(n(s, "19"), x.chief_complaint_text) + v(n(s, "20"), x.reason_for_transfer));
}

function injury(i: EmsInjury): string {
  return wrap("eInjury", null,
    many("eInjury.01", i.cause) + many("eInjury.03", i.trauma_triage_high) + many("eInjury.04", i.trauma_triage_moderate));
}

function arrest(a: EmsArrest): string {
  const s = "eArrest";
  return wrap(s, null,
    v(n(s, "01"), a.cardiac_arrest) + v(n(s, "02"), a.etiology) + many(n(s, "03"), a.resuscitation_attempted) +
    many(n(s, "04"), a.witnessed_by) + v(n(s, "07"), a.aed_prior) + many(n(s, "09"), a.cpr_type) +
    v(n(s, "11"), a.first_rhythm) + many(n(s, "12"), a.rosc) + v(n(s, "14"), a.arrest_datetime) +
    v(n(s, "16"), a.reason_cpr_discontinued) + many(n(s, "17"), a.rhythm_at_destination) +
    v(n(s, "18"), a.end_of_event) + v(n(s, "20"), a.who_first_cpr) + v(n(s, "21"), a.who_first_aed) +
    v(n(s, "22"), a.who_first_defib));
}

function history(h: EmsHistory): string {
  const s = "eHistory";
  return wrap(s, null,
    many(n(s, "01"), h.barriers_to_care) + many(n(s, "06"), h.allergies) + many(n(s, "08"), h.medical_history) +
    v(n(s, "16"), h.emergency_info_form) + many(n(s, "17"), h.alcohol_drug_indicators));
}

function vitals(groups: EmsVitalGroup[]): string {
  const s = "eVitals";
  return wrap(s, null, groups.map((g) => wrap("eVitals.VitalGroup", null,
    v(n(s, "01"), g.datetime) + v(n(s, "02"), g.prior_to_care) +
    wrapIf("eVitals.CardiacRhythmGroup",
      many(n(s, "03"), g.cardiac_rhythm) + v(n(s, "04"), g.ecg_type) + many(n(s, "05"), g.interpretation_method)) +
    wrapIf("eVitals.BloodPressureGroup", v(n(s, "06"), g.sbp) + v(n(s, "07"), g.dbp)) +
    wrapIf("eVitals.HeartRateGroup", v(n(s, "10"), g.heart_rate)) +
    v(n(s, "12"), g.spo2) + v(n(s, "14"), g.respiratory_rate) +
    (g.etco2 ? v(n(s, "16"), g.etco2.value, g.etco2.type ? { ETCO2Type: g.etco2.type } : null) : "") +
    v(n(s, "18"), g.glucose) +
    wrapIf("eVitals.GlasgowScoreGroup",
      v(n(s, "19"), g.gcs_eye) + v(n(s, "20"), g.gcs_verbal) + v(n(s, "21"), g.gcs_motor) +
      many(n(s, "22"), g.gcs_qualifiers)) +
    v(n(s, "26"), g.avpu) +
    wrapIf("eVitals.PainScaleGroup", v(n(s, "27"), g.pain_score)) +
    wrapIf("eVitals.StrokeScaleGroup", v(n(s, "29"), g.stroke_scale_result) + v(n(s, "30"), g.stroke_scale_type)) +
    v(n(s, "31"), g.reperfusion_checklist),
  )).join(""));
}

function protocols(ps: EmsProtocol[]): string {
  return wrap("eProtocols", null, ps.map((p) => wrap("eProtocols.ProtocolGroup", null,
    v("eProtocols.01", p.protocol) + v("eProtocols.02", p.age_category))).join(""));
}

function medications(ms: EmsMedicationGroup[]): string {
  const s = "eMedications";
  return wrap(s, null, ms.map((m) => wrap("eMedications.MedicationGroup", null,
    v(n(s, "01"), m.datetime) + v(n(s, "02"), m.prior_to_care) +
    v(n(s, "03"), m.medication.code, m.medication.code_type ? { CodeType: m.medication.code_type } : null) +
    v(n(s, "04"), m.route) +
    wrapIf("eMedications.DosageGroup", v(n(s, "05"), m.dose) + v(n(s, "06"), m.dose_unit)) +
    v(n(s, "07"), m.response) + many(n(s, "08"), m.complications) +
    v(n(s, "09"), m.crew_member_id) + v(n(s, "10"), m.crew_role),
  )).join(""));
}

function procedures(ps: EmsProcedureGroup[]): string {
  const s = "eProcedures";
  return wrap(s, null, ps.map((p) => wrap("eProcedures.ProcedureGroup", null,
    v(n(s, "01"), p.datetime) + v(n(s, "02"), p.prior_to_care) + v(n(s, "03"), p.procedure) +
    v(n(s, "04"), p.device_size) + v(n(s, "05"), p.attempts) + v(n(s, "06"), p.successful) +
    many(n(s, "07"), p.complications) + v(n(s, "08"), p.response) +
    v(n(s, "09"), p.crew_member_id) + v(n(s, "10"), p.crew_role),
  )).join(""));
}

function disposition(d: EmsDisposition): string {
  const s = "eDisposition";
  const dest = d.destination;
  return wrap(s, null,
    wrapIf("eDisposition.DestinationGroup",
      v(n(s, "01"), dest.name) + v(n(s, "02"), dest.code) + v(n(s, "03"), dest.street) + v(n(s, "04"), dest.city) +
      v(n(s, "05"), dest.state) + v(n(s, "06"), dest.county) + v(n(s, "07"), dest.zip)) +
    wrapIf("eDisposition.IncidentDispositionGroup",
      v(n(s, "27"), d.unit_disposition) + v(n(s, "28"), d.patient_evaluation) +
      v(n(s, "29"), d.crew_disposition) + v(n(s, "30"), d.transport_disposition)) +
    v(n(s, "16"), d.transport_method) + v(n(s, "17"), d.transport_mode) +
    many(n(s, "18"), d.transport_mode_descriptors) + v(n(s, "19"), d.acuity_at_release) +
    many(n(s, "20"), d.destination_reasons) + v(n(s, "21"), d.destination_type) +
    v(n(s, "22"), d.inpatient_destination) + many(n(s, "23"), d.hospital_capability) +
    d.team_activation.map((t) => wrap("eDisposition.HospitalTeamActivationGroup", null,
      v(n(s, "24"), t.activation) + v(n(s, "25"), t.datetime))).join("") +
    v(n(s, "32"), d.level_of_care));
}

function outcome(o: EmsOutcome): string {
  const s = "eOutcome";
  return wrap(s, null,
    v(n(s, "01"), o.ed_disposition) + v(n(s, "02"), o.hospital_disposition) +
    o.ed_procedures.map((p) => wrap("eOutcome.EmergencyDepartmentProceduresGroup", null,
      v(n(s, "09"), p.procedure) + v(n(s, "19"), p.datetime))).join("") +
    many(n(s, "10"), o.ed_diagnoses) + v(n(s, "11"), o.ed_admit_datetime) +
    o.hospital_procedures.map((p) => wrap("eOutcome.HospitalProceduresGroup", null,
      v(n(s, "12"), p.procedure) + v(n(s, "20"), p.datetime))).join("") +
    many(n(s, "13"), o.hospital_diagnoses) + v(n(s, "16"), o.discharge_datetime) +
    v(n(s, "18"), o.outcome_at_discharge));
}

/** All PatientCareReport sections after eRecord, in XSD sequence order. */
export function renderEmsSections(d: EmsRecordData): string {
  return [
    response(d.response),
    wrap("eDispatch", null, v("eDispatch.01", d.dispatch.complaint) + v("eDispatch.02", d.dispatch.emd_performed)),
    times(d.times),
    patient(d.patient),
    payment(d.payment),
    scene(d.scene),
    situation(d.situation),
    injury(d.injury),
    arrest(d.arrest),
    history(d.history),
    vitals(d.vitals),
    protocols(d.protocols),
    medications(d.medications),
    procedures(d.procedures),
    disposition(d.disposition),
    outcome(d.outcome),
  ].join("");
}
