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

/** Map location type codes to CMS ambulance origin/destination codes */
function locationTypeCode(type: string | null): string {
  if (!type) return "R";
  const map: Record<string, string> = {
    hospital: "H", "H": "H",
    dialysis: "D", dialysis_center: "D", "D": "D",
    residence: "R", home: "R", "R": "R",
    nursing: "N", nursing_facility: "N", snf: "N", "N": "N",
    scene: "S", "S": "S",
    physician: "P", doctor: "P", "P": "P",
  };
  return map[type.toLowerCase()] || "R";
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

/** Build dynamic CRC condition codes from medical necessity fields */
function buildCrcCodes(claim: ClaimForEDI): string[] {
  const codes: string[] = [];
  const hasAny = claim.bed_confined || claim.requires_monitoring || claim.oxygen_required ||
    (claim.stretcher_placement && claim.stretcher_placement.toLowerCase() !== "ambulatory");
  if (hasAny) codes.push("01"); // patient was transported
  if (claim.bed_confined) codes.push("04"); // patient is bed-confined
  if (claim.stretcher_placement && claim.stretcher_placement.toLowerCase() !== "ambulatory") codes.push("05"); // stretcher required
  if (claim.requires_monitoring) codes.push("06"); // monitoring required
  if (claim.oxygen_required) codes.push("07"); // oxygen required
  return codes.slice(0, 4); // max 4 condition codes
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
      pad("OFFICEALLY", 15),         // Interchange Receiver ID
      dateStr.slice(2),              // Date (YYMMDD)
      timeStr,                       // Time (HHMM)
      "^",                           // Repetition Separator
      "00501",                       // Interchange Control Version
      padLeft(interchangeControlNum, 9), // Interchange Control Number
      "0",                           // Acknowledgment Requested
      "P",                           // Usage Indicator (P=Production)
      SE_SEP,                        // Component Element Separator
    ].join(ES) + ST
  );

  // GS - Functional Group Header
  segments.push(
    [
      "GS",
      "HC",                          // Functional Identifier Code (Health Care)
      submitterInfo.submitter_id,
      "OFFICEALLY",
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
    addSeg(["NM1", "40", "2", "OFFICEALLY", "", "", "", "", "46", "OFFICEALLY"].join(ES));

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
    addSeg(["N3", claim.patient_address || "UNKNOWN"].join(ES));
    addSeg(["N4", claim.patient_city || "UNKNOWN", claim.patient_state || "GA", claim.patient_zip || "00000"].join(ES));
    addSeg(["DMG", "D8", formatDate8(claim.patient_dob || "1900-01-01"), sexCode].join(ES));

    // --- PAYER (2010BB) ---
    addSeg(["NM1", "PR", "2", claim.payer_name || "MEDICARE", "", "", "", "", "PI", claim.payer_id || "MEDICARE"].join(ES));

    // --- CLAIM (2300) ---
    const originCode = locationTypeCode(claim.origin_type);
    const destCode = locationTypeCode(claim.destination_type);
    const facilityCode = `${originCode}${destCode}`;
    addSeg(
      [
        "CLM",
        claim.claim_id,
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
    } else {
      // Default ESRD diagnosis if none provided
      addSeg(["HI", `ABK${SE_SEP}N186`].join(ES));
    }

    // REF - Prior Authorization
    if (claim.auth_number) {
      addSeg(["REF", "G1", claim.auth_number].join(ES));
    }

    // CR1 - Ambulance Transport Information
    addSeg(
      [
        "CR1",
        "LB",                        // Weight unit
        claim.weight_lbs ? String(claim.weight_lbs) : "", // Patient weight
        "A",                         // Ambulance transport code
        facilityCode.length >= 2 ? facilityCode : "RD", // Transport reason
        "DH",                        // Distance unit (miles)
        claim.loaded_miles > 0 ? String(claim.loaded_miles) : "1",
        "",                          // Description (optional)
        "",                          // Description (optional)
      ].join(ES)
    );

    // --- Loop 2310E: Ambulance Pickup Location ---
    if (claim.origin_address || claim.origin_zip) {
      addSeg(["NM1", "PW", "2", "", "", "", "", "", "", ""].join(ES));
      addSeg(["N3", claim.origin_address || "UNKNOWN"].join(ES));
      addSeg(["N4", claim.origin_city || "", claim.origin_state || "", claim.origin_zip || ""].join(ES));
    }

    // --- Loop 2310F: Ambulance Dropoff Location ---
    if (claim.destination_address || claim.destination_zip) {
      addSeg(["NM1", "45", "2", "", "", "", "", "", "", ""].join(ES));
      addSeg(["N3", claim.destination_address || "UNKNOWN"].join(ES));
      addSeg(["N4", claim.destination_city || "", claim.destination_state || "", claim.destination_zip || ""].join(ES));
    }

    // --- SERVICE LINES (2400) ---
    // Base rate line
    if (claim.base_charge > 0) {
      const baseHcpcs = claim.hcpcs_codes?.[0] || "A0428";
      const mods = claim.hcpcs_modifiers || [];
      addSeg(["LX", "1"].join(ES));
      const sv1Parts = [
        "SV1",
        `HC${SE_SEP}${baseHcpcs}${mods.length > 0 ? SE_SEP + mods.join(SE_SEP) : ""}`,
        formatAmount(claim.base_charge),
        "UN",
        "1",
        "41",
      ];
      addSeg(sv1Parts.join(ES));
      addSeg(["DTP", "472", "D8", formatDate8(claim.run_date)].join(ES));
    }

    // Mileage line
    if (claim.mileage_charge > 0 && claim.loaded_miles > 0) {
      addSeg(["LX", "2"].join(ES));
      addSeg(
        [
          "SV1",
          `HC${SE_SEP}A0425`,
          formatAmount(claim.mileage_charge),
          "UN",
          String(Math.ceil(claim.loaded_miles)),
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

/** Validate claims have minimum required data for 837P export */
export function validateClaimForEDI(claim: ClaimForEDI): string[] {
  const errors: string[] = [];
  if (!claim.member_id) errors.push("Missing member ID");
  if (!claim.patient_name) errors.push("Missing patient name");
  if (!claim.run_date) errors.push("Missing service date");
  if (!claim.total_charge || claim.total_charge <= 0) errors.push("Invalid charge amount");
  if (!claim.hcpcs_codes?.length) errors.push("Missing HCPCS codes");
  if (!claim.payer_name && !claim.payer_id) errors.push("Missing payer information");
  return errors;
}

/** Generate a filename for the 837P export */
export function generateEDIFilename(): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${padLeft(String(now.getMonth() + 1), 2)}${padLeft(String(now.getDate()), 2)}`;
  const timeStr = `${padLeft(String(now.getHours()), 2)}${padLeft(String(now.getMinutes()), 2)}`;
  return `837P_${dateStr}_${timeStr}.txt`;
}
