/**
 * EDI 835 (Electronic Remittance Advice) Parser
 * Parses ANSI X12 835 files returned by clearinghouses after Medicare/Medicaid adjudication
 */

export interface AdjustmentGroup {
  group_code: string; // CO, PR, OA
  reason_code: string; // e.g. "45", "1", "96"
  amount: number;
}

export interface ServiceLine {
  procedure_code: string;
  modifiers: string[];
  charged_amount: number;
  paid_amount: number;
  units: number;
}

export interface ParsedRemittanceItem {
  patient_control_number: string; // CLP01 — the claim reference from our 837P
  payer_claim_control_number: string;
  patient_member_id: string;
  patient_name: string;
  date_of_service: string;
  claim_status_code: string;
  claim_status_label: string;
  charged_amount: number;
  paid_amount: number;
  patient_responsibility: number;
  adjustment_groups: AdjustmentGroup[];
  service_lines: ServiceLine[];
  raw_denial_codes: string[]; // e.g. ["CO-45", "PR-1"]
  payment_date: string; // from BPR16 or DTM, ISO format
}

const CLP_STATUS_MAP: Record<string, string> = {
  "1": "Paid",
  "2": "Adjusted",
  "3": "Denied",
  "4": "Denied — Contact Payer",
  "19": "Paid in Full",
  "22": "Reversal of Previous Payment",
};

/**
 * Normalize segment terminators: 835 files may use ~, ~\n, or \n~ patterns.
 * Returns an array of raw segment strings.
 */
function splitSegments(raw: string): string[] {
  // Detect segment terminator — last char of ISA is the terminator
  // ISA is always 106 chars (with separators). The 106th char (index 105) is the segment terminator.
  const trimmed = raw.trim();
  let terminator = "~";

  // Try to find ISA and detect terminator
  const isaMatch = trimmed.match(/^ISA/);
  if (isaMatch) {
    // ISA has exactly 16 elements. Find the element separator (position 3)
    const elementSep = trimmed[3];
    // Count elements to find the end of ISA
    let count = 0;
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] === elementSep) {
        count++;
        if (count === 16) {
          // The sub-element separator is the next char, then terminator follows
          // ISA16 is component separator, next char is segment terminator
          const idx = i + 2; // skip ISA16 value
          if (idx < trimmed.length) {
            terminator = trimmed[idx];
            if (terminator === "\r" || terminator === "\n") terminator = "~";
          }
          break;
        }
      }
    }
  }

  // Split by terminator, handling newlines
  return trimmed
    .split(terminator)
    .map((s) => s.replace(/[\r\n]/g, "").trim())
    .filter((s) => s.length > 0);
}

function parseElements(segment: string, sep = "*"): string[] {
  return segment.split(sep);
}

