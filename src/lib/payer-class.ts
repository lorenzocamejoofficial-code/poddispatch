/**
 * Payer class — Axis 2 of the two-axis trip classification (who pays).
 * --------------------------------------------------------------------
 * Five classes (owner decision): medicare | medicaid | commercial | facility | self_pay.
 * `facility` = facility contract, billed by invoice at a contract rate; its
 * routing behavior arrives in the billing stage — for now it is only carried.
 *
 * Stage 0: not wired into any behavior. The existing billing vocabulary in
 * payer-vocabulary.ts is unchanged until the billing stage.
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

const ALIASES: Record<string, PayerClass> = {
  medicare: "medicare",
  medicaid: "medicaid",
  commercial: "commercial",
  private: "commercial", // legacy canonical "private" historically meant insurance
  insurance: "commercial",
  private_insurance: "commercial",
  facility: "facility",
  facility_contract: "facility",
  contract: "facility",
  self_pay: "self_pay",
  "self-pay": "self_pay",
  selfpay: "self_pay",
  self: "self_pay",
  cash: "self_pay",
  private_pay: "self_pay",
  "private pay": "self_pay",
  patient: "self_pay",
};

export function normalizePayerClass(value: string | null | undefined): PayerClass | null {
  const raw = String(value ?? "").toLowerCase().trim();
  if (!raw) return null;
  if (ALIASES[raw]) return ALIASES[raw];
  if (raw.includes("medicaid")) return "medicaid";
  if (raw.includes("medicare")) return "medicare";
  return null;
}
