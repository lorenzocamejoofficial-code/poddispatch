/**
 * PCR Field-Level Requirements — maps transport type to required fields per section.
 * Used for visual red/green indicators and completion summaries.
 * Derived from billing gates, payer rules, and section rules.
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

const NARRATIVE_FIELDS: FieldRequirement[] = [
  { field: "narrative", label: "Narrative", section: "narrative", check: (t) => hasValue(t.narrative) },
];

const ASSESSMENT_FIELDS: FieldRequirement[] = [
  { field: "chief_complaint", label: "Chief Complaint", section: "assessment", check: (t) => hasValue(t.chief_complaint) },
  { field: "primary_impression", label: "Primary Impression", section: "assessment", check: (t) => hasValue(t.primary_impression) },
];

const SENDING_FACILITY_FIELDS: FieldRequirement[] = [
  { field: "facility_name", label: "Facility Name", section: "sending_facility", check: (t) => hasValue(t.sending_facility_json?.facility_name) },
  { field: "pcs_attached", label: "PCS Obtained", section: "sending_facility", check: (t) => !!t.pcs_attached },
];

const PHYSICAL_EXAM_FIELDS: FieldRequirement[] = [
  { field: "physical_exam", label: "Physical Exam (≥1 system)", section: "physical_exam", check: (t) => {
    const pe = t.physical_exam_json || {};
    return Object.keys(pe).some((k: string) => (pe[k]?.findings || []).length > 0);
  }},
];

const HOSPITAL_OUTCOME_FIELDS: FieldRequirement[] = [
  { field: "disposition", label: "Disposition", section: "hospital_outcome", check: (t) => hasValue(t.disposition) },
  { field: "hospital_outcome_destination", label: "Hospital Outcome Destination", section: "hospital_outcome", check: (t) => {
    const ho = t.hospital_outcome_json || {};
    return hasValue(ho.destination) || hasValue(ho.hospital_name) || hasValue(t.disposition);
  }},
];

const EQUIPMENT_FIELDS: FieldRequirement[] = [
  { field: "equipment", label: "Equipment Documented", section: "equipment", check: (t) => {
    const eq = t.equipment_used_json || {};
    return Object.values(eq).some((v: any) => !!v);
  }},
];

// ── Transport type → required fields map ──

type TransportType = "dialysis" | "ift" | "ift_discharge" | "discharge" | "outpatient" | "outpatient_specialty" | "wound_care" | "emergency" | "private_pay";

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
    ...SIGNATURE_FIELDS,
    ...NARRATIVE_FIELDS,
    ...ASSESSMENT_FIELDS.filter(f => f.field === "chief_complaint"),
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
    ...SENDING_FACILITY_FIELDS,
    ...CONDITION_FIELDS,
    ...SIGNATURE_FIELDS,
    ...NARRATIVE_FIELDS,
  ],
  discharge: [
    ...TIMES_FIELDS,
    ...VITALS_FIELDS,
    ...ASSESSMENT_FIELDS,
    ...PHYSICAL_EXAM_FIELDS,
    ...STRETCHER_FIELDS,
    ...EQUIPMENT_FIELDS,
    ...SENDING_FACILITY_FIELDS,
    ...SIGNATURE_FIELDS,
    ...NARRATIVE_FIELDS,
  ],
  emergency: [
    ...TIMES_FIELDS,
    ...VITALS_FIELDS,
    ...ASSESSMENT_FIELDS,
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
};

function normalizeTransportKey(tripType: string | null | undefined): TransportType {
  if (!tripType) return "dialysis";
  const t = tripType.toLowerCase();
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

export interface PCRCompletionResult {
  totalRequired: number;
  completedRequired: number;
  fields: (FieldRequirement & { completed: boolean })[];
  bySection: Record<string, { total: number; completed: number; fields: (FieldRequirement & { completed: boolean })[] }>;
}

export function evaluatePCRFieldCompletion(trip: any): PCRCompletionResult {
  const transportType = normalizeTransportKey(trip?.trip_type || trip?.pcr_type);
  const requirements = REQUIREMENTS[transportType] || REQUIREMENTS.dialysis;

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

/** Check if a specific field is required for the current transport type */
export function isFieldRequired(tripType: string | null | undefined, fieldName: string): boolean {
  const transportType = normalizeTransportKey(tripType);
  const requirements = REQUIREMENTS[transportType] || REQUIREMENTS.dialysis;
  return requirements.some(r => r.field === fieldName);
}
