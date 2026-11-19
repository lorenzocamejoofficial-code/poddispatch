/**
 * Medicare Beneficiary Identifier format check.
 *
 * CMS MBI format specification (CMS "Understanding the Medicare Beneficiary
 * Identifier (MBI) Format", New Medicare Card project): 11 characters,
 *   pos 1      numeric 1–9
 *   pos 2,5,8,9 alphabetic
 *   pos 3,6    alphanumeric
 *   pos 4,7,10,11 numeric 0–9
 * Letters S, L, O, I, B and Z are never used. Dashes shown on the card are
 * not part of the identifier and are ignored here.
 */
const A = "[AC-HJKMNP-RT-Y]";
const AN = "[AC-HJKMNP-RT-Y0-9]";
const MBI_RE = new RegExp(`^[1-9]${A}${AN}[0-9]${A}${AN}[0-9]${A}${A}[0-9]{2}$`);

export function normalizeMbi(value: string | null | undefined): string {
  return String(value ?? "").replace(/[\s-]/g, "").toUpperCase();
}

export function isValidMbi(value: string | null | undefined): boolean {
  return MBI_RE.test(normalizeMbi(value));
}
