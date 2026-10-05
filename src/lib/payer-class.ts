/**
 * Payer class — Axis 2 of the two-axis trip classification (who pays).
 * --------------------------------------------------------------------
 * Five classes (owner decision): medicare | medicaid | commercial | facility | self_pay.
 * `facility` = facility contract, billed by invoice at a contract rate.
 *
 * Stage 5: billing readers (transmission self-pay block, rate selection,
 * claim trigger) read payer_class. The SQL mirror normalize_payer_class
 * MUST match normalizePayerClass exactly (drift test enforces it).
 *
 * Money-safety rule: no self-pay spelling may ever normalize to null.
 * Unknown values return null — never a silent fallback.
 */

export const PAYER_CLASSES = ["medicare", "medicaid", "commercial", "facility", "self_pay"] as const;
export type PayerClass = (typeof PAYER_CLASSES)[number];

export const PAYER_CLASS_LABELS: Record<PayerClass, string> = {
  medicare: "Medicare",
  medicaid: "Medicaid",
  commercial: "Commercial / Private insurance",
  facility: "Facility contract",
  self_pay: "Self-pay / Private pay",
};

// Keys are separator-collapsed (spaces and hyphens -> "_").
const ALIASES: Record<string, PayerClass> = {
  medicare: "medicare",
  medicaid: "medicaid",
  self_pay: "self_pay",
  selfpay: "self_pay",
  self: "self_pay",
  cash: "self_pay",
  cash_payment: "self_pay",
  private_pay: "self_pay",
  patient: "self_pay",
  commercial: "commercial",
  private: "commercial", // legacy canonical "private" historically meant insurance
  insurance: "commercial",
  private_insurance: "commercial",
  facility: "facility",
  facility_contract: "facility",
  contract: "facility",
};

export function normalizePayerClass(value: string | null | undefined): PayerClass | null {
  const raw = String(value ?? "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (!raw) return null;
  if (ALIASES[raw]) return ALIASES[raw];
  if (raw.includes("medicaid")) return "medicaid";
  if (raw.includes("medicare")) return "medicare";
  if (raw.includes("self") || raw.includes("cash")) return "self_pay";
  return null;
}

/** True when any of the given payer values is self-pay (billed to the patient, never transmitted). */
export function isSelfPayClass(...values: (string | null | undefined)[]): boolean {
  return values.some((v) => normalizePayerClass(v) === "self_pay");
}

export interface RateRow { payer_type: string; base_rate?: number | null; mileage_rate?: number | null; [k: string]: any }
export type RateFlag = "missing_rate" | "no_payer" | null;

/**
 * Pick the charge-master row for a payer class. Mirrors the claim trigger:
 * - class present -> the row whose payer_type normalizes to that class; if none, NO
 *   fallback (rate null, flag "missing_rate").
 * - class null -> the "default" row, flagged "no_payer".
 */
export function selectRateForPayerClass<T extends RateRow>(rows: T[], payerClass: PayerClass | null): { rate: T | null; flag: RateFlag } {
  if (!payerClass) {
    const def = rows.find((r) => String(r.payer_type ?? "").toLowerCase().trim() === "default") ?? null;
    return { rate: def, flag: "no_payer" };
  }
  const rate = rows.find((r) => normalizePayerClass(r.payer_type) === payerClass) ?? null;
  return { rate, flag: rate ? null : "missing_rate" };
}

export function rateFlagMessage(flag: RateFlag, payerClass: PayerClass | null): string | null {
  if (flag === "missing_rate") return `No ${payerClass ? PAYER_CLASS_LABELS[payerClass] : ""} rate in the charge master — add one before billing.`;
  if (flag === "no_payer") return "No payer recorded on this trip or patient — priced at the default rate, needs review.";
  return null;
}
