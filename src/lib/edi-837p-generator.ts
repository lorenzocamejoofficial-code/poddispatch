/**
 * EDI 837P (Professional) Claim Generator
 * Generates ANSI X12 837P files for ambulance transport claims
 * Compatible with Office Ally and standard clearinghouses
 */

import { locationTypeCode } from "@/lib/ambulance-modifier";

export interface ClaimForEDI {
  claim_id: string;
  /** Source company / billing-provider key. Used by generateEDI837P to group
   *  claims into per-company ST/SE transaction sets and to look up the matching
   *  ProviderInfo from the providerInfoMap. For single-tenant batches every
   *  claim carries the same company_id. */
  company_id: string;
  patient_name: string; // "Last, First"
  patient_dob: string; // YYYY-MM-DD
  patient_sex: string | null; // M, F, or U
  patient_address: string;
  patient_city: string;
  patient_state: string;
  patient_zip: string;
  member_id: string;
  payer_name: string;
  payer_id: string;
  payer_type: string; // medicare, medicaid, commercial, etc.
  run_date: string; // YYYY-MM-DD
  hcpcs_codes: string[];
  hcpcs_modifiers: string[];
  total_charge: number;
  base_charge: number;
  mileage_charge: number;
  loaded_miles: number;
  origin_type: string | null;
  destination_type: string | null;
  origin_address: string | null;
  origin_city: string | null;
  origin_state: string | null;
  origin_zip: string | null;
  destination_address: string | null;
  destination_city: string | null;
  destination_state: string | null;
  destination_zip: string | null;
  diagnosis_codes: string[];
  auth_number: string | null;
  icd10_codes: string[];
  /** Facility metadata resolved by the caller (EDIExport.tsx) before calling
   *  generateEDI837P. When present, drives EDI origin/destination modifier
   *  selection in locationTypeCode() — required for accurate G/J emission on
   *  dialysis runs. null = facility not matched; generator falls back to
   *  substring matching on origin_type / destination_type.
   *  Pure JSON, no functions or promises — generator stays sync. */
  origin_facility_meta?: { facility_type: string; dialysis_subtype: string | null } | null;
  destination_facility_meta?: { facility_type: string; dialysis_subtype: string | null } | null;
  // Medical necessity / CRC fields
  bed_confined: boolean;
  requires_monitoring: boolean;
  stretcher_placement: string | null;
  oxygen_required: boolean;
  weight_lbs: number | null;
  // Facility names for 2310E/F loops
  pickup_facility_name: string | null;
  dropoff_facility_name: string | null;
  // PCS — Physician Certification Statement (biller-entered)
  pcs_physician_name?: string | null;
  pcs_physician_npi?: string | null;
  pcs_certification_date?: string | null; // YYYY-MM-DD
  pcs_diagnosis?: string | null;
  /** Patient-level PCS-on-file flag. When true, the generator REQUIRES a
   *  valid 10-digit pcs_physician_npi and will throw rather than silently
   *  omit the NM1*DK referring-provider segment. Per 42 CFR 410.40(d). */
  pcs_on_file?: boolean;
  /** Original dispatch reason / call complaint — what crew was sent for.
   *  Maps to claim_records.chief_complaint, which is captured at scheduling
   *  and carried into the PCR. Emitted as NTE*ADD on Loop 2300 so payers can
   *  reconcile dispatch context against on-scene findings. */
  chief_complaint?: string | null;
  /** On-scene primary impression — what crew found. Mirrors
   *  claim_records.primary_impression. Combined with chief_complaint to give
   *  Medicare reviewers full dispatch-to-assessment context. */
  primary_impression?: string | null;
  /** Free-text override when chief_complaint === "Other". Sourced from
   *  trip.assessment_json.chief_complaint_other. When present, the NTE
   *  segment emits this text instead of the literal "Other" so payer
   *  reviewers see a meaningful dispatch reason. */
  chief_complaint_other?: string | null;
  /** Free-text override when primary_impression === "Other". Sourced from
   *  trip.assessment_json.primary_impression_other. Same NTE rule applies. */
  primary_impression_other?: string | null;
  /** Coordination of Benefits (COB) data — present only when this claim is a
   *  secondary claim (claim_records.original_claim_id IS NOT NULL). When set,
   *  the generator emits Loop 2320 (Other Subscriber Information) +
   *  Loop 2330A (Other Subscriber Name) + Loop 2330B (Other Payer Name) per
   *  X12N 837P 5010. If a secondary claim is passed without `cob`, the
   *  generator throws — partial COB emission is rejected by clearinghouses. */
  cob?: ClaimCobInfo | null;
  /** X12 SBR09 claim filing indicator for the destination (primary) payer of
   *  THIS claim. Projected from payer_directory.claim_filing_indicator by
   *  resolvePayerForClaim() — see PayerResolution.claim_filing_indicator.
   *  The generator rejects any value not in VALID_FILING_INDICATORS. */
  claim_filing_indicator: string;
}

/** Coordination of Benefits — primary payer's adjudication context replayed
 *  into Loop 2320/2330 when emitting a secondary 837P claim. */
export interface ClaimCobInfo {
  /** SBR02 patient relationship to primary subscriber (X12 IL relationship).
   *  "18" = Self (the typical NEMT case where patient is the primary subscriber). */
  rel_code: string;
  /** SBR03 group / policy number on the primary plan. Empty string when N/A. */
  group_number: string;
  /** SBR04 group / plan name. Empty string when N/A. */
  group_name: string;
  /** SBR09 claim filing indicator for the PRIMARY payer. Must be projected
   *  from PayerResolution.claim_filing_indicator (see payer_directory). */
  claim_filing_indicator: string;
  /** AMT*D — total amount the primary actually paid (sum of claim_payments.amount). */
  paid_amount: number;
  /** DTP*573 — primary adjudication date, YYYY-MM-DD. Most recent payment date. */
  adjudication_date: string;
  /** CAS groups parsed from primary's 835. Each group emits one CAS segment
   *  (up to 6 adjustment triplets per segment per spec). */
  cas_groups: { group_code: string; adjustments: { reason_code: string; amount: number; quantity?: number }[] }[];
  /** Loop 2330A — primary subscriber identity (typically same as patient). */
  subscriber: {
    last: string; first: string; member_id: string;
    address: string; city: string; state: string; zip: string;
  };
  /** Loop 2330B — primary payer identity. */
  payer: { name: string; payer_id: string };
}

