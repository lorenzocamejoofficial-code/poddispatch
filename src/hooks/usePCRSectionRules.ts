/**
 * Central PCR Section Rules — single source of truth for section state per pcr_type.
 * States: "required" | "optional" | "locked"
 */

export type PCRSectionState = "required" | "optional" | "locked";

export type PCRSectionKey =
  | "patient_info"
  | "times"
  | "vitals"
  | "assessment"
  | "medical_history"
  | "medical_necessity"
  | "esrd_dialysis"
  | "sending_facility"
  | "isolation_precautions"
  | "stretcher_placement"
  | "patient_mobility"
  | "signatures"
  | "receiving_facility_confirmation"
  | "narrative"
  | "billing"
  | "condition_on_arrival"
  | "equipment"
  | "physical_exam"
  | "hospital_outcome"
  | "chief_complaint"
  | "airway"
  | "procedures"
  | "medications"
  | "iv_access"
  | "behavioral_health";

export type PCRType = "dialysis" | "ift" | "discharge" | "outpatient_specialty" | "private_pay" | "emergency" | "wound_care" | "psych_transport";

// Map of card types to section keys for rules lookup
const CARD_TO_SECTION: Record<string, PCRSectionKey> = {
  patient_info: "patient_info",
  times: "times",
  vitals: "vitals",
  condition_on_arrival: "condition_on_arrival",
  medical_necessity: "medical_necessity",
  equipment: "equipment",
  signatures: "signatures",
  narrative: "narrative",
  billing: "billing",
  sending_facility: "sending_facility",
  assessment: "assessment",
  chief_complaint: "assessment",
  physical_exam: "physical_exam",
  hospital_outcome: "hospital_outcome",
  airway: "airway",
  procedures: "procedures",
  medications: "medications",
  iv_access: "iv_access",
  behavioral_health: "behavioral_health",
};

const RULES: Record<PCRType, Partial<Record<PCRSectionKey, PCRSectionState>>> = {
  dialysis: {
    patient_info: "required",
    times: "required",
    vitals: "required",
    assessment: "required",
    medical_history: "required",
    medical_necessity: "required",
    esrd_dialysis: "required",
    sending_facility: "locked",
    isolation_precautions: "required",
    stretcher_placement: "required",
    patient_mobility: "required",
    signatures: "required",
    receiving_facility_confirmation: "required",
    narrative: "required",
    billing: "required",
    condition_on_arrival: "required",
    equipment: "optional",
    physical_exam: "optional",
    hospital_outcome: "locked",
    chief_complaint: "required",
    airway: "locked",
    procedures: "locked",
    medications: "locked",
    iv_access: "locked",
  },
  ift: {
    patient_info: "required",
    times: "required",
    vitals: "required",
    assessment: "required",
    medical_history: "required",
    medical_necessity: "required",
    esrd_dialysis: "locked",
    sending_facility: "required",
    isolation_precautions: "required",
    stretcher_placement: "required",
    patient_mobility: "required",
    signatures: "required",
    receiving_facility_confirmation: "required",
    narrative: "required",
    billing: "required",
    condition_on_arrival: "required",
    equipment: "required",
    physical_exam: "required",
    hospital_outcome: "required",
    chief_complaint: "required",
    airway: "optional",
    procedures: "optional",
    medications: "optional",
    iv_access: "optional",
  },
  discharge: {
    patient_info: "required",
    times: "required",
    vitals: "required",
    assessment: "required",
    medical_history: "required",
    medical_necessity: "required",
    esrd_dialysis: "locked",
    sending_facility: "required",
    isolation_precautions: "optional",
    stretcher_placement: "required",
    patient_mobility: "required",
    signatures: "required",
    receiving_facility_confirmation: "optional",
    narrative: "required",
    billing: "required",
    condition_on_arrival: "required",
    equipment: "required",
    physical_exam: "required",
    hospital_outcome: "optional",
    chief_complaint: "required",
    airway: "locked",
    procedures: "locked",
    medications: "locked",
    iv_access: "locked",
  },
  outpatient_specialty: {
    patient_info: "required",
    times: "required",
    vitals: "required",
    assessment: "required",
    medical_history: "required",
    medical_necessity: "required",
    esrd_dialysis: "locked",
    sending_facility: "optional",
    isolation_precautions: "optional",
    stretcher_placement: "required",
    patient_mobility: "required",
    signatures: "required",
    receiving_facility_confirmation: "required",
    narrative: "required",
    billing: "required",
    condition_on_arrival: "required",
    equipment: "optional",
    physical_exam: "optional",
    hospital_outcome: "optional",
    chief_complaint: "required",
    airway: "locked",
    procedures: "locked",
    medications: "locked",
    iv_access: "locked",
  },
  private_pay: {
    patient_info: "required",
    times: "required",
    vitals: "optional",
    assessment: "required",
    medical_history: "optional",
    medical_necessity: "optional",
    esrd_dialysis: "locked",
    sending_facility: "locked",
    isolation_precautions: "optional",
    stretcher_placement: "required",
    patient_mobility: "required",
    signatures: "required",
    receiving_facility_confirmation: "optional",
    narrative: "optional",
    billing: "required",
    condition_on_arrival: "optional",
    equipment: "optional",
    physical_exam: "locked",
    hospital_outcome: "locked",
    chief_complaint: "required",
    airway: "locked",
    procedures: "locked",
    medications: "locked",
    iv_access: "locked",
  },
  emergency: {
    patient_info: "required",
    times: "required",
    vitals: "required",
    assessment: "required",
    medical_history: "required",
    medical_necessity: "required",
    esrd_dialysis: "locked",
    sending_facility: "optional",
    isolation_precautions: "required",
    stretcher_placement: "required",
    patient_mobility: "required",
    signatures: "required",
    receiving_facility_confirmation: "optional",
    narrative: "required",
    billing: "required",
    condition_on_arrival: "required",
    equipment: "required",
    physical_exam: "required",
    hospital_outcome: "required",
    chief_complaint: "required",
    airway: "required",
    procedures: "required",
    medications: "required",
    iv_access: "required",
  },
  wound_care: {
    patient_info: "required",
    times: "required",
    vitals: "required",
    assessment: "required",
    medical_history: "required",
    medical_necessity: "required",
    esrd_dialysis: "locked",
    sending_facility: "locked",
    isolation_precautions: "optional",
    stretcher_placement: "required",
    patient_mobility: "required",
    signatures: "required",
    receiving_facility_confirmation: "optional",
    narrative: "required",
    billing: "required",
    condition_on_arrival: "required",
    equipment: "required",
    physical_exam: "optional",
    hospital_outcome: "locked",
    chief_complaint: "required",
    airway: "locked",
    procedures: "locked",
    medications: "locked",
    iv_access: "locked",
  },
  psych_transport: {
    patient_info: "required",
    times: "required",
    vitals: "required",
    assessment: "required",
    medical_history: "optional",
    medical_necessity: "required",
    esrd_dialysis: "locked",
    sending_facility: "optional",
    isolation_precautions: "optional",
    stretcher_placement: "required",
    patient_mobility: "required",
    signatures: "required",
    receiving_facility_confirmation: "optional",
    narrative: "required",
    billing: "required",
    condition_on_arrival: "required",
    equipment: "required",
    physical_exam: "optional",
    hospital_outcome: "locked",
    chief_complaint: "required",
    airway: "locked",
    procedures: "locked",
    medications: "locked",
    iv_access: "locked",
    behavioral_health: "required",
  },
};

