// Safe Handling & Readiness Engine — Deterministic Rules Engine
// Evaluates patient needs vs crew capabilities + truck equipment

export type SafetyStatus = "OK" | "WARNING" | "BLOCKED";

export interface SafetyEvaluation {
  status: SafetyStatus;
  reasons: string[];
}

export interface PatientNeeds {
  weight_lbs?: number | null;
  mobility?: string | null; // ambulatory | wheelchair | stretcher | bedbound
  stairs_required?: string | null; // none | few_steps | full_flight | unknown
  stair_chair_required?: boolean | null;
  oxygen_required?: boolean | null;
  oxygen_lpm?: number | null;
  special_equipment_required?: string | null; // none | bariatric_stretcher | extra_crew | lift_assist | other
  bariatric?: boolean | null;
}

export interface CrewCapability {
  member1?: {
    max_safe_team_lift_lbs?: number;
    stair_chair_trained?: boolean;
    bariatric_trained?: boolean;
    oxygen_handling_trained?: boolean;
    lift_assist_ok?: boolean;
  } | null;
  member2?: {
    max_safe_team_lift_lbs?: number;
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

export function evaluateSafetyRules(
  patient: PatientNeeds,
  crew: CrewCapability,
  truck: TruckEquipment
): SafetyEvaluation {
  const reasons: string[] = [];
  let status: SafetyStatus = "OK";

  const weightClass = deriveWeightClass(patient.weight_lbs);
  const crewMaxLift = Math.min(
    crew.member1?.max_safe_team_lift_lbs ?? 250,
    crew.member2?.max_safe_team_lift_lbs ?? 250
  );

  // ── Weight-based checks ──
  if (weightClass === "350+" || (patient.weight_lbs && patient.weight_lbs >= 350)) {
    if (!truck.has_bariatric_kit) {
      reasons.push("Weight 350+ lbs without bariatric kit on truck");
      status = "BLOCKED";
    }
    if (!crew.member1?.bariatric_trained && !crew.member2?.bariatric_trained) {
      reasons.push("Weight 350+ lbs but crew not bariatric trained");
      status = "BLOCKED";
    }
  } else if (weightClass === "300-349" || (patient.weight_lbs && patient.weight_lbs >= 300)) {
    if (!truck.has_bariatric_kit) {
      reasons.push("Weight 300+ lbs — bariatric kit recommended");
      if (status === "OK") status = "WARNING";
    }
  }

  if (patient.weight_lbs && patient.weight_lbs > crewMaxLift) {
    reasons.push(`Patient ${patient.weight_lbs} lbs exceeds crew safe lift limit (${crewMaxLift} lbs)`);
    if (status === "OK") status = "WARNING";
  }

  // ── Mobility checks ──
  if (patient.mobility === "stretcher" || patient.mobility === "bedbound") {
    if (!truck.has_power_stretcher) {
      reasons.push("Stretcher/bedbound patient without power stretcher on truck");
      if (status === "OK") status = "WARNING";
    }
  }

  if (patient.mobility === "bedbound" && !truck.has_power_stretcher) {
    reasons.push("Bedbound patient — power stretcher required");
    status = "BLOCKED";
  }

  // ── Stairs checks ──
  if (patient.stairs_required === "full_flight" || patient.stair_chair_required) {
    if (!truck.has_stair_chair) {
      reasons.push("Stairs required but no stair chair on truck");
      if (status === "OK") status = "WARNING";
    }
    if (!crew.member1?.stair_chair_trained && !crew.member2?.stair_chair_trained) {
      reasons.push("Stairs required but crew not stair-chair trained");
      status = "BLOCKED";
    }
  } else if (patient.stairs_required === "few_steps") {
    if (!crew.member1?.stair_chair_trained && !crew.member2?.stair_chair_trained) {
      reasons.push("Steps at location — crew stair-chair training recommended");
      if (status === "OK") status = "WARNING";
    }
  }

  // ── Oxygen checks ──
  if (patient.oxygen_required) {
    if (!truck.has_oxygen_mount) {
      reasons.push("Patient requires oxygen but truck has no oxygen mount");
      status = "BLOCKED";
    }
    if (!crew.member1?.oxygen_handling_trained && !crew.member2?.oxygen_handling_trained) {
      reasons.push("Patient requires oxygen but crew not oxygen-handling trained");
      if (status === "OK") status = "WARNING";
    }
  }

  // ── Special equipment checks ──
  if (patient.special_equipment_required === "bariatric_stretcher") {
    if (!truck.has_bariatric_stretcher && !truck.has_bariatric_kit) {
      reasons.push("Bariatric stretcher required but truck lacks bariatric stretcher");
      status = "BLOCKED";
    }
  }
  // ── Bariatric patient with bariatric stretcher available clears weight-based blocks ──
  if ((patient.bariatric || (patient.weight_lbs && patient.weight_lbs >= 300)) && truck.has_bariatric_stretcher) {
    // Remove weight-related BLOCKED reasons if bariatric stretcher is available
    const weightBlockIdx = reasons.findIndex(r => r.includes("bariatric kit"));
    if (weightBlockIdx >= 0) {
      reasons.splice(weightBlockIdx, 1);
      // Recalculate status
      if (reasons.length === 0) status = "OK";
      else if (!reasons.some(r => status === "BLOCKED")) status = "WARNING";
    }
  }
  if (patient.special_equipment_required === "extra_crew") {
    const hasLiftAssist = crew.member1?.lift_assist_ok || crew.member2?.lift_assist_ok;
    if (!hasLiftAssist) {
      reasons.push("Extra crew needed — no lift-assist capable member assigned");
      if (status === "OK") status = "WARNING";
    }
  }
  if (patient.special_equipment_required === "lift_assist") {
    const hasLiftAssist = crew.member1?.lift_assist_ok || crew.member2?.lift_assist_ok;
    if (!hasLiftAssist) {
      reasons.push("Lift assist required — no lift-assist capable member assigned");
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
