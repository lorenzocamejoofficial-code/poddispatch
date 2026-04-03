export type DenialCategory =
  | "contractual"
  | "patient_responsibility"
  | "other"
  | "payer"
  | "correction_needed"
  | "resubmit"
  | "info";

export type TypicalResolution =
  | "fix_and_resubmit"
  | "appeal"
  | "bill_patient"
  | "bill_secondary"
  | "write_off"
  | "no_action";

export interface DenialTranslation {
  code: string;
  category: DenialCategory;
  plain_english_explanation: string;
  action_required: string;
  is_recoverable: boolean;
  typical_resolution: TypicalResolution;
}

const DENIAL_CODES: Record<string, DenialTranslation> = {
  // CO codes — Contractual Obligations
  "CO-4": {
    code: "CO-4",
    category: "correction_needed",
    plain_english_explanation: "The procedure code is inconsistent with the modifier.",
    action_required: "Fix the modifier or procedure code and resubmit.",
    is_recoverable: true,
    typical_resolution: "fix_and_resubmit",
  },
  "CO-5": {
    code: "CO-5",
    category: "correction_needed",
    plain_english_explanation: "The procedure code is inconsistent with the place of service.",
    action_required: "Verify that the origin and destination codes match the service type.",
    is_recoverable: true,
    typical_resolution: "fix_and_resubmit",
  },
  "CO-11": {
    code: "CO-11",
    category: "correction_needed",
    plain_english_explanation: "The diagnosis is inconsistent with the procedure.",
    action_required: "Review ICD-10 codes against the transport type.",
    is_recoverable: true,
    typical_resolution: "fix_and_resubmit",
  },
  "CO-15": {
    code: "CO-15",
    category: "resubmit",
    plain_english_explanation: "The authorization number is missing or invalid.",
    action_required: "Obtain a valid prior authorization before resubmitting.",
    is_recoverable: true,
    typical_resolution: "fix_and_resubmit",
  },
  "CO-16": {
    code: "CO-16",
    category: "correction_needed",
    plain_english_explanation: "Claim lacks information needed for adjudication.",
    action_required: "Review all required fields and complete any missing data.",
    is_recoverable: true,
    typical_resolution: "fix_and_resubmit",
  },
  "CO-18": {
    code: "CO-18",
    category: "other",
    plain_english_explanation: "Duplicate claim submitted.",
    action_required: "Verify this is not a duplicate and appeal if it is a unique service.",
    is_recoverable: true,
    typical_resolution: "appeal",
  },
  "CO-22": {
    code: "CO-22",
    category: "payer",
    plain_english_explanation: "This care may be covered by another payer.",
    action_required: "Bill the primary payer first before submitting to this payer.",
    is_recoverable: true,
    typical_resolution: "bill_secondary",
  },
  "CO-23": {
    code: "CO-23",
    category: "contractual",
    plain_english_explanation: "Payment adjusted because charges have been paid by another payer.",
    action_required: "Coordinate benefits and apply primary payment before billing secondary.",
    is_recoverable: true,
    typical_resolution: "bill_secondary",
  },
  "CO-26": {
    code: "CO-26",
    category: "payer",
    plain_english_explanation: "Expenses incurred prior to coverage.",
    action_required: "Verify patient eligibility was active on the date of service.",
    is_recoverable: true,
    typical_resolution: "fix_and_resubmit",
  },
  "CO-27": {
    code: "CO-27",
    category: "payer",
    plain_english_explanation: "Expenses incurred after coverage terminated.",
    action_required: "Verify patient eligibility and resubmit with correct dates.",
    is_recoverable: true,
    typical_resolution: "fix_and_resubmit",
  },
  "CO-29": {
    code: "CO-29",
    category: "resubmit",
    plain_english_explanation: "The time limit for filing has expired.",
    action_required: "Appeal with documentation showing timely filing was attempted.",
    is_recoverable: true,
    typical_resolution: "appeal",
  },
  "CO-31": {
    code: "CO-31",
    category: "correction_needed",
    plain_english_explanation: "Patient cannot be identified as our insured.",
    action_required: "Verify member ID and patient name and resubmit.",
    is_recoverable: true,
    typical_resolution: "fix_and_resubmit",
  },
  "CO-45": {
    code: "CO-45",
    category: "contractual",
    plain_english_explanation: "Charge exceeds fee schedule or maximum allowable.",
    action_required: "No action needed — this is a contractual adjustment. The allowed amount is what Medicare agreed to pay.",
    is_recoverable: false,
    typical_resolution: "no_action",
  },
  "CO-50": {
    code: "CO-50",
    category: "payer",
    plain_english_explanation: "Non-covered service — not deemed a medical necessity.",
    action_required: "Add medical necessity documentation and appeal.",
    is_recoverable: true,
    typical_resolution: "appeal",
  },
  "CO-55": {
    code: "CO-55",
    category: "correction_needed",
    plain_english_explanation: "Procedure code billed is not correct or valid for the date of service.",
    action_required: "Verify the HCPCS code is valid and current.",
    is_recoverable: true,
    typical_resolution: "fix_and_resubmit",
  },
  "CO-56": {
    code: "CO-56",
    category: "correction_needed",
    plain_english_explanation: "Procedure code billed is not correct or valid for the place of service.",
    action_required: "Verify origin and destination modifiers.",
    is_recoverable: true,
    typical_resolution: "fix_and_resubmit",
  },
  "CO-96": {
    code: "CO-96",
    category: "payer",
    plain_english_explanation: "Non-covered charge — this service is not covered by this payer under this patient's plan.",
    action_required: "Verify coverage and consider billing secondary or patient.",
    is_recoverable: false,
    typical_resolution: "bill_patient",
  },
  "CO-97": {
    code: "CO-97",
    category: "contractual",
    plain_english_explanation: "Payment is included in the allowance for another service.",
    action_required: "The mileage charge may be bundled with the base rate for short transports.",
    is_recoverable: false,
    typical_resolution: "write_off",
  },
  "CO-109": {
    code: "CO-109",
    category: "payer",
    plain_english_explanation: "Claim not covered by this payer.",
    action_required: "Verify the patient's primary payer and resubmit to the correct payer.",
    is_recoverable: true,
    typical_resolution: "fix_and_resubmit",
  },
  "CO-119": {
    code: "CO-119",
    category: "payer",
    plain_english_explanation: "Benefit maximum has been met.",
    action_required: "Patient has exhausted their covered transport benefit for this period.",
    is_recoverable: false,
    typical_resolution: "bill_patient",
  },
  "CO-167": {
    code: "CO-167",
    category: "correction_needed",
    plain_english_explanation: "This diagnosis is not covered.",
    action_required: "Review diagnosis codes and add supporting medical necessity documentation.",
    is_recoverable: true,
    typical_resolution: "appeal",
  },
  "CO-197": {
    code: "CO-197",
    category: "resubmit",
    plain_english_explanation: "Precertification or authorization absent.",
    action_required: "Obtain authorization and resubmit.",
    is_recoverable: true,
    typical_resolution: "fix_and_resubmit",
  },
  "CO-204": {
    code: "CO-204",
    category: "payer",
    plain_english_explanation: "Service not covered by this plan.",
    action_required: "Verify coverage and consider billing secondary or patient.",
    is_recoverable: false,
    typical_resolution: "bill_secondary",
  },

  // PR codes — Patient Responsibility
  "PR-1": {
    code: "PR-1",
    category: "patient_responsibility",
    plain_english_explanation: "Deductible amount.",
    action_required: "Patient owes this toward their annual deductible.",
    is_recoverable: false,
    typical_resolution: "bill_patient",
  },
  "PR-2": {
    code: "PR-2",
    category: "patient_responsibility",
    plain_english_explanation: "Coinsurance amount.",
    action_required: "Patient owes their standard coinsurance percentage.",
    is_recoverable: false,
    typical_resolution: "bill_patient",
  },
  "PR-3": {
    code: "PR-3",
    category: "patient_responsibility",
    plain_english_explanation: "Copayment amount.",
    action_required: "Patient owes their fixed copayment for this service.",
    is_recoverable: false,
    typical_resolution: "bill_patient",
  },
  "PR-26": {
    code: "PR-26",
    category: "patient_responsibility",
    plain_english_explanation: "Expenses incurred prior to coverage.",
    action_required: "Patient was not covered on this date.",
    is_recoverable: false,
    typical_resolution: "bill_patient",
  },
  "PR-27": {
    code: "PR-27",
    category: "patient_responsibility",
    plain_english_explanation: "Expenses incurred after coverage terminated.",
    action_required: "Patient coverage had ended.",
    is_recoverable: false,
    typical_resolution: "bill_patient",
  },
  "PR-96": {
    code: "PR-96",
    category: "patient_responsibility",
    plain_english_explanation: "Non-covered charge — patient responsibility.",
    action_required: "This service is not covered and patient may be billed.",
    is_recoverable: false,
    typical_resolution: "bill_patient",
  },

  // OA codes — Other Adjustments
  "OA-18": {
    code: "OA-18",
    category: "other",
    plain_english_explanation: "Duplicate claim — this claim was already processed.",
    action_required: "Verify the original claim was paid correctly. No resubmission needed.",
    is_recoverable: false,
    typical_resolution: "no_action",
  },
  "OA-23": {
    code: "OA-23",
    category: "other",
    plain_english_explanation: "Payment adjusted because charges have been paid by another payer.",
    action_required: "Coordination of benefits applied.",
    is_recoverable: false,
    typical_resolution: "no_action",
  },
  "OA-96": {
    code: "OA-96",
    category: "other",
    plain_english_explanation: "Non-covered charge — other adjustment.",
    action_required: "No additional billing is appropriate.",
    is_recoverable: false,
    typical_resolution: "write_off",
  },

  // N codes — Remittance Advice Remarks
  "N30": {
    code: "N30",
    category: "correction_needed",
    plain_english_explanation: "Patient cannot be identified as our insured.",
    action_required: "Verify member ID.",
    is_recoverable: true,
    typical_resolution: "fix_and_resubmit",
  },
  "N115": {
    code: "N115",
    category: "info",
    plain_english_explanation: "This decision was based on a Local Coverage Determination.",
    action_required: "Review the LCD for this service.",
    is_recoverable: true,
    typical_resolution: "appeal",
  },
  "N180": {
    code: "N180",
    category: "info",
    plain_english_explanation: "This payment reflects the correct code.",
    action_required: "No action needed.",
    is_recoverable: false,
    typical_resolution: "no_action",
  },
  "N210": {
    code: "N210",
    category: "info",
    plain_english_explanation: "You may appeal this decision.",
    action_required: "File an appeal within the required timeframe.",
    is_recoverable: true,
    typical_resolution: "appeal",
  },
  "N211": {
    code: "N211",
    category: "info",
    plain_english_explanation: "You may not appeal this decision.",
    action_required: "Write off the adjustment.",
    is_recoverable: false,
    typical_resolution: "write_off",
  },
  "N570": {
    code: "N570",
    category: "correction_needed",
    plain_english_explanation: "Missing or incomplete or invalid credentialing information.",
    action_required: "Verify provider enrollment is active.",
    is_recoverable: true,
    typical_resolution: "fix_and_resubmit",
  },
};