export interface ProviderInfo {
  npi: string;
  tax_id: string;
  organization_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

export interface SubmitterInfo {
  submitter_id: string;
  submitter_name: string;
  contact_name: string;
  contact_phone: string;
  /** Receiver ID (clearinghouse). Comes from vendor_clearinghouse_settings.receiver_id.
   *  Defaults to Office Ally's Tax ID ("330897513") when not supplied. */
  receiver_id?: string;
  /** Receiver Name (clearinghouse). Comes from vendor_clearinghouse_settings.receiver_name.
   *  Defaults to "OFFICE ALLY" when not supplied. */
  receiver_name?: string;
  /** ISA15 Usage Indicator: "P" = Production (default), "T" = Test (OATEST).
   *  When test_mode is enabled on vendor_clearinghouse_settings, set this to "T". */
  usage_indicator?: "P" | "T";
}

// Element separator, sub-element separator, segment terminator
const ES = "*";
const SE_SEP = ":";
const ST = "~";

function pad(value: string, length: number, char = " "): string {
  return value.padEnd(length, char).slice(0, length);
}

function padLeft(value: string, length: number, char = "0"): string {
  return value.padStart(length, char).slice(0, length);
}

function formatDate8(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

function formatTime4(): string {
  const now = new Date();
  return padLeft(String(now.getHours()), 2) + padLeft(String(now.getMinutes()), 2);
}

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

function controlNumber(): string {
  return padLeft(String(Math.floor(Math.random() * 999999999)), 9);
}

/** Generate a short human-readable claim reference from UUID and run date */
function shortClaimRef(claimId: string, runDate: string): string {
  const datePart = runDate.replace(/-/g, "").slice(2); // YYMMDD
  const idPart = claimId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `${datePart}-${idPart}`;
}

/** US state abbreviations for no-comma address parsing */
const US_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]);

/** Parse a single address string into street, city, state, ZIP.
 *  Handles formats:
 *    "123 Main St, Atlanta, GA 30301"  (comma-delimited)
 *    "123 Main St Atlanta GA 30301"    (no commas)
 *    "123 Main St, Atlanta GA 30301"   (partial commas)
 */