const LOCKED_REASONS: Partial<Record<PCRSectionKey, string>> = {
  esrd_dialysis: "Not applicable for this transport type",
  sending_facility: "Not applicable — no sending facility for this transport",
  isolation_precautions: "Not applicable for this transport type",
  airway: "Airway interventions not applicable for this transport type",
  procedures: "Procedures not applicable for this transport type",
  medications: "Medications not applicable for this transport type",
  iv_access: "IV access not applicable for this transport type",
  hospital_outcome: "Hospital outcome not applicable for this transport type",
  physical_exam: "Physical exam not applicable for this transport type",
  // Defaults for others (shouldn't normally be locked)
  patient_info: "",
  times: "",
  vitals: "",
  assessment: "",
  medical_history: "",
  medical_necessity: "",
  stretcher_placement: "",
  patient_mobility: "",
  signatures: "",
  receiving_facility_confirmation: "",
  narrative: "",
  billing: "",
  condition_on_arrival: "",
  equipment: "",
  chief_complaint: "",
};

function normalizePCRType(raw: string | null | undefined): PCRType {
  if (!raw) return "dialysis";
  const t = raw.toLowerCase().trim();
  if (t.includes("psych") || t.includes("behavioral")) return "psych_transport";
  if (t === "ift" || t === "ift_discharge") return "ift";
  if (t === "discharge") return "discharge";
  if (t === "outpatient_specialty" || t === "outpatient") return "outpatient_specialty";
  if (t === "private_pay") return "private_pay";
  if (t === "emergency" || t === "complex") return "emergency";
  if (t.includes("wound")) return "wound_care";
  return "dialysis";
}

export interface PCRSectionRule {
  state: PCRSectionState;
  lockedReason: string;
}

export function usePCRSectionRules(pcrType: string | null | undefined) {
  const type = normalizePCRType(pcrType);
  const rules = RULES[type];

  /** Get rule for a section key */
  const getRule = (sectionKey: PCRSectionKey): PCRSectionRule => ({
    state: rules[sectionKey] || "optional",
    lockedReason: rules[sectionKey] === "locked" ? (LOCKED_REASONS[sectionKey] || "Not applicable for this transport type") : "",
  });

  /** Get rule for a PCR card type (maps card type to section key) */
  const getCardRule = (cardType: string): PCRSectionRule => {
    const sectionKey = CARD_TO_SECTION[cardType] || (cardType as PCRSectionKey);
    return getRule(sectionKey);
  };

  /** Check if a card type is required for submission */
  const isRequired = (cardType: string): boolean => getCardRule(cardType).state === "required";

  /** Check if a card type is locked */
  const isLocked = (cardType: string): boolean => getCardRule(cardType).state === "locked";

  return { type, rules, getRule, getCardRule, isRequired, isLocked };
}
