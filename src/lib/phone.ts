// Canonical phone storage: 10 digits only (US). Strips leading country-code "1"
// on 11-digit inputs. Non-US-length inputs pass through as raw digits so we
// don't destroy foreign numbers. Empty/undefined → null.
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, "");
  if (!digits) return null;
  const trimmed = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return trimmed;
}