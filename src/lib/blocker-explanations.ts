// Plain-language blocker explanations with fix action targets
// Maps blocker codes from trip_records.blockers[] to human-readable text

export interface BlockerExplanation {
  code: string;
  title: string;
  explanation: string;
  fixLabel: string;
  /** Route or action type: "pcr" | "patient" | "trip" */
  fixTarget: "pcr" | "patient" | "trip";
}

const BLOCKER_MAP: Record<string, Omit<BlockerExplanation, "code">> = {
  // PCS issues
  missing_pcs: {
    title: "Missing PCS",
    explanation:
      "Physician Certification Statement is missing or expired for this patient. Medicare requires an active PCS for recurring non-emergency transport. Upload a signed PCS form to the patient's document attachments.",
    fixLabel: "Open Patient Record",
    fixTarget: "patient",
  },
  pcs_missing_expired: {
    title: "PCS Missing or Expired",
    explanation:
      "Physician Certification Statement is missing or expired for this patient. Medicare requires an active PCS for recurring non-emergency transport. Upload a signed PCS form to the patient's document attachments.",
    fixLabel: "Open Patient Record",
    fixTarget: "patient",
  },

  // Medical necessity
  no_medical_necessity: {
    title: "No Medical Necessity",
    explanation:
      "No medical necessity criteria have been documented. At least one criterion must be checked in the PCR to support ambulance-level transport under Medicare guidelines.",
    fixLabel: "Open PCR",
    fixTarget: "pcr",
  },
  missing_medical_necessity: {
    title: "No Medical Necessity",
    explanation:
      "No medical necessity criteria have been documented. At least one criterion must be checked in the PCR to support ambulance-level transport under Medicare guidelines.",
    fixLabel: "Open PCR",
    fixTarget: "pcr",
  },

  // Signatures
  missing_signature: {
    title: "Missing Crew Signature",
    explanation:
      "The Patient Care Report has no crew signature. All assigned crew members must sign the PCR before this claim can be submitted.",
    fixLabel: "Open PCR",
    fixTarget: "pcr",
  },

  // Mileage
  missing_miles: {
    title: "Missing Loaded Miles",
    explanation:
      "Loaded mileage is not recorded. Medicare reimburses per loaded mile — this trip cannot be billed without documented mileage.",
    fixLabel: "Open PCR",
    fixTarget: "pcr",
  },
  missing_loaded_miles: {
    title: "Missing Loaded Miles",
    explanation:
      "Loaded mileage is not recorded. Medicare reimburses per loaded mile — this trip cannot be billed without documented mileage.",
    fixLabel: "Open PCR",
    fixTarget: "pcr",
  },

  // Odometer
  missing_odometers: {
    title: "Missing Odometer Readings",
    explanation:
      "Odometer readings at scene and destination are not recorded. These are required to support the mileage claim.",
    fixLabel: "Open PCR",
    fixTarget: "pcr",
  },

  // Timestamps
  missing_dispatch_time: {
    title: "Missing Dispatch Time",
    explanation:
      "One or more required transport timestamps are missing. Dispatch, At Scene, Left Scene, At Destination, and In Service times are all required for a complete claim.",
    fixLabel: "Open PCR",
    fixTarget: "pcr",
  },
  missing_at_scene_time: {
    title: "Missing At Scene Time",
    explanation:
      "One or more required transport timestamps are missing. Dispatch, At Scene, Left Scene, At Destination, and In Service times are all required for a complete claim.",
    fixLabel: "Open PCR",
    fixTarget: "pcr",
  },
  missing_left_scene_time: {
    title: "Missing Left Scene Time",
    explanation:
      "One or more required transport timestamps are missing. Dispatch, At Scene, Left Scene, At Destination, and In Service times are all required for a complete claim.",
    fixLabel: "Open PCR",
    fixTarget: "pcr",
  },
  missing_arrived_dropoff: {
    title: "Missing Arrival at Destination",
    explanation:
      "One or more required transport timestamps are missing. Dispatch, At Scene, Left Scene, At Destination, and In Service times are all required for a complete claim.",
    fixLabel: "Open PCR",
    fixTarget: "pcr",
  },
  missing_in_service_time: {
    title: "Missing In Service Time",
    explanation:
      "One or more required transport timestamps are missing. Dispatch, At Scene, Left Scene, At Destination, and In Service times are all required for a complete claim.",
    fixLabel: "Open PCR",
    fixTarget: "pcr",
  },
  missing_arrived_pickup_time: {
    title: "Missing Arrived Pickup Time",
    explanation:
      "One or more required transport timestamps are missing. Dispatch, At Scene, Left Scene, At Destination, and In Service times are all required for a complete claim.",
    fixLabel: "Open PCR",
    fixTarget: "pcr",
  },
  missing_arrived_dropoff_time: {
    title: "Missing Arrived Dropoff Time",
    explanation:
      "One or more required transport timestamps are missing. Dispatch, At Scene, Left Scene, At Destination, and In Service times are all required for a complete claim.",
    fixLabel: "Open PCR",
    fixTarget: "pcr",
  },

  // Auth issues
  missing_auth_number: {
    title: "Missing Prior Authorization",
    explanation:
      "Prior authorization is required for this payer but no authorization number is on file. Contact the payer to obtain authorization before submitting.",
    fixLabel: "Open Patient Record",
    fixTarget: "patient",
  },
  auth_expired: {
    title: "Authorization Expired",
    explanation:
      "The prior authorization on file has expired. Obtain a new authorization from the payer before submitting this claim.",
    fixLabel: "Open Patient Record",
    fixTarget: "patient",
  },
  auth_expiring_soon: {
    title: "Authorization Expiring Soon",
    explanation:
      "The prior authorization on file will expire within 7 days. Consider obtaining a renewed authorization from the payer.",
    fixLabel: "Open Patient Record",
    fixTarget: "patient",
  },

  // Coding
  invalid_origin_destination_combo: {
    title: "Invalid Origin/Destination Combo",
    explanation:
      "The HCPCS service code may not match the documented level of service. Review the service level selection and origin/destination types in the trip record.",
    fixLabel: "Edit Trip",
    fixTarget: "trip",
  },
  same_origin_destination_type: {
    title: "Same Origin and Destination Type",
    explanation:
      "Origin and destination are the same location type, which may trigger payer review. Verify the transport route is correct.",
    fixLabel: "Edit Trip",
    fixTarget: "trip",
  },
  invalid_service_level: {
    title: "Invalid Service Level",
    explanation:
      "The HCPCS service code may not match the documented level of service. Review the service level selection in the trip record.",
    fixLabel: "Edit Trip",
    fixTarget: "trip",
  },
  bariatric_service_level_mismatch: {
    title: "Bariatric Service Level Mismatch",
    explanation:
      "This bariatric patient is on BLS without a stretcher requirement. Review the service level and stretcher flags for accuracy.",
    fixLabel: "Edit Trip",
    fixTarget: "trip",
  },

  // Origin/dest
  missing_origin_type: {
    title: "Missing Origin Type",
    explanation:
      "The origin location type is not set. This determines the HCPCS modifier and is required for claim submission.",
    fixLabel: "Edit Trip",
    fixTarget: "trip",
  },
  missing_destination_type: {
    title: "Missing Destination Type",
    explanation:
      "The destination location type is not set. This determines the HCPCS modifier and is required for claim submission.",
    fixLabel: "Edit Trip",
    fixTarget: "trip",
  },

  // Other
  missing_patient_weight: {
    title: "Missing Patient Weight",
    explanation:
      "Patient weight is not recorded. This is needed for safety documentation and some payer requirements.",
    fixLabel: "Open Patient Record",
    fixTarget: "patient",
  },
  missing_oxygen_capture: {
    title: "Oxygen Not Documented",
    explanation:
      "This patient requires oxygen but oxygen during transport was not checked on the PCR.",
    fixLabel: "Open PCR",
    fixTarget: "pcr",
  },
  secondary_payer_present_needs_review: {
    title: "Secondary Payer Detected",
    explanation:
      "This patient has a secondary payer on file. Verify coordination of benefits before submitting.",
    fixLabel: "Open Patient Record",
    fixTarget: "patient",
  },
};

