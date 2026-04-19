/**
 * PCR Field-Level Requirements — single source of truth for what's required
 * per transport type AND per payer. Drives red/green dots in cards and
 * completion summaries.
 *
 * Two layers:
 *  1) Base transport-type requirements (REQUIREMENTS map)
 *  2) Payer augmentations (PAYER_AUGMENTATIONS) — Medicare/Medicaid/private add
 *     extra fields on top of the base.
 *
 * Helpers:
 *  - evaluatePCRFieldCompletion(trip, payer?)  — full completion result
 *  - getRequiredFieldsForCard(tripType, cardType, payer?) — array<string> of
 *    field names a card should treat as required (for the requiredFields prop)
 *  - isFieldRequired(tripType, fieldName, payer?) — boolean
 */

export interface FieldRequirement {
  field: string;
  label: string;
  section: string;
  check: (trip: any) => boolean;
}

function hasValue(v: any): boolean {
  if (v === null || v === undefined || v === "") return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

// ── Shared field definitions (reusable check functions) ──

const TIMES_FIELDS: FieldRequirement[] = [
  { field: "dispatch_time", label: "Dispatched", section: "times", check: (t) => !!t.dispatch_time },
  { field: "at_scene_time", label: "At Scene", section: "times", check: (t) => !!t.at_scene_time },
  { field: "patient_contact_time", label: "Patient Contact", section: "times", check: (t) => !!t.patient_contact_time },
  { field: "left_scene_time", label: "Left Scene", section: "times", check: (t) => !!t.left_scene_time },
  { field: "arrived_dropoff_at", label: "At Destination", section: "times", check: (t) => !!t.arrived_dropoff_at },
  { field: "in_service_time", label: "In Service", section: "times", check: (t) => !!t.in_service_time },
  { field: "loaded_miles", label: "Loaded Miles", section: "times", check: (t) => t.loaded_miles != null && t.loaded_miles >= 0 },
  { field: "origin_type", label: "Origin Type", section: "times", check: (t) => hasValue(t.origin_type) },
  { field: "destination_type", label: "Destination Type", section: "times", check: (t) => hasValue(t.destination_type) },
];

const ODOMETER_FIELDS: FieldRequirement[] = [
  { field: "odometer_at_scene", label: "Odometer at Scene", section: "times", check: (t) => t.odometer_at_scene != null },
  { field: "odometer_at_destination", label: "Odometer at Destination", section: "times", check: (t) => t.odometer_at_destination != null },
];

const VITALS_FIELDS: FieldRequirement[] = [
  { field: "vitals_saved", label: "Vitals Set Saved", section: "vitals", check: (t) => {
    const v = t.vitals_json;
    return Array.isArray(v) && v.some((vs: any) => !!vs.timestamp && vs.saved !== false);
  }},
];

const CONDITION_FIELDS: FieldRequirement[] = [
  { field: "level_of_consciousness", label: "Level of Consciousness", section: "condition_on_arrival", check: (t) => hasValue(t.level_of_consciousness) },
  { field: "skin_condition", label: "Skin Condition", section: "condition_on_arrival", check: (t) => hasValue(t.skin_condition) },
  { field: "condition_at_destination", label: "Condition at Destination", section: "condition_on_arrival", check: (t) => hasValue(t.condition_at_destination) },
];

const NECESSITY_FIELDS: FieldRequirement[] = [
  { field: "medical_necessity_reason", label: "Reason for Transport", section: "medical_necessity", check: (t) => hasValue(t.medical_necessity_reason) },
  { field: "necessity_checklist", label: "Necessity Criteria (≥1)", section: "medical_necessity", check: (t) =>
    !!(t.bed_confined || t.cannot_transfer_safely || t.requires_monitoring || t.oxygen_during_transport)
  },
];

const STRETCHER_FIELDS: FieldRequirement[] = [
  { field: "stretcher_placement", label: "Stretcher Placement", section: "stretcher_mobility", check: (t) => hasValue(t.stretcher_placement) },
  { field: "patient_mobility", label: "Patient Mobility", section: "stretcher_mobility", check: (t) => hasValue(t.patient_mobility) },
  { field: "patient_position", label: "Position During Transport", section: "stretcher_mobility", check: (t) => hasValue(t.patient_position) },
];

const ISOLATION_FIELDS: FieldRequirement[] = [
  { field: "isolation_status", label: "Isolation Status", section: "isolation_precautions", check: (t) => {
    const iso = t.isolation_precautions || {};
    return iso.status === "na" || iso.status === "none" || iso.required === false || iso.required === true;
  }},
];

const SIGNATURE_FIELDS: FieldRequirement[] = [
  { field: "signatures", label: "Signature Captured", section: "signatures", check: (t) => (t.signatures_json || []).length > 0 },
  { field: "signature_obtained", label: "Payment Auth Signature", section: "signatures", check: (t) => !!t.signature_obtained },
];

const CREW_SIGNATURE_FIELDS: FieldRequirement[] = [
  { field: "crew_signatures", label: "Crew Signature(s)", section: "signatures", check: (t) => {
    const sigs = t.signatures_json || [];
    return Array.isArray(sigs) && sigs.some((s: any) => String(s?.type || "").toLowerCase().includes("crew") || s?.signer_role === "crew");
  }},
  { field: "patient_signature", label: "Patient Signature", section: "signatures", check: (t) => {
    const sigs = t.signatures_json || [];
    return Array.isArray(sigs) && sigs.some((s: any) => String(s?.type || "").toLowerCase().includes("patient") || s?.signer_role === "patient");
  }},
];

const NARRATIVE_FIELDS: FieldRequirement[] = [
  { field: "narrative", label: "Narrative", section: "narrative", check: (t) => hasValue(t.narrative) },
];

const ASSESSMENT_FIELDS: FieldRequirement[] = [
  { field: "chief_complaint", label: "Chief Complaint", section: "assessment", check: (t) => hasValue(t.chief_complaint) },
  { field: "primary_impression", label: "Primary Impression", section: "assessment", check: (t) => hasValue(t.primary_impression) },
];

const ICD10_FIELD: FieldRequirement = {
  field: "icd10_codes", label: "ICD-10 Codes (≥1)", section: "assessment",
  check: (t) => Array.isArray(t.icd10_codes) && t.icd10_codes.length > 0,
};

const SENDING_FACILITY_FIELDS: FieldRequirement[] = [
  { field: "facility_name", label: "Facility Name", section: "sending_facility", check: (t) => hasValue(t.sending_facility_json?.facility_name) },
  { field: "pcs_attached", label: "PCS Obtained", section: "sending_facility", check: (t) => !!t.pcs_attached },
];

const SENDING_FACILITY_DISCHARGE_FIELDS: FieldRequirement[] = [
  { field: "facility_name", label: "Facility Name", section: "sending_facility", check: (t) => hasValue(t.sending_facility_json?.facility_name) },
  { field: "sending_physician_name", label: "Sending Physician", section: "sending_facility", check: (t) => hasValue(t.sending_facility_json?.physician_name) },
  { field: "discharge_reason", label: "Discharge Reason", section: "sending_facility", check: (t) => hasValue(t.sending_facility_json?.discharge_reason) },
];

const PHYSICAL_EXAM_FIELDS: FieldRequirement[] = [
  { field: "physical_exam", label: "Physical Exam (≥1 system)", section: "physical_exam", check: (t) => {
    const pe = t.physical_exam_json || {};
    return Object.keys(pe).some((k: string) => (pe[k]?.findings || []).length > 0);
  }},
];

const HOSPITAL_OUTCOME_FIELDS: FieldRequirement[] = [
  // Fix 6: disposition is canonically the top-level column on trip_records.
  // hospital_outcome_json.disposition is mirrored for display continuity but
  // the requirement check only looks at the top-level value.
  { field: "disposition", label: "Disposition", section: "hospital_outcome", check: (t) => hasValue(t.disposition) },
];

const EQUIPMENT_FIELDS: FieldRequirement[] = [
  { field: "equipment", label: "Equipment Documented", section: "equipment", check: (t) => {
    const eq = t.equipment_used_json || {};
    return Object.values(eq).some((v: any) => !!v);
  }},
];

// ── Behavioral health (psych_transport) ──

const BEHAVIORAL_HEALTH_FIELDS: FieldRequirement[] = [
  { field: "bh_authorization_type", label: "Transport Authorization Type", section: "behavioral_health",
    check: (t) => hasValue(t.bh_authorization_type) },
  { field: "bh_behavioral_assessment", label: "Behavioral Assessment", section: "behavioral_health",
    check: (t) => Array.isArray(t.bh_behavioral_assessment) && t.bh_behavioral_assessment.length > 0 },
];

/** Conditional fields added when transport is involuntary */
const BEHAVIORAL_HEALTH_INVOLUNTARY_FIELDS: FieldRequirement[] = [
  { field: "bh_1013_received", label: "1013 Form Received", section: "behavioral_health",
    check: (t) => t.bh_1013_received === true },
  { field: "bh_authorizing_facility", label: "Authorizing Facility", section: "behavioral_health",
    check: (t) => hasValue(t.bh_authorizing_facility) },
  { field: "bh_authorizing_physician_name", label: "Authorizing Physician", section: "behavioral_health",
    check: (t) => hasValue(t.bh_authorizing_physician_name) },
];

// ── Wound care specific ──
// Fix 5: wound fields are canonically stored as top-level columns on
// trip_records (wound_type, wound_location, wound_stage, wound_size).
// Legacy assessment_json / condition_on_arrival fallbacks have been removed.

const WOUND_CARE_FIELDS: FieldRequirement[] = [
  { field: "wound_type", label: "Wound Type", section: "assessment",
    check: (t) => hasValue(t.wound_type) },
  { field: "wound_location", label: "Wound Location", section: "assessment",
    check: (t) => hasValue(t.wound_location) },
  { field: "wound_stage_or_size", label: "Wound Stage / Size", section: "assessment",
    check: (t) => hasValue(t.wound_stage) || hasValue(t.wound_size) },
];

// ── Transport type → required fields map ──

export type TransportType =
  | "dialysis"
  | "ift"
  | "ift_discharge"
  | "discharge"
  | "outpatient"
  | "outpatient_specialty"
  | "wound_care"
  | "emergency"
  | "private_pay"
  | "psych_transport";

export type PayerType = "medicare" | "medicaid" | "private" | "private_pay" | "default";

const REQUIREMENTS: Record<TransportType, FieldRequirement[]> = {
  dialysis: [
    ...TIMES_FIELDS,
    ...VITALS_FIELDS,
    ...CONDITION_FIELDS,
    ...NECESSITY_FIELDS,
    ...STRETCHER_FIELDS,
    ...ISOLATION_FIELDS,
    ...SIGNATURE_FIELDS,
    ...NARRATIVE_FIELDS,
    ...ASSESSMENT_FIELDS.filter(f => f.field === "chief_complaint"),
  ],
  outpatient: [
    ...TIMES_FIELDS,
    ...VITALS_FIELDS,
    ...CONDITION_FIELDS,
    ...NECESSITY_FIELDS,
    ...STRETCHER_FIELDS,
    ...SIGNATURE_FIELDS,
    ...NARRATIVE_FIELDS,
    ...ASSESSMENT_FIELDS.filter(f => f.field === "chief_complaint"),
    ...EQUIPMENT_FIELDS,
  ],
  outpatient_specialty: [
    ...TIMES_FIELDS,
    ...VITALS_FIELDS,
    ...CONDITION_FIELDS,
    ...NECESSITY_FIELDS,
    ...STRETCHER_FIELDS,
    ...SIGNATURE_FIELDS,
    ...NARRATIVE_FIELDS,
    ...ASSESSMENT_FIELDS.filter(f => f.field === "chief_complaint"),
  ],
  wound_care: [
    ...TIMES_FIELDS,
    ...VITALS_FIELDS,
    ...CONDITION_FIELDS,
    ...NECESSITY_FIELDS,
    ...STRETCHER_FIELDS,
    ...EQUIPMENT_FIELDS,
    ...SIGNATURE_FIELDS,
    ...NARRATIVE_FIELDS,
    ...ASSESSMENT_FIELDS,
    ...WOUND_CARE_FIELDS,
  ],
  ift: [
    ...TIMES_FIELDS,
    ...VITALS_FIELDS,
    ...ASSESSMENT_FIELDS,
    ...PHYSICAL_EXAM_FIELDS,
    ...STRETCHER_FIELDS,
    ...ISOLATION_FIELDS,
    ...EQUIPMENT_FIELDS,
    ...HOSPITAL_OUTCOME_FIELDS,
    ...SENDING_FACILITY_FIELDS,
    ...SIGNATURE_FIELDS,
    ...NARRATIVE_FIELDS,
  ],
  ift_discharge: [
    ...TIMES_FIELDS,
    ...VITALS_FIELDS,
    ...ASSESSMENT_FIELDS,
    ...PHYSICAL_EXAM_FIELDS,
    ...STRETCHER_FIELDS,
    ...ISOLATION_FIELDS,
    ...EQUIPMENT_FIELDS,
    ...HOSPITAL_OUTCOME_FIELDS,
    ...SENDING_FACILITY_DISCHARGE_FIELDS,
    ...CONDITION_FIELDS,
    ...SIGNATURE_FIELDS,
    ...NARRATIVE_FIELDS,
  ],
  discharge: [
    ...TIMES_FIELDS,
    ...VITALS_FIELDS,
    ...ASSESSMENT_FIELDS,
    ...PHYSICAL_EXAM_FIELDS,
    ...CONDITION_FIELDS,
    ...NECESSITY_FIELDS,
    ...STRETCHER_FIELDS,
    ...EQUIPMENT_FIELDS,
    ...SENDING_FACILITY_DISCHARGE_FIELDS,
    ...HOSPITAL_OUTCOME_FIELDS,
    ...SIGNATURE_FIELDS,
    ...NARRATIVE_FIELDS,
  ],
  emergency: [
    ...TIMES_FIELDS,
    ...VITALS_FIELDS,
    ...ASSESSMENT_FIELDS,
    ICD10_FIELD,
    ...PHYSICAL_EXAM_FIELDS,
    ...CONDITION_FIELDS,
    ...STRETCHER_FIELDS,
    ...ISOLATION_FIELDS,
    ...EQUIPMENT_FIELDS,
    ...HOSPITAL_OUTCOME_FIELDS,
    ...SIGNATURE_FIELDS,
    ...NARRATIVE_FIELDS,
    ...NECESSITY_FIELDS,
  ],
  private_pay: [
    ...TIMES_FIELDS,
    ...STRETCHER_FIELDS,
    ...SIGNATURE_FIELDS,
    ...ASSESSMENT_FIELDS.filter(f => f.field === "chief_complaint"),
  ],
  psych_transport: [
    ...TIMES_FIELDS,
    ...ODOMETER_FIELDS,
    ...ASSESSMENT_FIELDS,
    ICD10_FIELD,
    ...NECESSITY_FIELDS,
    ...STRETCHER_FIELDS,
    ...BEHAVIORAL_HEALTH_FIELDS,
    ...CREW_SIGNATURE_FIELDS,
    ...NARRATIVE_FIELDS,
  ],
};

/** Returns the dynamic conditional field set for a transport type, given the
 * current trip state (e.g. involuntary psych adds 1013 fields). */
function getConditionalFields(transportType: TransportType, trip: any): FieldRequirement[] {
  if (transportType === "psych_transport") {
    const auth = String(trip?.bh_authorization_type ?? "").toLowerCase();
    if (auth.includes("involuntary")) return BEHAVIORAL_HEALTH_INVOLUNTARY_FIELDS;
  }
  return [];
}

// ── Payer-specific augmentations (item 7) ──

const PAYER_AUGMENTATIONS: Record<PayerType, FieldRequirement[]> = {
  medicare: [
    ICD10_FIELD,
    { field: "loaded_miles", label: "Loaded Miles (Medicare)", section: "times",
      check: (t) => t.loaded_miles != null && Number(t.loaded_miles) > 0 },
    { field: "medical_necessity_reason", label: "Medical Necessity Narrative (Medicare)", section: "medical_necessity",
      check: (t) => hasValue(t.medical_necessity_reason) || hasValue(t.necessity_notes) },
  ],
  medicaid: [
    { field: "member_id", label: "Member ID (Medicaid)", section: "billing",
      check: (t) => hasValue(t.patient?.member_id) || hasValue(t.member_id) },
    { field: "prior_authorization", label: "Prior Authorization (Medicaid)", section: "billing",
      check: (t) => {
        const required = !!(t.patient?.auth_required);
        if (!required) return true;
        return hasValue(t.patient?.prior_auth_number);
      }},
  ],
  private: [],
  private_pay: [],
  default: [],
};

function normalizePayer(payer: string | null | undefined): PayerType {
  if (!payer) return "default";
  const p = payer.toLowerCase().trim();
  if (p.includes("medicare")) return "medicare";
  if (p.includes("medicaid")) return "medicaid";
  if (p.includes("private_pay") || p === "self_pay" || p === "self-pay") return "private_pay";
  if (p.includes("private") || p.includes("commercial") || p.includes("bcbs") || p.includes("aetna") || p.includes("cigna") || p.includes("united")) return "private";
  return "default";
}

export function normalizeTransportKey(tripType: string | null | undefined): TransportType {
  if (!tripType) return "dialysis";
  const t = tripType.toLowerCase();
  if (t.includes("psych") || t.includes("behavioral")) return "psych_transport";
  if (t.includes("ift") && t.includes("discharge")) return "ift_discharge";
  if (t === "ift") return "ift";
  if (t === "discharge") return "discharge";
  if (t.includes("emergency") || t.includes("complex")) return "emergency";
  if (t.includes("outpatient_specialty")) return "outpatient_specialty";
  if (t.includes("outpatient") || t.includes("appointment")) return "outpatient";
  if (t.includes("wound")) return "wound_care";
  if (t.includes("private")) return "private_pay";
  return "dialysis";
}

/** De-duplicates by `field` keeping the first occurrence (base before augmentations). */
function dedupeByField(fields: FieldRequirement[]): FieldRequirement[] {
  const seen = new Set<string>();
  const out: FieldRequirement[] = [];
  for (const f of fields) {
    if (seen.has(f.field)) continue;
    seen.add(f.field);
    out.push(f);
  }
  return out;
}

export interface PCRCompletionResult {
  totalRequired: number;
  completedRequired: number;
  fields: (FieldRequirement & { completed: boolean })[];
  bySection: Record<string, { total: number; completed: number; fields: (FieldRequirement & { completed: boolean })[] }>;
}

export function evaluatePCRFieldCompletion(trip: any, payer?: string | null): PCRCompletionResult {
  const transportType = normalizeTransportKey(trip?.trip_type || trip?.pcr_type);
  const payerKey = normalizePayer(payer ?? trip?.patient?.primary_payer ?? trip?.payer_type);

  const base = REQUIREMENTS[transportType] || REQUIREMENTS.dialysis;
  const conditional = getConditionalFields(transportType, trip);
  const payerAdd = PAYER_AUGMENTATIONS[payerKey] || [];

  const requirements = dedupeByField([...base, ...conditional, ...payerAdd]);

  const fields = requirements.map(req => ({
    ...req,
    completed: req.check(trip),
  }));

  const bySection: Record<string, { total: number; completed: number; fields: (FieldRequirement & { completed: boolean })[] }> = {};
  for (const f of fields) {
    if (!bySection[f.section]) bySection[f.section] = { total: 0, completed: 0, fields: [] };
    bySection[f.section].total++;
    if (f.completed) bySection[f.section].completed++;
    bySection[f.section].fields.push(f);
  }

  return {
    totalRequired: fields.length,
    completedRequired: fields.filter(f => f.completed).length,
    fields,
    bySection,
  };
}

/** Check if a specific field is required for the current transport type + payer. */
export function isFieldRequired(tripType: string | null | undefined, fieldName: string, payer?: string | null): boolean {
  const transportType = normalizeTransportKey(tripType);
  const payerKey = normalizePayer(payer);
  const base = REQUIREMENTS[transportType] || REQUIREMENTS.dialysis;
  const payerAdd = PAYER_AUGMENTATIONS[payerKey] || [];
  return [...base, ...payerAdd].some(r => r.field === fieldName);
}

// ── Card → section mapping for the requiredFields prop helper ──

const CARD_TO_SECTIONS: Record<string, string[]> = {
  patient_info: ["patient_info"],
  times: ["times"],
  vitals: ["vitals"],
  condition_on_arrival: ["condition_on_arrival"],
  medical_necessity: ["medical_necessity"],
  equipment: ["equipment"],
  signatures: ["signatures"],
  narrative: ["narrative"],
  billing: ["billing"],
  sending_facility: ["sending_facility"],
  assessment: ["assessment"],
  chief_complaint: ["assessment"],
  physical_exam: ["physical_exam"],
  hospital_outcome: ["hospital_outcome"],
  stretcher_mobility: ["stretcher_mobility"],
  isolation_precautions: ["isolation_precautions"],
  behavioral_health: ["behavioral_health"],
};

/**
 * Returns the field-name array a given card should treat as required for the
 * current transport type + payer. Use this to pass into the `requiredFields`
 * prop so card defaults stay in sync with the central source.
 */
export function getRequiredFieldsForCard(
  tripType: string | null | undefined,
  cardType: string,
  payer?: string | null,
  trip?: any,
): string[] {
  const transportType = normalizeTransportKey(tripType);
  const payerKey = normalizePayer(payer);
  const sections = CARD_TO_SECTIONS[cardType] ?? [cardType];

  const base = REQUIREMENTS[transportType] || REQUIREMENTS.dialysis;
  const conditional = trip ? getConditionalFields(transportType, trip) : [];
  const payerAdd = PAYER_AUGMENTATIONS[payerKey] || [];

  const all = dedupeByField([...base, ...conditional, ...payerAdd]);
  return all.filter(f => sections.includes(f.section)).map(f => f.field);
}