function toNum(val: string | undefined): number {
  if (!val) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function formatDateFromEDI(ediDate: string): string {
  if (!ediDate || ediDate.length < 8) return ediDate || "";
  return `${ediDate.slice(0, 4)}-${ediDate.slice(4, 6)}-${ediDate.slice(6, 8)}`;
}

export function parseEDI835(rawContent: string): ParsedRemittanceItem[] {
  const segments = splitSegments(rawContent);
  const results: ParsedRemittanceItem[] = [];

  let currentClaim: ParsedRemittanceItem | null = null;
  let payerName = "";
  let payerId = "";
  let bprPaymentDate = ""; // BPR16 payment date, applies to all claims in the file

  for (let i = 0; i < segments.length; i++) {
    const els = parseElements(segments[i]);
    const segId = els[0];

    // BPR — Financial Information (payment header)
    if (segId === "BPR") {
      // BPR16 is the payment/check date in YYYYMMDD format
      if (els[16]) {
        bprPaymentDate = formatDateFromEDI(els[16]);
      }
    }

    // NM1 — Name segments
    if (segId === "NM1") {
      const entityId = els[1];
      if (entityId === "PR") {
        // Payer
        payerName = els[3] || "";
        payerId = els[9] || "";
      } else if (entityId === "QC" && currentClaim) {
        // Patient
        const last = els[3] || "";
        const first = els[4] || "";
        currentClaim.patient_name = `${last}, ${first}`.trim();
        if (els[9]) currentClaim.patient_member_id = els[9];
      } else if (entityId === "IL" && currentClaim) {
        // Insured/Subscriber
        if (!currentClaim.patient_name || currentClaim.patient_name === ", ") {
          const last = els[3] || "";
          const first = els[4] || "";
          currentClaim.patient_name = `${last}, ${first}`.trim();
        }
        if (els[9] && !currentClaim.patient_member_id) {
          currentClaim.patient_member_id = els[9];
        }
      }
    }

    // CLP — Claim Payment
    if (segId === "CLP") {
      // Save previous claim
      if (currentClaim) {
        results.push(currentClaim);
      }

      const statusCode = els[2] || "";
      currentClaim = {
        patient_control_number: els[1] || "", // CLP01 — our claim reference
        payer_claim_control_number: els[7] || "",
        patient_member_id: "", // filled by NM1*QC or NM1*IL
        patient_name: "",
        date_of_service: "",
        claim_status_code: statusCode,
        claim_status_label: CLP_STATUS_MAP[statusCode] || `Unknown (${statusCode})`,
        charged_amount: toNum(els[3]),
        paid_amount: toNum(els[4]),
        patient_responsibility: toNum(els[5]),
        adjustment_groups: [],
        service_lines: [],
        raw_denial_codes: [],
        payment_date: bprPaymentDate, // default from BPR, may be overridden by DTM
      };
    }

    // CAS — Claim Adjustment Segment
    if (segId === "CAS" && currentClaim) {
      const groupCode = els[1] || ""; // CO, PR, OA
      // CAS can have multiple adjustment triplets: reason, amount, quantity
      for (let j = 2; j < els.length; j += 3) {
        const reasonCode = els[j];
        const amount = toNum(els[j + 1]);
        if (reasonCode && reasonCode.trim()) {
          currentClaim.adjustment_groups.push({
            group_code: groupCode,
            reason_code: reasonCode,
            amount,
          });
          currentClaim.raw_denial_codes.push(`${groupCode}-${reasonCode}`);
        }
      }
    }

    // SVC — Service Line
    if (segId === "SVC" && currentClaim) {
      const procComposite = els[1] || "";
      // Format: HC:procedure:modifier1:modifier2...
      const procParts = procComposite.split(":");
      const procedureCode = procParts[1] || procParts[0] || "";
      const modifiers = procParts.slice(2).filter(Boolean);

      currentClaim.service_lines.push({
        procedure_code: procedureCode,
        modifiers,
        charged_amount: toNum(els[2]),
        paid_amount: toNum(els[3]),
        units: toNum(els[5]) || 1,
      });
    }

    // DTM — Date/Time Reference within claim loop
    if (segId === "DTM" && currentClaim) {
      const qualifier = els[1];
      if (qualifier === "232" || qualifier === "233" || qualifier === "472") {
        currentClaim.date_of_service = formatDateFromEDI(els[2] || "");
      }
    }

    // AMT — supplemental amounts (informational)
    // Not strictly needed since CLP has the data, but useful for cross-check
  }

  // Push the last claim
  if (currentClaim) {
    results.push(currentClaim);
  }

  // Deduplicate denial codes per claim
  results.forEach((r) => {
    r.raw_denial_codes = [...new Set(r.raw_denial_codes)];
    // Calculate patient responsibility from PR adjustments if CLP didn't provide it
    if (r.patient_responsibility === 0) {
      const prTotal = r.adjustment_groups
        .filter((a) => a.group_code === "PR")
        .reduce((sum, a) => sum + a.amount, 0);
      if (prTotal > 0) r.patient_responsibility = prTotal;
    }
  });

  return results;
}

/** Determine the claim status to set based on CLP02 */
export function mapClaimStatus(
  clpStatusCode: string
): "paid" | "denied" | "needs_correction" {
  if (clpStatusCode === "1" || clpStatusCode === "19") return "paid";
  if (clpStatusCode === "3" || clpStatusCode === "4") return "denied";
  return "needs_correction"; // status 2 (adjusted), 22 (reversal), or unknown
}

/** Extract the CO-45 write-off amount from adjustments */
export function extractCO45WriteOff(adjustments: AdjustmentGroup[]): number {
  return adjustments
    .filter((a) => a.group_code === "CO" && a.reason_code === "45")
    .reduce((sum, a) => sum + a.amount, 0);
}

/** Get the first non-CO-45 denial code for the denial_code field */
export function getPrimaryDenialCode(
  adjustments: AdjustmentGroup[]
): { code: string; reason: string } | null {
  const nonCO45 = adjustments.find(
    (a) =>
      !(a.group_code === "CO" && a.reason_code === "45") &&
      a.group_code !== "PR" // PR is patient responsibility, not a denial
  );
  if (!nonCO45) return null;
  return {
    code: `${nonCO45.group_code}-${nonCO45.reason_code}`,
    reason: `${nonCO45.group_code}-${nonCO45.reason_code}`,
  };
}

/** Validate that the content looks like an 835 file */
export function isValid835(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.includes("ISA") && trimmed.includes("CLP");
}

/**
 * Reverse-match a CLP01 patient control number (YYMMDD-XXXXXXXX) to find the
 * claim UUID prefix. Returns the 8-char hex prefix from the claim UUID.
 */
export function parsePatientControlNumber(pcn: string): { datePart: string; idPrefix: string } | null {
  // Format: YYMMDD-XXXXXXXX
  const match = pcn.match(/^(\d{6})-([A-Fa-f0-9]{8})$/);
  if (!match) return null;
  return { datePart: match[1], idPrefix: match[2].toLowerCase() };
}
