// Safe Handling & Readiness Engine — Crew-Sex-Based Safety Matrix
// Evaluates bariatric patient status against crew sex composition + truck equipment

export type SafetyStatus = "OK" | "WARNING" | "BLOCKED";

export interface SafetyEvaluation {
  status: SafetyStatus;
  reasons: string[];
}

export interface PatientNeeds {
  weight_lbs?: number | null;
  mobility?: string | null;
  stairs_required?: string | null;
  stair_chair_required?: boolean | null;
  oxygen_required?: boolean | null;
  oxygen_lpm?: number | null;
  special_equipment_required?: string | null;
  bariatric?: boolean | null;
}

export interface CrewCapability {
  member1?: {
    sex?: string | null; // "M" | "F"
    stair_chair_trained?: boolean;
    bariatric_trained?: boolean;
    oxygen_handling_trained?: boolean;
    lift_assist_ok?: boolean;
  } | null;
  member2?: {
    sex?: string | null;
    stair_chair_trained?: boolean;
    bariatric_trained?: boolean;
    oxygen_handling_trained?: boolean;
    lift_assist_ok?: boolean;
  } | null;
}

export interface TruckEquipment {
  /** Combined Power Stretcher / Bariatric Stretcher — GA ground ambulance standard */
  has_power_stretcher?: boolean;
  has_stair_chair?: boolean;
  has_oxygen_mount?: boolean;
  /** @deprecated kept for backward compat — use has_power_stretcher instead */
  has_bariatric_kit?: boolean;
  /** @deprecated kept for backward compat — use has_power_stretcher instead */
  has_bariatric_stretcher?: boolean;
}

export function deriveWeightClass(weight: number | null | undefined): string {
  if (!weight) return "unknown";
  if (weight < 200) return "<200";
  if (weight < 250) return "200-249";
  if (weight < 300) return "250-299";
  if (weight < 350) return "300-349";
  return "350+";
}

/**
 * Derive crew sex composition: "MM" | "MF" | "FF" | "unknown"
 */
function getCrewSexComposition(crew: CrewCapability): "MM" | "MF" | "FF" | "unknown" {
  const s1 = crew.member1?.sex?.toUpperCase() ?? null;
  const s2 = crew.member2?.sex?.toUpperCase() ?? null;

  // If no crew assigned at all, return unknown
  if (!s1 && !s2) return "unknown";

  // Single-member crew: treat the solo member's sex as the composition
  const sexes = [s1, s2].filter(Boolean).sort() as string[];
  if (sexes.length === 0) return "unknown";
  if (sexes.length === 1) {
    // Solo crew: treat as same-sex pair for safety purposes
    return sexes[0] === "M" ? "MM" : "FF";
  }

  if (sexes[0] === "F" && sexes[1] === "F") return "FF";
  if (sexes[0] === "M" && sexes[1] === "M") return "MM";
  return "MF"; // one M one F
}

export function evaluateSafetyRules(
  patient: PatientNeeds,
  crew: CrewCapability,
  truck: TruckEquipment
): SafetyEvaluation {
  const reasons: string[] = [];
  let status: SafetyStatus = "OK";

  const hasPowerStretcher = truck.has_power_stretcher ?? false;
  const isBariatric = patient.bariatric === true || (patient.weight_lbs != null && patient.weight_lbs >= 300);

  // ── PRIMARY MATRIX: Bariatric patient safety ──
  if (isBariatric) {
    const sexComp = getCrewSexComposition(crew);

    switch (sexComp) {
      case "MM":
        if (hasPowerStretcher) {
          // SAFE — no issues
        } else {
          reasons.push("Bariatric patient, power stretcher recommended");
          status = "WARNING";
        }
        break;

      case "MF":
        if (hasPowerStretcher) {
          reasons.push("Mixed crew with bariatric patient, monitor");
          status = "WARNING";
        } else {
          reasons.push("Bariatric patient requires power stretcher with mixed crew");
          status = "BLOCKED";
        }
        break;

      case "FF":
        if (hasPowerStretcher) {
          reasons.push("Bariatric patient, manual rescue risk with all-female crew");
          status = "WARNING";
        } else {
          reasons.push("Bariatric patient cannot be safely transported by all-female crew without power stretcher");
          status = "BLOCKED";
        }
        break;

      case "unknown":
        // No crew assigned yet — warn that crew is needed for bariatric eval
        reasons.push("Bariatric patient — assign crew to evaluate safety");
        if (status === "OK") status = "WARNING";
        break;
    }
  }

  // ── Oxygen checks (kept from original — not crew-sex dependent) ──
  if (patient.oxygen_required) {
    if (!truck.has_oxygen_mount) {
      reasons.push("Patient requires oxygen but truck has no oxygen mount");
      status = "BLOCKED";
    }
  }

  // ── Stair chair checks (kept — equipment-based) ──
  if (patient.stairs_required === "full_flight" || patient.stair_chair_required) {
    if (!truck.has_stair_chair) {
      reasons.push("Stairs required but no stair chair on truck");
      if (status === "OK") status = "WARNING";
    }
  }

  return { status, reasons };
}

// Check if patient needs are fully captured
export function hasCompletePatientNeeds(patient: PatientNeeds): { complete: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!patient.weight_lbs) missing.push("Weight");
  if (!patient.mobility || patient.mobility === "") missing.push("Mobility type");
  if (!patient.stairs_required || patient.stairs_required === "unknown") missing.push("Stairs info");
  if (patient.oxygen_required === null || patient.oxygen_required === undefined) missing.push("Oxygen status");
  return { complete: missing.length === 0, missing };
}

// PCR type-based required fields
export type PcrType = "nemt_dialysis" | "ift_discharge" | "emergency_ems" | "other";

export interface PcrRequiredFields {
  field: string;
  label: string;
  required: boolean;
}

export function getPcrRequiredFields(pcrType: PcrType | null): PcrRequiredFields[] {
  const base: PcrRequiredFields[] = [
    { field: "loaded_miles", label: "Loaded miles", required: true },
    { field: "loaded_at", label: "Loaded timestamp", required: true },
    { field: "dropped_at", label: "Drop-off timestamp", required: true },
    { field: "dispatch_time", label: "Dispatch timestamp", required: true },
    { field: "origin_type", label: "Origin type", required: true },
    { field: "destination_type", label: "Destination type", required: true },
    { field: "signature_obtained", label: "Signature", required: true },
  ];

  switch (pcrType) {
    case "nemt_dialysis":
      return [
        ...base,
        { field: "pcs_attached", label: "PCS document", required: true },
        { field: "necessity_checklist", label: "Medical necessity flag", required: true },
        { field: "necessity_notes", label: "Clinical justification", required: true },
      ];
    case "ift_discharge":
      return [
        ...base,
        { field: "pcs_attached", label: "PCS document", required: true },
        { field: "necessity_checklist", label: "Medical necessity flag", required: true },
        { field: "clinical_note", label: "Discharge clinical note", required: true },
      ];
    case "emergency_ems":
      return [
        ...base,
        { field: "vitals", label: "Vitals captured", required: true },
        { field: "clinical_note", label: "Clinical narrative", required: true },
      ];
    case "other":
    default:
      return [
        ...base,
        { field: "pcs_attached", label: "PCS document", required: false },
        { field: "necessity_checklist", label: "Medical necessity flag", required: false },
      ];
  }
}
