/**
 * Ambulance origin/destination modifier resolver — SINGLE SOURCE OF TRUTH.
 *
 * Maps a location type string (+ optional facility metadata) to the single-
 * letter CMS ambulance modifier code used in the SV1 O/D pair (CMS Pub 100-04
 * Ch. 15 §30).
 *
 * Letters: D, E, G, H, I, J, N, P, R, S, X.
 *
 * Priority:
 *   1. facilityMeta.facility_type === 'dialysis':
 *        hospital_based → G
 *        freestanding   → J
 *        unknown / null → D   (preserves pre-pass-2 no-regression behavior)
 *   2. Fallback: substring match on the legacy `type` string.
 *
 * SINGLE-WRITER CONTRACT
 * ----------------------
 * This module is the canonical writer for the O/D pair that reaches every
 * downstream emitter:
 *   - src/lib/edi-837p-generator.ts   (SV1 modifier slot 1)
 *   - src/lib/claim-review-pdf.ts     (biller-review PDF)
 *   - src/lib/billing-utils.ts        (computeHcpcsCodes pre-claim)
 *
 * The DB function `public.derive_ambulance_modifier_letter` and the
 * `auto_create_claim_on_pcr_submit` trigger MIRROR these rules byte-for-byte
 * to pre-seed `claim_records.hcpcs_modifiers` at PCR submission. That value
 * is ADVISORY ONLY — it cannot reach the wire because both TS emitters
 * strip any persisted 2-letter location pair from `hcpcs_modifiers` and
 * recompute via this module before emission. Drift in the DB mirror
 * therefore cannot produce a divergent SV1 line. The TS module is the
 * source of truth; the DB trigger is a UI/back-stop seed.
 *
 * If you change rules here, sync the DB function in the next migration
 * (advisory parity), but understand that EDI/PDF output is governed solely
 * by this file.
 */

export type FacilityMetaForModifier = {
  facility_type?: string | null;
  dialysis_subtype?: string | null;
} | null | undefined;

/** Resolve a single-letter CMS ambulance origin/destination modifier code. */
export function locationTypeCode(
  type: string | null,
  facilityMeta?: FacilityMetaForModifier,
): string {
  if (facilityMeta?.facility_type === "dialysis") {
    if (facilityMeta.dialysis_subtype === "hospital_based") return "G";
    if (facilityMeta.dialysis_subtype === "freestanding") return "J";
    return "D"; // unknown / null — preserves no-regression behavior
  }
  if (!type || !type.trim()) {
    throw new Error(
      `ambulance-modifier: unmappable origin/destination type: ${JSON.stringify(type)} ` +
      `— upstream did not populate origin_type/destination_type.`
    );
  }
  const t = type.trim().toLowerCase();

  // Single-letter passthroughs (already CMS codes).
  if (/^[degghijnprsx]$/.test(t)) return t.toUpperCase();

  // E — Hospital emergency room (check BEFORE generic "hospital").
  if (t.includes("emergency room") || t.includes("hospital er") || t === "er") return "E";

  // G / J — explicit dialysis subtype strings (facilityMeta path already handled above).
  if (t.includes("hospital-based dialysis") || t.includes("hospital based dialysis")) return "G";
  if (t.includes("freestanding dialysis")) return "J";

  // D — Diagnostic/therapeutic site, incl. generic dialysis when subtype unknown.
  if (t.includes("dialysis") || t.includes("diagnostic") || t.includes("therapeutic")) return "D";

  // H — Hospital (general, inpatient, outpatient). Must come AFTER ER check.
  if (t.includes("hospital")) return "H";

  // N — Skilled nursing facility.
  if (t.includes("nursing") || t.includes("snf") || t.includes("skilled nursing")) return "N";

  // S — Scene of accident / acute event.
  if (t.includes("scene")) return "S";

  // P — Physician's office.
  if (t.includes("physician") || t.includes("doctor") || t.includes("clinic")) return "P";

  // X — Intermediate stop at a physician's office en route to hospital.
  if (t.includes("intermediate") && t.includes("physician")) return "X";

  // I — Site of transfer (intermediate stop, generic).
  if (t.includes("site of transfer") || t.includes("ift") || t.includes("intermediate")) return "I";

  // R — Residence and residence-equivalents.
  if (
    t.includes("residence") ||
    t.includes("home") ||
    t.includes("assisted living") ||
    t.includes("rehab") ||
    t.includes("apartment") ||
    t.includes("private")
  ) return "R";

  // No silent fallback. Loud failure mirrors NM109/SBR09 guards.
  throw new Error(
    `ambulance-modifier: unmappable origin/destination type: ${JSON.stringify(type)} ` +
    `— add an explicit mapping in locationTypeCode() to one of D/E/G/H/I/J/N/P/R/S/X.`
  );
}