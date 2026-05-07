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
  adjustments: AdjustmentGroup[];
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
  billing_provider_npi: string; // NM1*85 (Billing Provider) — used for multi-tenant routing safety
}

const CLP_STATUS_MAP: Record<string, string> = {
  "1": "Paid",
  "2": "Adjusted",
  "3": "Denied",
  "4": "Denied — Contact Payer",
  "19": "Paid in Full",
  "22": "Reversal of Previous Payment",
};

export interface PLBAdjustmentParsed {
  provider_npi: string;
  fiscal_period: string; // ISO YYYY-MM-DD
  reason_code: string;   // WO, L6, FC, CS, J1, 72, B2, B3, ...
  reference_id: string;  // text after the colon in PLB03 / PLB05 / ...
  amount: number;        // signed
}

export interface ParsedRemittance {
  bpr_total_paid: number;       // BPR02 (signed)
  payment_date: string;         // BPR16 → ISO YYYY-MM-DD
  payment_method: string;       // BPR04 (CHK / ACH / NON / ...)
  eft_trace_number: string;     // TRN02
  payer_name: string;           // NM1*PR el 3
  payer_id: string;             // NM1*PR el 9
  billing_provider_npi: string; // file-level NM1*85 el 9
  claims: ParsedRemittanceItem[];
  plb_adjustments: PLBAdjustmentParsed[];
}

/**
 * Normalize segment terminators: 835 files may use ~, ~\n, or \n~ patterns.
 * Returns an array of raw segment strings.
 */
function splitSegments(raw: string): { segments: string[]; subElementSeparator: string } {
  // Detect segment terminator — last char of ISA is the terminator
  // ISA is always 106 chars (with separators). The 106th char (index 105) is the segment terminator.
  const trimmed = raw.trim();
  let terminator = "~";
  let subElementSeparator = ":";

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
          // ISA16 (sub-element/component separator) is the single char immediately
          // after the 16th element separator. The segment terminator follows it.
          if (i + 1 < trimmed.length) {
            const candidate = trimmed[i + 1];
            if (candidate && candidate !== "\r" && candidate !== "\n") {
              subElementSeparator = candidate;
            }
          }
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
  const segments = trimmed
    .split(terminator)
    .map((s) => s.replace(/[\r\n]/g, "").trim())
    .filter((s) => s.length > 0);
  return { segments, subElementSeparator };
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
  return parseEDI835Envelope(rawContent).claims;
}

/**
 * Full envelope parser that includes BPR header info, file-level identifiers,
 * and provider-level adjustments (PLB) in addition to per-claim items.
 */
