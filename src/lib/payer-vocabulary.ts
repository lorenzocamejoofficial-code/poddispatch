/**
 * Payer vocabulary — ONE canonical language for payer classes.
 * ------------------------------------------------------------
 * The billing pipeline (charge_master seeding, payer_billing_rules, the
 * claim trigger) has always used these five keys:
 *
 *   medicare | medicaid | private | self_pay | default
 *
 * Older UI surfaces used "cash" and "facility", which fell through to the
 * $0 `default` rate and silently underbilled. This module is the single
 * place that maps any historical spelling onto a canonical key, so charts,
 * charge master, compliance rules and claims all speak the same language.
 *
 * NOTE: this is a *payer class* vocabulary only. It never touches HCPCS,
 * modifiers, 837P content or NEMSIS/GEMSIS element values.
 */

export const PAYER_KEYS = ["medicare", "medicaid", "private", "self_pay", "default"] as const;
export type PayerKey = (typeof PAYER_KEYS)[number];

export const PAYER_LABELS: Record<PayerKey, string> = {
  medicare: "Medicare",
  medicaid: "Medicaid",
  private: "Private / Commercial / Facility contract",
  self_pay: "Self-pay / Private pay",
  default: "Default (fallback rate)",
};

/** Options for patient charts — no "default", that's a rate-table fallback only. */
export const PATIENT_PAYER_KEYS: PayerKey[] = ["medicare", "medicaid", "private", "self_pay"];

const ALIASES: Record<string, PayerKey> = {
  cash: "self_pay",
  selfpay: "self_pay",
  "self-pay": "self_pay",
  self: "self_pay",
  private_pay: "self_pay",
  "private pay": "self_pay",
  patient: "self_pay",
  facility: "private",
  commercial: "private",
  insurance: "private",
  other: "default",
  "": "default",
};

/** Normalize any stored/entered payer string to a canonical key. */
export function normalizePayerKey(value: string | null | undefined): PayerKey {
  const raw = String(value ?? "").toLowerCase().trim();
  if ((PAYER_KEYS as readonly string[]).includes(raw)) return raw as PayerKey;
  if (ALIASES[raw]) return ALIASES[raw];
  if (raw.includes("medicaid")) return "medicaid";
  if (raw.includes("medicare")) return "medicare";
  if (raw.includes("self") || raw.includes("cash")) return "self_pay";
  return "default";
}

export function payerLabel(value: string | null | undefined): string {
  return PAYER_LABELS[normalizePayerKey(value)];
}

/**
 * Self-pay / private-pay is billed directly to the patient — it is never
 * transmitted to a clearinghouse or to Medicare/Medicaid.
 */
export function isNonInsurancePayer(value: string | null | undefined): boolean {
  return normalizePayerKey(value) === "self_pay";
}
