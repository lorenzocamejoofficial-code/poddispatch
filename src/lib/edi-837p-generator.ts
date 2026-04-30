/**
 * EDI 837P (Professional) Claim Generator
 * Generates ANSI X12 837P files for ambulance transport claims
 * Compatible with Office Ally and standard clearinghouses
 */

export interface ClaimForEDI {
  claim_id: string;
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
  /** Original dispatch reason / call complaint — what crew was sent for.
   *  Maps to claim_records.chief_complaint, which is captured at scheduling
   *  and carried into the PCR. Emitted as NTE*ADD on Loop 2300 so payers can
   *  reconcile dispatch context against on-scene findings. */
  chief_complaint?: string | null;
  /** On-scene primary impression — what crew found. Mirrors
   *  claim_records.primary_impression. Combined with chief_complaint to give
   *  Medicare reviewers full dispatch-to-assessment context. */
  primary_impression?: string | null;
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
  /** Office Ally (or other clearinghouse) receiver ID. Defaults to "OFFICEALLY"
   *  when not supplied. Must come from clearinghouse_settings.receiver_id. */
  receiver_id?: string;
  /** ISA15 Usage Indicator: "P" = Production (default), "T" = Test (OATEST).
   *  When test mode is enabled in clearinghouse_settings, set this to "T" so
   *  Office Ally routes the file through the test environment. */
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

/** Map location type codes to CMS ambulance origin/destination codes */
function locationTypeCode(type: string | null): string {
  if (!type) return "R";
  const t = type.toLowerCase();
  // More specific matches first
  if (t.includes("hospital-based dialysis") || t === "g") return "G";
  if (t.includes("non-hospital") && t.includes("dialysis") || t === "j") return "J";
  if (t.includes("hospital outpatient") || t === "e") return "E";
  if (t.includes("hospital inpatient") || t.includes("emergency room") || t === "h") return "H";
  if (t.includes("dialysis") || t === "d") return "D";
  if (t.includes("nursing") || t.includes("snf") || t === "n") return "N";
  if (t.includes("scene") || t === "s") return "S";
  if (t.includes("physician") || t.includes("doctor") || t === "p") return "P";
  if (t.includes("site of transfer") || t.includes("ift") || t === "i") return "I";
  if (t.includes("intermediate") || t === "x") return "X";
  // Residence, Home, Assisted Living, Rehab, Other → R
  return "R";
}

/** Map payer_type to X12 SBR claim filing indicator code */
function sbrPayerCode(payerType: string | null): string {
  if (!payerType) return "ZZ";
  const t = payerType.toLowerCase();
  if (t === "medicare" || t === "mc") return "MC";
  if (t === "medicaid" || t === "md") return "MD";
  if (t === "commercial" || t === "private" || t === "ci") return "CI";
  return "ZZ";
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

  // 01 — admitted to hospital (destination is hospital)
  if (dest.includes("hospital") && !dest.includes("hospital-based dialysis")) {
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
function timelyFilingDays(payerType: string | null, state: string | null): number {
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
  providerInfo: ProviderInfo,
  submitterInfo: SubmitterInfo
): string {
  const segments: string[] = [];
  const interchangeControlNum = controlNumber();
  const groupControlNum = controlNumber();
  const today = new Date();
  const dateStr = formatDate8(
    `${today.getFullYear()}-${padLeft(String(today.getMonth() + 1), 2)}-${padLeft(String(today.getDate()), 2)}`
  );
  const timeStr = formatTime4();

  // ISA - Interchange Control Header
  const receiverId = (submitterInfo.receiver_id || "OFFICEALLY").toUpperCase();
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
      pad(receiverId, 15),           // Interchange Receiver ID
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
      receiverId,
      dateStr,
      timeStr,
      groupControlNum,
      "X",                           // Responsible Agency Code
      "005010X222A1",                // Version
    ].join(ES) + ST
  );

  let totalSegments = 0;

  claims.forEach((claim, claimIndex) => {
    const stControlNum = padLeft(String(claimIndex + 1), 4);
    let segCount = 0;
    const addSeg = (seg: string) => {
      segments.push(seg + ST);
      segCount++;
    };

    const { last: patLast, first: patFirst } = splitPatientName(claim.patient_name);
    const diagCodes = [...(claim.icd10_codes || []), ...(claim.diagnosis_codes || [])].filter(Boolean);
    const uniqueDiag = [...new Set(diagCodes)];
    const payerCode = sbrPayerCode(claim.payer_type);
    const sexCode = dmgSexCode(claim.patient_sex);

    // ST - Transaction Set Header
    addSeg(["ST", "837", stControlNum, "005010X222A1"].join(ES));

    // BHT - Beginning of Hierarchical Transaction
    addSeg(
      ["BHT", "0019", "00", controlNumber(), dateStr, timeStr, "CH"].join(ES)
    );

    // --- SUBMITTER (1000A) ---
    addSeg(["NM1", "41", "2", submitterInfo.submitter_name, "", "", "", "", "46", submitterInfo.submitter_id].join(ES));
    addSeg(["PER", "IC", submitterInfo.contact_name, "TE", submitterInfo.contact_phone.replace(/\D/g, "")].join(ES));

    // --- RECEIVER (1000B) ---
    addSeg(["NM1", "40", "2", receiverId, "", "", "", "", "46", receiverId].join(ES));

    // --- BILLING PROVIDER HL (2000A) ---
    addSeg(["HL", "1", "", "20", "1"].join(ES));

    // --- BILLING PROVIDER (2010AA) ---
    addSeg(
      ["NM1", "85", "2", providerInfo.organization_name, "", "", "", "", "XX", providerInfo.npi].join(ES)
    );
    addSeg(["N3", providerInfo.address].join(ES));
    addSeg(["N4", providerInfo.city, providerInfo.state, providerInfo.zip].join(ES));
    addSeg(["REF", "EI", providerInfo.tax_id.replace(/-/g, "")].join(ES));

    // --- SUBSCRIBER HL (2000B) ---
    addSeg(["HL", "2", "1", "22", "0"].join(ES));
    addSeg(["SBR", "P", "18", "", "", "", "", "", "", payerCode].join(ES));

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
    addSeg(["NM1", "PR", "2", (claim.payer_name || "MEDICARE").toUpperCase(), "", "", "", "", "PI", (claim.payer_id || "MEDICARE").toUpperCase()].join(ES));

    // --- CLAIM (2300) ---
    const originCode = locationTypeCode(claim.origin_type);
    const destCode = locationTypeCode(claim.destination_type);
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

    // DTP - Service Date
    addSeg(["DTP", "472", "D8", formatDate8(claim.run_date)].join(ES));

    // NTE - Claim Note (Loop 2300, Additional Information)
    // Carries the original dispatch reason ("chief complaint") and on-scene
    // primary impression so payers / auditors can reconcile what we were
    // dispatched for vs. what crew actually found. NTE*ADD = "Additional
    // Information"; alphanumeric, hyphen, comma, period and space allowed.
    const noteParts: string[] = [];
    if (claim.chief_complaint && claim.chief_complaint.trim()) {
      noteParts.push(`DISPATCH: ${claim.chief_complaint.trim()}`);
    }
    if (claim.primary_impression && claim.primary_impression.trim()) {
      noteParts.push(`IMPRESSION: ${claim.primary_impression.trim()}`);
    }
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

    // PCS Certification Date — REF*9F (Referral Number) carries certification metadata when present
    if (claim.pcs_certification_date) {
      addSeg(["DTP", "439", "D8", formatDate8(claim.pcs_certification_date)].join(ES));
    }

    // Loop 2310A — Referring/Ordering Physician (PCS signing physician)
    if (claim.pcs_physician_npi && /^\d{10}$/.test(claim.pcs_physician_npi)) {
      const physName = (claim.pcs_physician_name || "PHYSICIAN").toUpperCase();
      // Split "Dr. Jane Smith" → last/first best-effort
      const parts = physName.replace(/^DR\.?\s+/i, "").split(/\s+/);
      const physLast = parts.length > 1 ? parts[parts.length - 1] : physName;
      const physFirst = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
      addSeg(["NM1", "DK", "1", physLast, physFirst, "", "", "", "XX", claim.pcs_physician_npi].join(ES));
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
    // For residences, the facility name (NM1*PW) is left blank but N3/N4 are
    // still emitted with the pickup street/city/state/ZIP.
    if (claim.origin_address || claim.origin_zip) {
      const origAddr = parseAddressString(claim.origin_address);
      const origStreet = origAddr.street || claim.origin_address || "UNKNOWN";
      const origCity = claim.origin_city || origAddr.city || "";
      const origState = claim.origin_state || origAddr.state || "";
      const origZip = claim.origin_zip || origAddr.zip || "";
      const isResidenceOrigin = claim.origin_type && claim.origin_type.toLowerCase().includes("resid");
      const origFacName = isResidenceOrigin ? "" : (claim.pickup_facility_name || "").toUpperCase();
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

    // --- SERVICE LINES (2400) ---
    // Independent ambulance suppliers must append QN to every HCPCS line.
    // Origin/destination modifier is required on every ambulance line as well.
    const ensureQn = (mods: string[]): string[] => {
      const set = new Set(mods.map(m => m.toUpperCase().trim()).filter(Boolean));
      set.add("QN");
      return [...set];
    };
    const baseModSet = ensureQn([facilityCode, ...(claim.hcpcs_modifiers || [])]);

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
        ].join(ES)
      );
      addSeg(["DTP", "472", "D8", formatDate8(claim.run_date)].join(ES));
    }

    // SE - Transaction Set Trailer
    addSeg(["SE", String(segCount + 1), stControlNum].join(ES));

    totalSegments++;
  });

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
  const errors: string[] = [];
  if (!claim.member_id || !String(claim.member_id).trim() || String(claim.member_id).trim().toUpperCase() === "UNKNOWN") {
    errors.push("Missing member ID");
  }
  if (!claim.run_date) errors.push("Missing service date");
  if (!claim.total_charge || claim.total_charge <= 0) errors.push("Invalid charge amount");
  if (!claim.hcpcs_codes?.length) errors.push("Missing HCPCS codes");
  if (!claim.payer_name && !claim.payer_id) errors.push("Missing payer information");