/**
 * Convert a raw blocker code string to a plain-language explanation.
 * Falls back to a generic explanation for unknown codes.
 */
export function getBlockerExplanation(code: string): BlockerExplanation {
  const mapped = BLOCKER_MAP[code];
  if (mapped) return { code, ...mapped };

  // Timestamp-related catch-all
  if (code.startsWith("missing_") && code.includes("time")) {
    return {
      code,
      title: "Missing Timestamp",
      explanation:
        "One or more required transport timestamps are missing. Dispatch, At Scene, Left Scene, At Destination, and In Service times are all required for a complete claim.",
      fixLabel: "Open PCR",
      fixTarget: "pcr",
    };
  }

  // Generic fallback
  return {
    code,
    title: code.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    explanation: `This item requires attention before the claim can be submitted: ${code.replace(/_/g, " ")}.`,
    fixLabel: "Review Trip",
    fixTarget: "trip",
  };
}

/**
 * Deduplicate explanations that share the same explanation text
 * (e.g., multiple missing timestamp codes collapse into one entry).
 */
export function getDeduplicatedExplanations(blockers: string[]): BlockerExplanation[] {
  const all = blockers.map(getBlockerExplanation);
  const seen = new Set<string>();
  const result: BlockerExplanation[] = [];

  for (const exp of all) {
    // Dedupe by explanation text to avoid showing the same message multiple times
    if (!seen.has(exp.explanation)) {
      seen.add(exp.explanation);
      result.push(exp);
    }
  }

  return result;
}