export function parseEDI835Envelope(rawContent: string): ParsedRemittance {
  const { segments, subElementSeparator } = splitSegments(rawContent);
  const results: ParsedRemittanceItem[] = [];
  const plbAdjustments: PLBAdjustmentParsed[] = [];

  let currentClaim: ParsedRemittanceItem | null = null;
  let currentServiceLine: ServiceLine | null = null;
  let loop: "claim" | "service_line" = "claim";
  let payerName = "";
  let payerId = "";
  let bprPaymentDate = ""; // BPR16 payment date, applies to all claims in the file
  // Per-payee-group billing NPI. Reset implicitly each time NM1*85 appears.
  // Each new CLP inherits the most recent NM1*85 value (Loop 1000B scope).
  let currentPayeeNpi = "";
  let bprTotalPaid = 0;
  let bprPaymentMethod = "";
  let trnEftTrace = "";

  for (let i = 0; i < segments.length; i++) {
    const els = parseElements(segments[i]);
    const segId = els[0];

    // BPR — Financial Information (payment header)
    if (segId === "BPR") {
      bprTotalPaid = toNum(els[2]);
      bprPaymentMethod = els[4] || "";
      // BPR16 is the payment/check date in YYYYMMDD format
      if (els[16]) {
        bprPaymentDate = formatDateFromEDI(els[16]);
      }
    }

    // TRN — Reassociation trace number (EFT trace)
    if (segId === "TRN") {
      if (!trnEftTrace) trnEftTrace = els[2] || "";
    }

    // NM1 — Name segments
    if (segId === "NM1") {
      const entityId = els[1];
      if (entityId === "PR") {
        // Payer
        payerName = els[3] || "";
        payerId = els[9] || "";
      } else if (entityId === "85") {
        // Payee / Billing Provider (Loop 1000B). Applies to all subsequent CLPs
        // until the next NM1*85. Multi-payee 835s have one NM1*85 per group.
        // Loop 1000B is envelope-level and never overrides an in-progress claim.
        // The previous claim keeps the NPI it inherited at CLP time; the new value
        // applies to the next CLP forward.
        currentPayeeNpi = els[9] || "";
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
      currentServiceLine = null;
      loop = "claim";

      if (!currentPayeeNpi) {
        // No NM1*85 has appeared yet — leave NPI empty so the writer can quarantine.
        // eslint-disable-next-line no-console
        console.warn(
          "[edi-835-parser] CLP encountered before any NM1*85; billing_provider_npi will be empty for claim",
          els[1]
        );
      }

      const statusCode = els[2] || "";
      currentClaim = {
        patient_control_number: els[1] || "", // CLP01 — our claim reference
        payer_claim_control_number: els[7] || "", // CLP07 — used to link reversals to original payment
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
        billing_provider_npi: currentPayeeNpi, // from most recent NM1*85 (Loop 1000B)
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
          const adj = { group_code: groupCode, reason_code: reasonCode, amount };
          if (loop === "service_line" && currentServiceLine) {
            // Loop 2110 — line-level adjustment, attach to the service line.
            currentServiceLine.adjustments.push(adj);
          } else {
            // Loop 2100 — claim-level adjustment.
            currentClaim.adjustment_groups.push(adj);
          }
          // Aggregate raw denial codes at the claim level for backwards compatibility.
          currentClaim.raw_denial_codes.push(`${groupCode}-${reasonCode}`);
        }
      }
    }

    // SVC — Service Line
    if (segId === "SVC" && currentClaim) {
      const procComposite = els[1] || "";
      // Format: HC:procedure:modifier1:modifier2...
      const procParts = procComposite.split(subElementSeparator);
      const procedureCode = procParts[1] || procParts[0] || "";
      const modifiers = procParts.slice(2).filter(Boolean);

      const svc: ServiceLine = {
        procedure_code: procedureCode,
        modifiers,
        charged_amount: toNum(els[2]),
        paid_amount: toNum(els[3]),
        units: toNum(els[5]) || 1,
        adjustments: [],
      };
      currentClaim.service_lines.push(svc);
      currentServiceLine = svc;
      loop = "service_line";
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

    // PLB — Provider Level Adjustment (file-level, may close out remaining claims)
    if (segId === "PLB") {
      if (currentClaim) {
        results.push(currentClaim);
        currentClaim = null;
      }
      currentServiceLine = null;
      loop = "claim";
      const providerNpi = els[1] || "";
      const fiscalPeriod = formatDateFromEDI(els[2] || "");
      // Triplets begin at index 3: <reasonCode:reference>, <amount>, <reasonCode:reference>, <amount>, ...
      for (let j = 3; j < els.length; j += 2) {
        const composite = els[j];
        const amountStr = els[j + 1];
        if (!composite) continue;
        const [reasonCode, ...refParts] = composite.split(subElementSeparator);
        if (!reasonCode || !reasonCode.trim()) continue;
        const amount = toNum(amountStr);
        plbAdjustments.push({
          provider_npi: providerNpi,
          fiscal_period: fiscalPeriod,
          reason_code: reasonCode.trim(),
          reference_id: refParts.join(subElementSeparator),
          amount,
        });
      }
    }
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

  return {
    bpr_total_paid: bprTotalPaid,
    payment_date: bprPaymentDate,
    payment_method: bprPaymentMethod,
    eft_trace_number: trnEftTrace,
    payer_name: payerName,
    payer_id: payerId,
    // Retained for envelope-level diagnostics; reflects the LAST NM1*85 seen.
    // Per-claim NPI is on each ParsedRemittanceItem.billing_provider_npi.
    billing_provider_npi: currentPayeeNpi,
    claims: results,
    plb_adjustments: plbAdjustments,
  };
}

export type ClaimStatusOutcome =
  | "paid"
  | "denied"
  | "pending"
  | "needs_correction"
  | "reversal"
  | "forwarded";

/**
 * Maps CLP02 (X12 005010X221A1 code list 1029) to internal claim outcomes.
 * The DB recompute trigger may further override `status` based on the net
 * payment ledger (e.g. partial reversals that still leave net > 0 stay paid).
 * Note: code 23 returns "forwarded" here for diagnostic logging, but the
 * trigger collapses it to "denied" so it lands in the denial recovery queue.
 */
export function mapClaimStatus(clpStatusCode: string): ClaimStatusOutcome {
  switch (clpStatusCode) {
    case "1":  return "paid";
    case "2":  return "paid";
    case "3":  return "paid";
    case "19": return "paid";
    case "20": return "paid";
    case "21": return "paid";
    case "4":  return "denied";
    case "11": return "denied";
    case "5":  return "pending";
    case "13": return "pending";
    case "15": return "pending";
    case "25": return "pending";
    case "16": return "needs_correction";
    case "17": return "reversal";
    case "22": return "reversal";
    case "23": return "forwarded";
    default:   return "needs_correction";
  }
}

/** Map CLP02 to a claim_payments.event_type value */
export function mapToEventType(
  clpStatusCode: string
): "payment" | "reversal" | "correction" | "secondary_payment" | "adjustment" {
  if (clpStatusCode === "17" || clpStatusCode === "22") return "reversal";
  if (clpStatusCode === "2" || clpStatusCode === "3" ||
      clpStatusCode === "20" || clpStatusCode === "21") return "secondary_payment";
  if (clpStatusCode === "1" || clpStatusCode === "19") return "payment";
  return "adjustment";
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