  // ICD-10 — required from PCR. We removed the dialysis N18.6 auto-stamp,
  // so any claim missing codes must be blocked here. Diagnosis is the basis
  // for medical-necessity determination — fabricating one is fraud exposure.
  const allDiag = [...(claim.icd10_codes || []), ...(claim.diagnosis_codes || [])].filter(Boolean);
  if (allDiag.length === 0) {
    errors.push("ICD-10 code required — enter code from PCR");
  }

  // Patient name — both first and last required. splitPatientName uses "UNKNOWN"
  // as a placeholder when parsing fails, so check for that explicitly.
  const { last, first } = splitPatientName(claim.patient_name || "");
  if (!claim.patient_name?.trim() || last === "UNKNOWN" || first === "UNKNOWN") {
    errors.push("Missing patient first or last name");
  }

  // Patient DOB — required, must not be the 1900-01-01 placeholder
  const dob = (claim.patient_dob || "").trim();
  if (!dob || dob === "1900-01-01" || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    errors.push("Missing patient date of birth");
  }

  // Patient sex — required, must be M or F (not U/null)
  const sex = (claim.patient_sex || "").toUpperCase();
  if (sex !== "M" && sex !== "F" && sex !== "MALE" && sex !== "FEMALE") {
    errors.push("Missing patient sex");
  }