export function parseAddressString(addr: string | null | undefined): {
  street: string; city: string; state: string; zip: string;
} {
  const fallback = { street: "", city: "", state: "", zip: "" };
  if (!addr || !addr.trim()) return fallback;

  // === Comma-delimited formats ===
  // street, city, state ZIP
  const m1 = addr.match(/^(.+?),\s*(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  if (m1) return { street: m1[1].trim(), city: m1[2].trim(), state: m1[3].toUpperCase(), zip: m1[4] };

  // street, city, state (no ZIP)
  const m2 = addr.match(/^(.+?),\s*(.+?),\s*([A-Z]{2})$/i);
  if (m2) return { street: m2[1].trim(), city: m2[2].trim(), state: m2[3].toUpperCase(), zip: "" };

  // street, city state ZIP (comma after street only)
  const m3 = addr.match(/^(.+?),\s*(.+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  if (m3) return { street: m3[1].trim(), city: m3[2].trim(), state: m3[3].toUpperCase(), zip: m3[4] };

  // street, city state (comma after street, no ZIP)
  const m3b = addr.match(/^(.+?),\s*(.+?)\s+([A-Z]{2})$/i);
  if (m3b && US_STATES.has(m3b[3].toUpperCase())) {
    return { street: m3b[1].trim(), city: m3b[2].trim(), state: m3b[3].toUpperCase(), zip: "" };
  }

  // === No-comma format: "742 Evergreen Terrace Atlanta GA 30301" ===
  // Find state abbreviation + optional ZIP near the end
  const m4 = addr.match(/^(.+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  if (m4 && US_STATES.has(m4[2].toUpperCase())) {
    // m4[1] is "742 Evergreen Terrace Atlanta" — split street from city
    const prefix = m4[1].trim();
    const words = prefix.split(/\s+/);
    // City is the last word(s) before state; heuristic: last word is the city
    // Try to find the city by checking if the last 1-2 words form a known pattern
    // Simple approach: last word is city
    if (words.length >= 2) {
      // Check for two-word cities (e.g. "San Francisco", "New York")
      // Use the heuristic that street addresses start with a number
      const startsWithNumber = /^\d/.test(words[0]);
      if (startsWithNumber && words.length >= 3) {
        // Take the last word as city (most common case)
        const city = words[words.length - 1];
        const street = words.slice(0, -1).join(" ");
        return { street, city, state: m4[2].toUpperCase(), zip: m4[3] };
      }
      // No leading number — might be a facility name, put it all in street
      const city = words[words.length - 1];
      const street = words.slice(0, -1).join(" ");
      return { street, city, state: m4[2].toUpperCase(), zip: m4[3] };
    }
    return { street: prefix, city: "", state: m4[2].toUpperCase(), zip: m4[3] };
  }

  // No-comma, state only, no ZIP: "742 Evergreen Terrace Atlanta GA"
  const m5 = addr.match(/^(.+?)\s+([A-Z]{2})$/i);
  if (m5 && US_STATES.has(m5[2].toUpperCase())) {
    const prefix = m5[1].trim();
    const words = prefix.split(/\s+/);
    if (words.length >= 2) {
      const city = words[words.length - 1];
      const street = words.slice(0, -1).join(" ");
      return { street, city, state: m5[2].toUpperCase(), zip: "" };
    }
    return { street: prefix, city: "", state: m5[2].toUpperCase(), zip: "" };
  }

  // Fallback: put everything in street
  return { street: addr.trim(), city: "", state: "", zip: "" };
}

/** Extract facility name from a combined "FacilityName 123 Street City ST 00000" string.
 *  Returns everything before the first numeric token that starts the street address.
 *  If nothing precedes the number, returns the full string trimmed. */
export function extractFacilityName(location: string | null | undefined): string {
  if (!location || !location.trim()) return "";
  const trimmed = location.trim();
  // Find the first word that starts with a digit — that's where the street address begins
  const match = trimmed.match(/^(.*?)\s+(\d+\s+.*)$/);
  if (match && match[1].trim()) {
    return match[1].trim();
  }
  // No numeric token found — could be just a name like "Grady Memorial Hospital"
  // Check if it looks like a parseable address (has state+zip at end)
  const parsed = parseAddressString(trimmed);
  if (parsed.state && parsed.street) {
    // The whole thing is an address with no separate name prefix
    return "";
  }
  return trimmed;
}

/** Map location type codes to CMS ambulance origin/destination codes.
 *  Priority:
 *    1. facilityMeta.facility_type === 'dialysis' → G (hospital_based) /
 *       J (freestanding) / D (unknown or null subtype). This is the only
 *       reliable way to emit G or J — type strings never carry that info.
 *    2. Fallback: substring match on the legacy `type` string for non-dialysis
 *       location types (hospital, SNF, residence, etc.).
 *
 *  CANONICAL SOURCE for ambulance origin/dest letter resolution. Three other
 *  sites currently mirror this logic byte-for-byte:
 *    - src/lib/claim-review-pdf.ts        locationTypeCode()
 *    - src/lib/billing-utils.ts           locationModifierCode()
 *    - public.derive_ambulance_modifier_letter (DB function)
 *  TODO(refactor): export locationTypeCode() from this module and have the
 *  three sites above consume it directly, instead of maintaining four
 *  parallel copies. Until then, any change here must be replicated in all
 *  three mirrors in the same change. */
function locationTypeCode(
  type: string | null,
  facilityMeta?: { facility_type?: string | null; dialysis_subtype?: string | null } | null
): string {
  if (facilityMeta?.facility_type === "dialysis") {
    if (facilityMeta.dialysis_subtype === "hospital_based") return "G";
    if (facilityMeta.dialysis_subtype === "freestanding") return "J";
    return "D"; // unknown / null — preserves no-regression behavior
  }
  if (!type || !type.trim()) {
    throw new Error(
      `generateEDI837P: unmappable origin/destination type: ${JSON.stringify(type)} ` +
      `— upstream did not populate origin_type/destination_type on the claim envelope.`
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
    `generateEDI837P: unmappable origin/destination type: ${JSON.stringify(type)} ` +
    `— add an explicit mapping in locationTypeCode() to one of D/E/G/H/I/J/N/P/R/S/X.`
  );
}

/** X12 005010 SBR09 claim filing indicator code set (NEMT-relevant subset).
 *  Sourced from CMS Pub 100-04 and X12N 837P 5010 TR3. Mirrors the CHECK
 *  constraint on payer_directory.claim_filing_indicator. The generator NEVER
 *  derives this value — it must arrive pre-resolved from the directory via
 *  resolvePayerForClaim(). "ZZ" is a directory fallback flagged for biller
 *  review; emission is still permitted so we don't deadlock submission, but
 *  it should be treated as a data-quality bug. */
const VALID_FILING_INDICATORS = new Set([
  "MB", "MA", "MC", "CI", "16", "BL", "HM", "WC", "AM", "CH", "VA", "ZZ",
]);

/** Hardened guard: validate an SBR09 value before emitting it. Throws on any
 *  value not in the X12 005010 code list. Catches every silent-fallback bug
 *  class — empty strings, lowercase, payer_type strings ("medicare"), legacy
 *  invalid codes ("MD"), and "UNKNOWN" placeholders. */
function assertFilingIndicator(value: unknown, claimId: string, loop: string): string {
  const v = typeof value === "string" ? value : "";
  if (!VALID_FILING_INDICATORS.has(v)) {
    throw new Error(
      `generateEDI837P: claim ${claimId} ${loop} SBR09 rejected, got ${JSON.stringify(value)}, ` +
      `expected one of ${[...VALID_FILING_INDICATORS].join("/")}. ` +
      `This value must come from payer_directory.claim_filing_indicator via ` +
      `resolvePayerForClaim(), upstream did not project it onto the claim envelope.`
    );
  }
  return v;
}

/** Map patient sex to X12 DMG sex code */
function dmgSexCode(sex: string | null): string {
  if (!sex) return "U";
  const s = sex.toUpperCase();
  if (s === "M" || s === "MALE") return "M";
  if (s === "F" || s === "FEMALE") return "F";
  return "U";
}

/** Build dynamic CRC condition codes from medical necessity / transport fields.
 *  Spec-compliant CMS ambulance certification codes:
 *    01 — patient admitted to a hospital (destination = hospital inpatient/ER)
 *    04 — bed confined before AND after transport
 *    05 — bed confined before transport only
 *    06 — bed confined after transport only
 *    07 — transferred to a non-hospital facility (e.g. SNF, dialysis)
 *    08 — interfacility transport, patient is a hospital inpatient
 *    09 — patient moved by stretcher
 *  Oxygen is NOT a valid CRC certification condition and is intentionally omitted.
 */
function buildCrcCodes(claim: ClaimForEDI): string[] {
  const codes: string[] = [];
  const dest = (claim.destination_type || "").toLowerCase();
  const stretcher = (claim.stretcher_placement || "").toLowerCase();

  // 01 — admitted to hospital (destination is hospital, but not dialysis).
  // Hospital-based dialysis is now classified at the facility level, not
  // via destination_type substring, so we just exclude the "dialysis" path.
  if (dest.includes("hospital") && !dest.includes("dialysis")) {
    codes.push("01");
  }
  // 04 — bed confined before and after (we only track a single flag, treat as both)
  if (claim.bed_confined) codes.push("04");
  // 07 — transferred to non-hospital facility (SNF, dialysis, etc.)
  if (
    dest.includes("nursing") ||
    dest.includes("snf") ||
    dest.includes("dialysis") ||
    dest === "n" ||
    dest === "j" ||
    dest === "g"
  ) {
    codes.push("07");
  }
  // 09 — moved by stretcher
  if (stretcher && stretcher !== "ambulatory") codes.push("09");

  return [...new Set(codes)].slice(0, 4); // dedupe + cap at 4
}

/** Map ICD-10 + transport context to CR1-04 ambulance transport reason code (A–E).
 *    A — transported to nearest facility for care of symptoms (default)
 *    B — transported for benefit of preferred physician
 *    C — transported for nearness of family members
 *    D — transported for care of a specialist or specialized equipment
 *    E — other reason
 */
function buildCr1ReasonCode(claim: ClaimForEDI): string {
  const dest = (claim.destination_type || "").toLowerCase();
  // Dialysis = specialized equipment
  if (dest.includes("dialysis") || dest === "j" || dest === "g") return "D";
  return "A";
}

/** Timely filing limit in days by payer + state. */
export function timelyFilingDays(payerType: string | null, state: string | null): number {
  const t = (payerType || "").toLowerCase();
  const s = (state || "").toUpperCase();
  if (t === "medicaid" && s === "GA") return 180; // Georgia Medicaid: 6 months
  if (t === "medicare") return 365; // Medicare: 12 months
  if (t === "medicaid") return 365; // default Medicaid
  return 365;
}

function splitPatientName(fullName: string): { last: string; first: string } {
  if (fullName.includes(",")) {
    const [last, first] = fullName.split(",").map((s) => s.trim());
    return { last: last || "UNKNOWN", first: first || "UNKNOWN" };
  }
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return { last: parts[parts.length - 1], first: parts.slice(0, -1).join(" ") };
  }
  return { last: fullName || "UNKNOWN", first: "UNKNOWN" };
}

export function generateEDI837P(
  claims: ClaimForEDI[],
  providerInfoMap: Map<string, ProviderInfo> | Record<string, ProviderInfo>,
  submitterInfo: SubmitterInfo
): string {
  // Normalize input to a Map for uniform lookup.
  const providerMap: Map<string, ProviderInfo> = providerInfoMap instanceof Map
    ? providerInfoMap
    : new Map(Object.entries(providerInfoMap));

  // Group claims by company_id so each company emits its own ST/SE transaction
  // set wrapped in a single ISA/GS envelope. For single-tenant batches there's
  // exactly one group; multi-tenant batches emit one ST per company in selection
  // order (insertion-order-preserving).
  const claimsByCompany = new Map<string, ClaimForEDI[]>();
  for (const c of claims) {
    const key = c.company_id;
    if (!key) throw new Error(`generateEDI837P: claim ${c.claim_id} missing company_id`);
    if (!providerMap.has(key)) {
      throw new Error(`generateEDI837P: no ProviderInfo provided for company_id=${key} (claim ${c.claim_id})`);
    }
    const arr = claimsByCompany.get(key);
    if (arr) arr.push(c); else claimsByCompany.set(key, [c]);
  }

  const segments: string[] = [];
  const interchangeControlNum = controlNumber();
  const groupControlNum = controlNumber();
  const today = new Date();
  const dateStr = formatDate8(
    `${today.getFullYear()}-${padLeft(String(today.getMonth() + 1), 2)}-${padLeft(String(today.getDate()), 2)}`
  );
  const timeStr = formatTime4();

  // ISA - Interchange Control Header
  // Per Office Ally Companion Guide (table 7.1), ISA08 must be OA's Tax ID.
  // Defaults are Office Ally; vendor_clearinghouse_settings can override these
  // at runtime via SubmitterInfo.receiver_id / receiver_name. validateSubmitterInfo
  // will block export if neither the DB row nor the defaults yield a value.
  const OA_RECEIVER_ID = (submitterInfo.receiver_id && submitterInfo.receiver_id.trim()) || "330897513";
  const OA_RECEIVER_NAME = (submitterInfo.receiver_name && submitterInfo.receiver_name.trim()) || "OFFICE ALLY";
  const usageIndicator = submitterInfo.usage_indicator === "T" ? "T" : "P";
  segments.push(
    [
      "ISA",
      "00",                          // Auth Info Qualifier
      pad("", 10),                   // Auth Info
      "00",                          // Security Info Qualifier
      pad("", 10),                   // Security Info
      "ZZ",                          // Interchange Sender Qualifier
      pad(submitterInfo.submitter_id, 15), // Interchange Sender ID
      "ZZ",                          // Interchange Receiver Qualifier
      pad(OA_RECEIVER_ID, 15),      // Interchange Receiver ID (OA Tax ID per Companion Guide)
      dateStr.slice(2),              // Date (YYMMDD)
      timeStr,                       // Time (HHMM)
      "^",                           // Repetition Separator
      "00501",                       // Interchange Control Version
      padLeft(interchangeControlNum, 9), // Interchange Control Number
      "0",                           // Acknowledgment Requested
      usageIndicator,                // Usage Indicator (P=Production, T=Test/OATEST)
      SE_SEP,                        // Component Element Separator
    ].join(ES) + ST
  );

  // GS - Functional Group Header
  segments.push(
    [
      "GS",
      "HC",                          // Functional Identifier Code (Health Care)
      submitterInfo.submitter_id,
      OA_RECEIVER_ID,
      dateStr,
      timeStr,
      groupControlNum,
      "X",                           // Responsible Agency Code
      "005010X222A1",                // Version
    ].join(ES) + ST
  );

  let totalSegments = 0;
  let stIndex = 0;

  for (const [companyId, companyClaims] of claimsByCompany) {
    const providerInfo = providerMap.get(companyId)!;
    stIndex++;
    const stControlNum = padLeft(String(stIndex), 4);
    let segCount = 0;
    const addSeg = (seg: string) => {
      segments.push(seg + ST);
      segCount++;
    };

    // ST - Transaction Set Header (one per company group)
    addSeg(["ST", "837", stControlNum, "005010X222A1"].join(ES));

    // BHT - Beginning of Hierarchical Transaction
    addSeg(
      ["BHT", "0019", "00", controlNumber(), dateStr, timeStr, "CH"].join(ES)
    );

    // --- SUBMITTER (1000A) ---
    addSeg(["NM1", "41", "2", submitterInfo.submitter_name, "", "", "", "", "46", submitterInfo.submitter_id].join(ES));
    addSeg(["PER", "IC", submitterInfo.contact_name, "TE", submitterInfo.contact_phone.replace(/\D/g, "")].join(ES));

    // --- RECEIVER (1000B) ---
    addSeg(["NM1", "40", "2", OA_RECEIVER_NAME, "", "", "", "", "46", OA_RECEIVER_ID].join(ES));

    // --- BILLING PROVIDER HL (2000A) ---
    addSeg(["HL", "1", "", "20", "1"].join(ES));

    // --- BILLING PROVIDER (2010AA) ---
    addSeg(
      ["NM1", "85", "2", providerInfo.organization_name, "", "", "", "", "XX", providerInfo.npi].join(ES)
    );
    addSeg(["N3", providerInfo.address].join(ES));
    addSeg(["N4", providerInfo.city, providerInfo.state, providerInfo.zip].join(ES));
    addSeg(["REF", "EI", providerInfo.tax_id.replace(/-/g, "")].join(ES));

    // Per-claim subscriber/claim/service-line emission within this company's ST.
    let subscriberHlIndex = 1;
    companyClaims.forEach((claim) => {
    const { last: patLast, first: patFirst } = splitPatientName(claim.patient_name);
    const diagCodes = [...(claim.icd10_codes || []), ...(claim.diagnosis_codes || [])].filter(Boolean);
    const uniqueDiag = [...new Set(diagCodes)];
    // SBR09 MUST come from payer_directory.claim_filing_indicator via
    // resolvePayerForClaim() — never derived locally from payer_type.
    const payerCode = assertFilingIndicator(claim.claim_filing_indicator, claim.claim_id, "Loop 2000B");
    const sexCode = dmgSexCode(claim.patient_sex);

    // --- SUBSCRIBER HL (2000B) ---
    subscriberHlIndex++;
    addSeg(["HL", String(subscriberHlIndex), "1", "22", "0"].join(ES));
    // SBR01 reflects THIS claim's payer position for the destination payer
    // (Loop 2000B). When `cob` is present this is a secondary claim, so the
    // destination payer is Secondary ("S"); the OTHER (primary) payer is
    // emitted as "P" in Loop 2320 below. For primaries SBR01 stays "P".
    const destSbr01 = claim.cob ? "S" : "P";
    addSeg(["SBR", destSbr01, "18", "", "", "", "", "", "", payerCode].join(ES));

    // --- SUBSCRIBER (2010BA) ---
    addSeg(["NM1", "IL", "1", patLast, patFirst, "", "", "", "MI", claim.member_id].join(ES));
    const patAddr = parseAddressString(claim.patient_address);
    // Do NOT substitute "UNKNOWN" — claims with incomplete addresses must be
    // blocked upstream by validateClaimForEDI.
    const patStreet = (claim.patient_address && patAddr.street) || patAddr.street || (claim.patient_address ?? "").trim();
    const patCity = (claim.patient_city || patAddr.city || "").trim();
    const patState = (claim.patient_state || patAddr.state || "").trim();
    const patZip = (claim.patient_zip || patAddr.zip || "").trim();
    addSeg(["N3", patStreet].join(ES));
    addSeg(["N4", patCity, patState, patZip].join(ES));
    addSeg(["DMG", "D8", formatDate8(claim.patient_dob || "1900-01-01"), sexCode].join(ES));

    // --- PAYER (2010BB) ---
    // payer_id MUST be the real Office Ally payer ID, resolved upstream from
    // payer_directory by resolvePayerForClaim() (see queue-claims-for-submission.ts
    // and the OATEST simulator). The generator NEVER manufactures a payer ID —
    // if upstream skipped the resolve, that's a programmer error and we want
    // the failure to be loud, not a silent literal "MEDICARE" string in NM109.
    const payerNm109 = (claim.payer_id || "").toString().trim();
    // Pass 2 hardened guard: NM109 MUST be a real Office Ally payer ID
    // (5 chars, [A-Z0-9], e.g. "10202", "GACS1", "5STAR"). Reject literal
    // payer-name strings like "MEDICARE"/"MEDICAID"/"UNKNOWN" and any other
    // shape — those indicate upstream skipped resolvePayerForClaim().
    if (!/^[A-Z0-9]{5}$/i.test(payerNm109)) {
      throw new Error(
        `generateEDI837P: claim ${claim.claim_id} has invalid payer_id "${payerNm109}" at NM109 (Loop 2010BB). ` +
        `Expected a 5-character Office Ally payer ID matching /^[A-Z0-9]{5}$/i (e.g. "10202", "GACS1"). ` +
        `Upstream must call resolvePayerForClaim() and project oa_payer_id onto the claim envelope. ` +
        `Refusing to emit a payer-name string in place of a real Office Ally payer ID.`
      );
    }
    const payerNm103 = (claim.payer_name || "").toString().trim().toUpperCase() || payerNm109;
    addSeg(["NM1", "PR", "2", payerNm103, "", "", "", "", "PI", payerNm109.toUpperCase()].join(ES));

    // --- CLAIM (2300) ---
    const originCode = locationTypeCode(claim.origin_type, claim.origin_facility_meta);
    const destCode = locationTypeCode(claim.destination_type, claim.destination_facility_meta);
    const facilityCode = `${originCode}${destCode}`;
    addSeg(
      [
        "CLM",
        shortClaimRef(claim.claim_id, claim.run_date),
        formatAmount(claim.total_charge),
        "",
        "",
        `41${SE_SEP}B${SE_SEP}1`, // Place of service 41 (land ambulance), frequency B (original), claim filing indicator
        "Y",                        // Provider signature on file
        "A",                        // Assignment of benefits
        "Y",                        // Release of information
        "Y",                        // Patient signature on file
      ].join(ES)
    );

    // NOTE: DTP*472 (Service Date) is intentionally NOT emitted at the claim
    // level (Loop 2300). Office Ally rejected our first live submission with
    // "Unknown Segment" pointing at this exact segment. Per X12 005010X222A1,
    // ambulance service dates belong on the service line (Loop 2400) — see
    // the DTP*472 emissions inside the SV1 blocks below. Adding it here again
    // duplicates the date and trips OA's parser. Do not re-add without first
    // confirming with the clearinghouse implementation guide.

    // NTE - Claim Note (Loop 2300, Additional Information)
    // Carries the original dispatch reason ("chief complaint") and on-scene
    // primary impression so payers / auditors can reconcile what we were
    // dispatched for vs. what crew actually found. NTE*ADD = "Additional
    // Information"; alphanumeric, hyphen, comma, period and space allowed.
    const noteParts: string[] = [];
    // When the vocabulary value is the literal "Other", swap in the
    // free-text the crew typed (assessment_json.*_other). Emitting "Other"
    // alone gives payer reviewers no useful dispatch context.
    const resolvedChief = (claim.chief_complaint && claim.chief_complaint.trim() === "Other"
      ? (claim.chief_complaint_other || "").trim()
      : (claim.chief_complaint || "").trim());
    const resolvedImpression = (claim.primary_impression && claim.primary_impression.trim() === "Other"
      ? (claim.primary_impression_other || "").trim()
      : (claim.primary_impression || "").trim());
    if (resolvedChief) noteParts.push(`DISPATCH: ${resolvedChief}`);
    if (resolvedImpression) noteParts.push(`IMPRESSION: ${resolvedImpression}`);
    if (noteParts.length > 0) {
      // 837P NTE02 max length is 80 chars per implementation guide.
      const noteText = noteParts.join(" | ")
        .replace(/[^A-Za-z0-9 ,.\-:|]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
      addSeg(["NTE", "ADD", noteText].join(ES));
    }

    // CRC - Ambulance Certification (dynamic condition codes)
    const crcCodes = buildCrcCodes(claim);
    if (crcCodes.length > 0) {
      addSeg(["CRC", "07", "Y", ...crcCodes].join(ES));
    }

    // HI - Diagnosis Codes
    if (uniqueDiag.length > 0) {
      const hiElements = uniqueDiag.slice(0, 12).map((code, i) => {
        const qualifier = i === 0 ? "ABK" : "ABF";
        return `${qualifier}${SE_SEP}${code.replace(/\./g, "")}`;
      });
      addSeg(["HI", ...hiElements].join(ES));
    }
    // No fallback diagnosis anywhere in the pipeline. ICD-10 codes must come
    // from the PCR / patient chart for ALL transport types (including dialysis).
    // Missing ICD-10 is a hard validation failure in validateClaimForEDI() and
    // blocks export until real codes are entered. Synthesizing a diagnosis is
    // federal fraud exposure.

    // REF - Prior Authorization
    if (claim.auth_number) {
      addSeg(["REF", "G1", claim.auth_number].join(ES));
    }

    // DTP*431 — Onset of Current Illness or Symptom Date
    // Situational per X222A1 TR3 (NOT required even when CRC*07 is present).
    // Office Ally rejected OATEST_837P_20260501_1959 with
    //   IK3*DTP*19*2300*2  (Unexpected Segment, Loop 2300, position 19)
    // confirming OA's companion guide treats DTP*431 as "Not Used" for
    // ambulance 837P regardless of payer. Fully suppressed at the claim
    // level. If a future payer requires onset date, move it to Loop 2400
    // (service line) per their specific guide — never re-add here.
    // Intentionally not emitted.

    // Loop 2310A — Referring/Ordering Physician (PCS signing physician).
    // Fail loud if pcs_on_file is asserted but NPI is missing/invalid —
    // shipping a claim with an empty NM1*DK guarantees a Medicare rejection
    // and silently dropping the segment hides the data-quality bug.
    if (claim.pcs_on_file && (!claim.pcs_physician_npi || !/^\d{10}$/.test(claim.pcs_physician_npi) || !isLuhnValidNpi(claim.pcs_physician_npi))) {
      throw new Error(
        `generateEDI837P: claim ${claim.claim_id} has pcs_on_file=true but pcs_physician_npi is missing, not 10 digits, or fails Luhn checksum. Update the patient record (or biller PCS panel) with a valid NPI before exporting this claim.`
      );
    }
    if (claim.pcs_physician_npi && /^\d{10}$/.test(claim.pcs_physician_npi) && isLuhnValidNpi(claim.pcs_physician_npi)) {
      const physName = (claim.pcs_physician_name || "PHYSICIAN").toUpperCase();
      // Split "Dr. Jane Smith" → last/first best-effort
      const parts = physName.replace(/^DR\.?\s+/i, "").split(/\s+/);
      const physLast = parts.length > 1 ? parts[parts.length - 1] : physName;
      const physFirst = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
      // Loop 2310A qualifier must be DN (Referring Provider) in 837P 5010.
      // DK (Ordering Provider) is only valid at the service-line level
      // (Loop 2420E) and causes Office Ally to reject with IK3*NM1*..*2300*2
      // ("Unexpected Segment"), which cascades to NM1*PW and NM1*45.
      addSeg(["NM1", "DN", "1", physLast, physFirst, "", "", "", "XX", claim.pcs_physician_npi].join(ES));
    }

    // CR1 - Ambulance Transport Information
    // CR1-04 must be a single-letter transport reason code (A–E), NOT the
    // origin/destination facility modifier (which belongs on the SV1 line).
    const weightVal = claim.weight_lbs && claim.weight_lbs > 0 ? String(Math.round(claim.weight_lbs)) : "";
    const cr1Reason = buildCr1ReasonCode(claim);
    addSeg(
      [
        "CR1",
        weightVal ? "LB" : "",       // Weight unit (only if weight present)
        weightVal,                   // Patient weight
        "A",                         // Ambulance transport code
        cr1Reason,                   // Transport reason A–E
        "DH",                        // Distance unit (miles)
        // CMS expects mileage to one decimal (e.g. 10.4). Sending bare integers
        // looks like upcoding/underbilling and can trigger audit flags.
        claim.loaded_miles > 0 ? Number(claim.loaded_miles).toFixed(1) : "1.0",
        "",                          // Description (optional)
        "",                          // Description (optional)
      ].join(ES)
    );

    // --- Loop 2310E: Ambulance Pickup Location ---
    // CMS requires Loop 2310E on every ambulance claim regardless of origin
    // type — the pickup ZIP drives the GPCI / geographic payment adjustment.
    // For residences, NM103 must be "PATIENT RESIDENCE" (non-person entity)
    // per CMS ambulance billing guidelines. NM102 stays "2".
    if (claim.origin_address || claim.origin_zip) {
      const origAddr = parseAddressString(claim.origin_address);
      const origStreet = origAddr.street || claim.origin_address || "UNKNOWN";
      const origCity = claim.origin_city || origAddr.city || "";
      const origState = claim.origin_state || origAddr.state || "";
      const origZip = claim.origin_zip || origAddr.zip || "";
      const isResidenceOrigin = claim.origin_type && claim.origin_type.toLowerCase().includes("resid");
      const origFacName = isResidenceOrigin ? "PATIENT RESIDENCE" : (claim.pickup_facility_name || "").toUpperCase();
      addSeg(["NM1", "PW", "2", origFacName, "", "", "", "", "", ""].join(ES));
      addSeg(["N3", origStreet].join(ES));
      addSeg(["N4", origCity, origState, origZip].join(ES));
    }

    // --- Loop 2310F: Ambulance Dropoff Location ---
    if (claim.destination_address || claim.destination_zip) {
      const destAddr = parseAddressString(claim.destination_address);
      const destStreet = destAddr.street || claim.destination_address || "UNKNOWN";
      const destCity = claim.destination_city || destAddr.city || "";
      const destState = claim.destination_state || destAddr.state || "";
      const destZip = claim.destination_zip || destAddr.zip || "";
      const destFacName = (claim.dropoff_facility_name || "").toUpperCase();
      addSeg(["NM1", "45", "2", destFacName, "", "", "", "", "", ""].join(ES));
      addSeg(["N3", destStreet].join(ES));
      addSeg(["N4", destCity, destState, destZip].join(ES));
    }

    // --- Loop 2320 / 2330A / 2330B: Coordination of Benefits (COB) ---
    // Emitted only on secondary claims (claim has primary adjudication on file).
    // Per X12N TR3 005010X222A1 §2320, Loop 2320 segment list is:
    //   SBR, CAS (×5 max), AMT (D/EAF/F2), OI, MIA, MOA, DMG. There is NO DTP
    //   in Loop 2320 — DTP*573 (Claim Check or Remittance Date) is defined
    //   only in Loop 2330B. Order:
    //   SBR → CAS* → AMT*D → OI → NM1*IL (2330A) → N3 → N4 →
    //   NM1*PR (2330B) → DTP*573
    // Missing any required element will trigger an Office Ally 999 rejection,
    // so we throw loudly upstream rather than emit a partial loop.
    if (claim.cob) {
      const cob = claim.cob;
      // Hard validation — never ship a half-built COB loop.
      if (!cob.paid_amount && cob.paid_amount !== 0) {
        throw new Error(`generateEDI837P: claim ${claim.claim_id} cob.paid_amount missing`);
      }
      if (!cob.adjudication_date || !/^\d{4}-\d{2}-\d{2}$/.test(cob.adjudication_date)) {
        throw new Error(`generateEDI837P: claim ${claim.claim_id} cob.adjudication_date must be YYYY-MM-DD`);
      }
      if (!cob.subscriber?.last || !cob.subscriber?.member_id) {
        throw new Error(`generateEDI837P: claim ${claim.claim_id} cob.subscriber name/member_id missing`);
      }
      if (!cob.payer?.name || !cob.payer?.payer_id) {
        throw new Error(`generateEDI837P: claim ${claim.claim_id} cob.payer name/id missing`);
      }

      // SBR — Other Subscriber Information (Loop 2320). SBR01 = OTHER payer's
      // position relative to this claim. For a claim being billed to the
      // secondary payer, the OTHER payer is the Primary → "P".
      addSeg([
        "SBR", "P", cob.rel_code || "18", cob.group_number || "", cob.group_name || "",
        "", "", "", "",
        assertFilingIndicator(cob.claim_filing_indicator, claim.claim_id, "Loop 2320 (COB)"),
      ].join(ES));

      // CAS — one segment per group_code, up to 6 adjustment triplets per segment.
      for (const g of cob.cas_groups || []) {
        if (!g.adjustments?.length) continue;
        for (let i = 0; i < g.adjustments.length; i += 6) {
          const chunk = g.adjustments.slice(i, i + 6);
          const parts: string[] = ["CAS", g.group_code];
          for (const a of chunk) {
            parts.push(a.reason_code, formatAmount(a.amount), a.quantity != null ? String(a.quantity) : "");
          }
          // Strip trailing empties to keep segment compact.
          while (parts.length && parts[parts.length - 1] === "") parts.pop();
          addSeg(parts.join(ES));
        }
      }

      // AMT*D — Payer Paid Amount
      addSeg(["AMT", "D", formatAmount(cob.paid_amount)].join(ES));

      // OI — Other Insurance Coverage Information
      // OI*<claim_filing>*<claim_submission_reason>*<benefits_assignment>*<patient_signature_source>*<release_of_info>
      // Standard values when patient/sub auth on file: OI***Y***Y
      addSeg(["OI", "", "", "Y", "", "", "Y"].join(ES));

      // --- Loop 2330A: Other Subscriber Name ---
      addSeg([
        "NM1", "IL", "1", cob.subscriber.last, cob.subscriber.first,
        "", "", "", "MI", cob.subscriber.member_id,
      ].join(ES));
      if (cob.subscriber.address) addSeg(["N3", cob.subscriber.address].join(ES));
      if (cob.subscriber.city || cob.subscriber.state || cob.subscriber.zip) {
        addSeg(["N4", cob.subscriber.city || "", cob.subscriber.state || "", cob.subscriber.zip || ""].join(ES));
      }

      // --- Loop 2330B: Other Payer Name ---
      // Same rule as Loop 2010BB above — cob.payer.payer_id must be a real
      // Office Ally payer ID resolved via payer_directory. The COB builder in
      // queue-claims-for-submission.ts is responsible for the resolve before
      // calling generateEDI837P. Throw loudly if upstream skipped it.
      const cobNm109 = (cob.payer.payer_id || "").toString().trim();
      // Pass 2 hardened guard (Loop 2330B mirrors 2010BB).
      if (!/^[A-Z0-9]{5}$/i.test(cobNm109)) {
        throw new Error(
          `generateEDI837P: claim ${claim.claim_id} has invalid cob.payer.payer_id "${cobNm109}" at NM109 (Loop 2330B). ` +
          `Expected a 5-character Office Ally payer ID matching /^[A-Z0-9]{5}$/i (e.g. "10202", "GACS1"). ` +
          `Upstream must resolve the primary payer via payer_directory before emitting COB.`
        );
      }
      const cobNm103 = (cob.payer.name || "").toString().trim().toUpperCase() || cobNm109;
      addSeg([
        "NM1", "PR", "2", cobNm103,
        "", "", "", "", "PI", cobNm109.toUpperCase(),
      ].join(ES));
      addSeg(["DTP", "573", "D8", formatDate8(cob.adjudication_date)].join(ES));
    }

    // --- SERVICE LINES (2400) ---
    // Independent ambulance suppliers must append QN to every HCPCS line.
    // Origin/destination modifier is required on every ambulance line as well.
    const ensureQn = (mods: string[]): string[] => {
      const set = new Set(mods.map(m => m.toUpperCase().trim()).filter(Boolean));
      set.add("QN");
      return [...set];
    };
    // Pass 2 — Item 5 (SV1 dual modifier hardening).
    //
    // X12N TR3 005010X222A1 §2400 SV1 + CMS Pub 100-04 Ch.15 §10.4: an
    // ambulance service line may carry EXACTLY ONE origin/destination
    // modifier pair (a single 2-letter token whose letters are both drawn
    // from D/E/G/H/I/J/N/P/R/S/X). Two pairs on one line — e.g. RJ AND RD —
    // is a federal billing violation: the payer cannot tell which pair
    // describes the trip, and the line will be denied/audited.
    //
    // Some persisted claim_records.hcpcs_modifiers values carry a stale 2-
    // letter location pair from upstream sources that computed the pair
    // without facility-subtype context (e.g. the DB trigger derived "RD"
    // from origin_type=residence + destination_type=dialysis, missing the
    // freestanding subtype that would have produced "RJ"). The generator
    // recomputes the pair via locationTypeCode() with the resolved
    // facility_meta and treats THAT as the single source of truth.
    //
    // Strip any pre-existing location pair from the persisted modifiers
    // before merging, then assert exactly one pair survives in the final
    // SV1 modifier set. Loud failure mirrors NM109/SBR09/locationTypeCode
    // guards above — never emit a malformed SV1.
    const LOC_LETTERS = new Set(["D","E","G","H","I","J","N","P","R","S","X"]);
    const isLocationPair = (m: string): boolean => {
      const v = (m || "").toUpperCase().trim();
      return /^[A-Z]{2}$/.test(v) && LOC_LETTERS.has(v[0]) && LOC_LETTERS.has(v[1]);
    };
    const persistedMods = (claim.hcpcs_modifiers || []).filter(m => !isLocationPair(m));
    const baseModSet = ensureQn([facilityCode, ...persistedMods]);
    const pairsInBase = baseModSet.filter(isLocationPair);
    if (pairsInBase.length !== 1) {
      throw new Error(
        `generateEDI837P: claim ${claim.claim_id} SV1 base line would emit ${pairsInBase.length} origin/destination pair(s) [${pairsInBase.join(", ")}], expected exactly 1. ` +
        `Computed facilityCode=${facilityCode}. ` +
        `Persisted hcpcs_modifiers=${JSON.stringify(claim.hcpcs_modifiers || [])}. ` +
        `An SV1 line may carry only one O/D pair per X12N TR3 005010X222A1 §2400 and CMS Pub 100-04 Ch.15 §10.4. ` +
        `Investigate the upstream pipeline that populated hcpcs_modifiers for this claim.`
      );
    }

    // SV107 Composite Diagnosis Code Pointer — Required per X12N TR3
    // 005010X222A1 §2400 SV1, X12 RFI #2776, #2338. Values 1-12 reference
    // HI composite positions. Count cannot exceed HI code count. Multiple
    // pointers joined by ":". Max 4 pointers per service line.
    const diagCount = Math.min(uniqueDiag.length, 12);
    const pointerCount = Math.min(diagCount, 4);
    const diagPointer = pointerCount > 0
      ? Array.from({ length: pointerCount }, (_, i) => String(i + 1)).join(SE_SEP)
      : "";

    // Base rate line
    if (claim.base_charge > 0) {
      const baseHcpcs = claim.hcpcs_codes?.[0] || "A0428";
      addSeg(["LX", "1"].join(ES));
      const sv1Parts = [
        "SV1",
        `HC${SE_SEP}${baseHcpcs}${baseModSet.length > 0 ? SE_SEP + baseModSet.join(SE_SEP) : ""}`,
        formatAmount(claim.base_charge),
        "UN",
        "1",
        "41",
        "",            // SV106 (empty)
        diagPointer,   // SV107 diagnosis pointer
      ];
      addSeg(sv1Parts.join(ES));
      addSeg(["DTP", "472", "D8", formatDate8(claim.run_date)].join(ES));
    }

    // Mileage line — must also carry QN + origin/destination modifier.
    // Office Ally / Medicare expect statute-mile precision: trips < 100 mi
    // are reported with one decimal place (e.g. 10.4); trips >= 100 mi are
    // reported as whole miles. Empty quantity strings would fail the scrubber.
    if (claim.mileage_charge > 0 && claim.loaded_miles > 0) {
      const mileageMods = ensureQn([facilityCode]);
      // Mirror assertion on the mileage line — only the single computed
      // facilityCode pair is ever added here, but assert anyway so a future
      // edit that accidentally splices in claim.hcpcs_modifiers can't quietly
      // ship two pairs.
      const mileagePairs = mileageMods.filter(isLocationPair);
      if (mileagePairs.length !== 1) {
        throw new Error(
          `generateEDI837P: claim ${claim.claim_id} SV1 mileage line would emit ${mileagePairs.length} origin/destination pair(s) [${mileagePairs.join(", ")}], expected exactly 1.`
        );
      }
      const miles = Number(claim.loaded_miles);
      const mileageQty = miles < 100
        ? miles.toFixed(1)              // 10.4
        : String(Math.ceil(miles));     // 152
      addSeg(["LX", "2"].join(ES));
      addSeg(
        [
          "SV1",
          `HC${SE_SEP}A0425${mileageMods.length > 0 ? SE_SEP + mileageMods.join(SE_SEP) : ""}`,
          formatAmount(claim.mileage_charge),
          "UN",
          mileageQty,
          "41",
          "",            // SV106 (empty)
          diagPointer,   // SV107 diagnosis pointer
        ].join(ES)
      );
      addSeg(["DTP", "472", "D8", formatDate8(claim.run_date)].join(ES));
    }

    });

    // SE - Transaction Set Trailer (one per company group / ST)
    addSeg(["SE", String(segCount + 1), stControlNum].join(ES));
    totalSegments++;
  }

  // GE - Functional Group Trailer
  segments.push(["GE", String(totalSegments), groupControlNum].join(ES) + ST);

  // IEA - Interchange Control Trailer
  segments.push(["IEA", "1", padLeft(interchangeControlNum, 9)].join(ES) + ST);

  return segments.join("\n");
}

/** Validate claims have minimum required data for 837P export.
 *  Hard blockers — claim file will not generate if any of these fail.
 *  Pass billingState (provider/company state) for state-specific timely filing rules.
 */
export function validateClaimForEDI(claim: ClaimForEDI, billingState?: string | null): string[] {
  // Delegated to claim-readiness.ts (single source of truth). All of the
  // historical block conditions live there. Behavior at this gate is identical:
  // we only return "block" severity messages and only the export stage.
  // Lazy require to avoid a circular dependency at module init.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { evaluateClaimReadiness, readinessToErrorStrings } = require("./claim-readiness") as typeof import("./claim-readiness");
  return readinessToErrorStrings(
    evaluateClaimReadiness({ claim, billingState }).filter((i) => i.severity === "block"),
  );
}

/** Validate the global vendor SubmitterInfo. PodDispatch is the registered
 *  Office Ally vendor, so submitter_id must be present and non-empty. Returns
 *  human-readable error strings; export must be blocked if any are returned. */
export function validateSubmitterInfo(info: SubmitterInfo): string[] {
  const errors: string[] = [];
  const sid = (info.submitter_id ?? "").trim();
  if (!sid) {
    errors.push("Vendor Submitter ID is missing, configure it in vendor_clearinghouse_settings before exporting any 837P.");
  }
  if (!(info.submitter_name ?? "").trim()) {
    errors.push("Vendor Submitter Name is missing, configure it in vendor_clearinghouse_settings.");
  }
  if (!(info.contact_name ?? "").trim()) {
    errors.push("Vendor contact name is missing, configure it in vendor_clearinghouse_settings.");
  }
  const phoneDigits = (info.contact_phone ?? "").replace(/\D/g, "");
  if (phoneDigits.length < 10) {
    errors.push("Vendor contact phone must be at least 10 digits, configure it in vendor_clearinghouse_settings.");
  }
  return errors;
}

/** Validate the per-tenant ProviderInfo (Loop 2010AA, Billing Provider).
 *  Office Ally requires: 10-digit NPI, 9-digit EIN, physical street address
 *  (no PO Box), and a 5- or 9-digit ZIP. */
export function validateProviderInfo(info: ProviderInfo): string[] {
  const errors: string[] = [];
  const npi = (info.npi ?? "").replace(/\D/g, "");
  if (npi.length !== 10) errors.push("Provider NPI must be exactly 10 digits.");
  else if (!isLuhnValidNpi(npi)) {
    errors.push(
      "Provider NPI failed Luhn checksum. Office Ally rejects any 10-digit NPI whose check digit does not validate against the CMS 80840 prefix. Verify the number against NPPES."
    );
  }
  const ein = (info.tax_id ?? "").replace(/\D/g, "");
  if (ein.length !== 9) errors.push("Provider Tax ID (EIN) must be exactly 9 digits.");
  if (!(info.organization_name ?? "").trim()) errors.push("Provider organization name is required.");
  const addr = (info.address ?? "").trim();
  if (!addr) {
    errors.push("Provider street address is required (Loop 2010AA, N3).");
  } else if (/\bP\.?\s*O\.?\s*BOX\b/i.test(addr)) {
    errors.push("Provider address cannot be a PO Box. Office Ally requires a physical street address for the Billing Provider.");
  }
  if (!(info.city ?? "").trim()) errors.push("Provider city is required (Loop 2010AA, N4).");
  const stateAbbr = (info.state ?? "").trim().toUpperCase();
  if (stateAbbr.length !== 2 || !US_STATES.has(stateAbbr)) {
    errors.push("Provider state must be a 2-letter US state abbreviation.");
  }
  const zip = (info.zip ?? "").replace(/\D/g, "");
  if (zip.length !== 5 && zip.length !== 9) {
    errors.push("Provider ZIP must be 5 or 9 digits.");
  }
  return errors;
}

/** CMS NPI Luhn validation (prefix 80840 + first 9 digits, last digit = check).
 *  Inlined here so the EDI generator has no cross-file dependency. */
function isLuhnValidNpi(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;
  const full = "80840" + npi.slice(0, 9);
  const digits = full.split("").map((d) => parseInt(d, 10));
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    const fromCheck = digits.length - i;
    let d = digits[i];
    if (fromCheck % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === parseInt(npi[9], 10);
}

/** Validate a map of per-company ProviderInfo objects. Returns an aggregated
 *  array of human-readable errors, each prefixed with the company_id so the
 *  caller can disambiguate when a multi-tenant batch contains an invalid
 *  billing provider for one of its companies. */
export function validateProviderInfoMap(
  map: Map<string, ProviderInfo> | Record<string, ProviderInfo>
): string[] {
  const m = map instanceof Map ? map : new Map(Object.entries(map));
  const errors: string[] = [];
  for (const [companyId, info] of m) {
    const errs = validateProviderInfo(info);
    for (const e of errs) errors.push(`[company ${companyId}] ${e}`);
  }
  return errors;
}

/** Generate a filename for the 837P export.
 *
 * Office Ally companion guide requires sandbox files to include the keyword
 * `OATEST` (all caps, no underscores around it) and the claim type keyword
 * (`837P`). The `.837` extension is required for SFTP submission. When
 * testMode is true we emit:  `OATEST_837P_YYYYMMDD_HHMM.837`
 * Otherwise:                  `837P_YYYYMMDD_HHMM.837`
 */
export function generateEDIFilename(testMode: boolean = false): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${padLeft(String(now.getMonth() + 1), 2)}${padLeft(String(now.getDate()), 2)}`;
  const timeStr = `${padLeft(String(now.getHours()), 2)}${padLeft(String(now.getMinutes()), 2)}`;
  const base = `837P_${dateStr}_${timeStr}.837`;
  return testMode ? `OATEST_${base}` : base;
}