export const COMMON_AMBULANCE_DENIALS: string[] = [
  "CO-4",
  "CO-16",
  "CO-18",
  "CO-45",
  "CO-50",
  "CO-97",
  "CO-197",
  "PR-1",
  "PR-2",
  "PR-3",
];

export function getDenialTranslation(code: string): DenialTranslation | null {
  return DENIAL_CODES[code] ?? null;
}

export function getDenialsByCategory(category: DenialCategory): DenialTranslation[] {
  return Object.values(DENIAL_CODES).filter((d) => d.category === category);
}

export function isPatientResponsibility(code: string): boolean {
  const entry = DENIAL_CODES[code];
  return entry?.category === "patient_responsibility";
}

export function isRecoverable(code: string): boolean {
  return DENIAL_CODES[code]?.is_recoverable ?? false;
}

export function getActionRequired(code: string): string {
  return (
    DENIAL_CODES[code]?.action_required ??
    "Unrecognized denial code. Review the remittance advice for details."
  );
}

export function translateDenialCodes(codes: string[]): DenialTranslation[] {
  const seen = new Set<string>();
  const results: DenialTranslation[] = [];
  for (const code of codes) {
    const entry = DENIAL_CODES[code];
    if (entry && !seen.has(entry.plain_english_explanation)) {
      seen.add(entry.plain_english_explanation);
      results.push(entry);
    }
  }
  return results;
}