  // Patient address — require non-empty street, city, and ZIP.
  const parsed = parseAddressString(claim.patient_address);
  const street = (claim.patient_address ?? "").trim() || parsed.street;
  const city = (claim.patient_city ?? "").trim() || parsed.city;
  const zip = (claim.patient_zip ?? "").trim() || parsed.zip;
  if (!street.trim() || !city.trim() || !zip.trim()) {
    errors.push("Patient address incomplete — update patient record before submitting.");
  }

  // Timely filing — block if DOS is past payer's filing limit
  if (claim.run_date && /^\d{4}-\d{2}-\d{2}$/.test(claim.run_date)) {
    const limit = timelyFilingDays(claim.payer_type, billingState ?? null);
    const dos = new Date(claim.run_date + "T00:00:00");
    const deadline = new Date(dos.getTime() + limit * 24 * 60 * 60 * 1000);
    if (Date.now() > deadline.getTime()) {
      const daysOver = Math.floor((Date.now() - deadline.getTime()) / (1000 * 60 * 60 * 24));
      errors.push(`Timely filing deadline passed — DOS ${claim.run_date} is ${daysOver} days past the ${limit}-day limit for ${claim.payer_type ?? "payer"}.`);
    }
  }

  // Origin/Destination modifier pair — required on every ambulance line.
  // Without both we can't emit the RH/HD/etc. facility code on SV1.
  if (!claim.origin_type || !String(claim.origin_type).trim()) {
    errors.push("Missing origin type — required to build the ambulance origin/destination modifier (e.g. R, H, N, D).");
  }
  if (!claim.destination_type || !String(claim.destination_type).trim()) {
    errors.push("Missing destination type — required to build the ambulance origin/destination modifier (e.g. R, H, N, D).");
  }

  // Pickup ZIP — Office Ally / Medicare use this for the GPCI / geographic
  // payment adjustment lookup on Loop 2310E. Block export if missing.
  const pickupZip = (claim.origin_zip ?? "").trim();
  if (!pickupZip || !/^\d{5}(?:-?\d{4})?$/.test(pickupZip)) {
    errors.push("Missing or invalid pickup ZIP — required for Loop 2310E (Medicare geographic payment adjustment).");
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
