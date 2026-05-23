/**
 * Payer-compliance helpers — applied at remittance (835) posting time.
 *
 * Two rules enforced here:
 *
 * 1. Medicaid (42 CFR §447.15): Medicaid payment + any required cost-share
 *    is "payment in full". Provider cannot balance-bill the patient. So
 *    when the primary payer is Medicaid, patient_responsibility MUST cap
 *    at $0 regardless of what CAS PR groups say on the 835.
 *
 * 2. Dual-eligible (Medicare primary + Medicaid secondary): same logic.
 *    Even though Medicare's ERA may report a PR coinsurance/deductible,
 *    the patient owes $0 because Medicaid will absorb it as the secondary.
 *    The PR amount is what the *secondary* should be billed for — it is
 *    NOT what the patient owes.
 *
 * For all other combinations (Medicare alone, private, self-pay) we leave
 * patient_responsibility untouched — that's the legitimate coinsurance +
 * deductible the patient does owe.
 */

export type PayerKind = "medicare" | "medicaid" | "private" | "self_pay" | "other" | null;

/** Loose classifier — works on either payer_type enums or freeform payer_name strings. */
export function classifyPayer(payerHint: string | null | undefined): PayerKind {
  if (!payerHint) return null;
  const s = String(payerHint).toLowerCase().trim();
  if (!s) return null;
  if (s.includes("medicaid") || s === "mcd" || s.includes("medi-cal") || s.includes("medical assistance")) return "medicaid";
  if (s.includes("medicare") || s === "mcr") return "medicare";
  if (s.includes("self") && s.includes("pay")) return "self_pay";
  if (s === "private" || s.includes("commercial") || s.includes("bcbs") || s.includes("blue cross") || s.includes("aetna") || s.includes("united") || s.includes("cigna") || s.includes("humana")) return "private";
  return "other";
}

export interface PRCapResult {
  capped: number;
  original: number;
  wasCapped: boolean;
  reason: string | null;
}

/**
 * Cap patient_responsibility based on payer rules.
 * @param rawPR        the PR amount the 835 reported
 * @param primaryPayer payer_type OR payer_name of primary
 * @param secondaryPayer optional — payer name/type of secondary on file
 */
export function capPatientResponsibility(
  rawPR: number,
  primaryPayer: string | null | undefined,
  secondaryPayer?: string | null | undefined,
): PRCapResult {
  const original = Number(rawPR) || 0;
  const primary = classifyPayer(primaryPayer);
  const secondary = classifyPayer(secondaryPayer);

  // Rule 1: Medicaid primary → patient owes $0.
  if (primary === "medicaid" && original > 0) {
    return {
      capped: 0,
      original,
      wasCapped: true,
      reason: "Medicaid primary — 42 CFR §447.15 prohibits balance-billing Medicaid patients.",
    };
  }

  // Rule 2: Dual-eligible (Medicare + Medicaid secondary) → patient owes $0,
  // remaining balance is the secondary's responsibility.
  if (primary === "medicare" && secondary === "medicaid" && original > 0) {
    return {
      capped: 0,
      original,
      wasCapped: true,
      reason: "Dual-eligible (Medicare primary, Medicaid secondary) — patient cannot be billed; route balance to Medicaid as secondary.",
    };
  }

  return { capped: original, original, wasCapped: false, reason: null };
}

/**
 * Returns true if writing off this claim would constitute waiving Medicare
 * coinsurance/deductible without documented hardship — an OIG/AKS risk.
 * Used to gate the AR Command Center "Write Off" button with a warning +
 * mandatory attestation.
 */
export function isMedicareCoinsuranceWriteOffRisk(claim: {
  payer_type?: string | null;
  payer_name?: string | null;
  status?: string | null;
  amount_paid?: number | null;
  total_charge?: number | null;
}): boolean {
  const payer = classifyPayer(claim.payer_type ?? claim.payer_name ?? null);
  if (payer !== "medicare") return false;
  // Only risky if Medicare actually paid something — i.e. the remaining
  // balance IS the patient's 20% coinsurance / unmet deductible.
  const paid = Number(claim.amount_paid) || 0;
  const charge = Number(claim.total_charge) || 0;
  return paid > 0 && charge > paid;
}