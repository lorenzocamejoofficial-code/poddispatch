/**
 * NPI Luhn checksum validation.
 *
 * Per NPPES spec, the 10-digit NPI's last digit is a Luhn check digit computed
 * over the prefix "80840" + first 9 digits of the NPI. See:
 *   https://www.cms.gov/Regulations-and-Guidance/Administrative-Simplification/NationalProvIdentStand/Downloads/NPIcheckdigit.pdf
 *
 * Returns true only for a syntactically well-formed (10 digits) NPI whose
 * 10th digit matches the Luhn check digit of "80840" + first 9 digits.
 */
export function isValidNpi(npi: string | null | undefined): boolean {
  if (!npi) return false;
  const clean = String(npi).trim();
  if (!/^\d{10}$/.test(clean)) return false;

  // CMS-mandated prefix per the NPI check-digit spec.
  const full = "80840" + clean.slice(0, 9);
  const digits = full.split("").map((d) => parseInt(d, 10));

  // Standard Luhn: from the rightmost digit working left, double every
  // second digit; if doubling yields >9 subtract 9. Sum all digits, and
  // the result must be a multiple of 10.
  let sum = 0;
  // The check digit position is the rightmost of the full 14-char string.
  // We append the actual 10th NPI digit as the check digit and verify mod 10.
  const checkDigit = parseInt(clean[9], 10);
  // Process the 14 prefix+first-9 digits, doubling alternates starting from
  // the rightmost (which becomes the position immediately left of the check).
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i];
    // Distance from the (yet-to-be-appended) check digit position.
    const fromCheck = digits.length - i; // 1, 2, 3...
    if (fromCheck % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const computedCheck = (10 - (sum % 10)) % 10;
  return computedCheck === checkDigit;
}

export const NPI_INVALID_MESSAGE =
  "NPI checksum invalid, verify the number against the physician's NPPES record.";
