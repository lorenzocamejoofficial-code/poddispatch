/**
 * EDI 277CA (Claim Acknowledgement) Parser
 * Conventions mirror src/lib/edi-835-parser.ts.
 *
 * 277CA is the claim-level acknowledgement returned by the clearinghouse
 * confirming whether each individual claim from a previously submitted 837P
 * was accepted, rejected, or forwarded to the destination payer.
 *
 * Per-claim data lives at the STC (Status Information) + REF (Reference) +
 * TRN (Trace) + NM1 (Patient) loop. CLP01 from our 837P is echoed in the
 * REF*1K (Payer Claim Control Number) or TRN02 of this loop, and our
 * patient_control_number in REF*1K / REF*EJ.
 */

export interface ParsedAck277CAClaim {
  patient_control_number: string;       // our CLP01 echoed back (REF*EJ or TRN02)
  payer_claim_control_number: string;   // assigned by clearinghouse/payer (REF*1K)
  status_category_code: string;         // STC01-1 (A0-A8, etc.)
  status_code: string;                  // STC01-2 — health-care claim status
  entity_identifier: string;            // STC01-3
  status_label: string;                 // human label
  free_text: string;                    // STC03 if present
  charge_amount: number;                // STC04
  outcome: "accepted" | "rejected" | "forwarded";
  raw_codes: string[];                  // ["A3:21","A7:507"] flattened for UI
  patient_name: string;
  raw_segment: string;
}

export interface ParsedEDI277CA {
  payer_name: string;       // NM1*PR
  receiver_name: string;    // NM1*41
  trace_numbers: string[];  // TRN02 at envelope level
  claims: ParsedAck277CAClaim[];
}

// STC01-1: Health Care Claim Status Category Code (X12 507)
const CATEGORY_LABELS: Record<string, string> = {
  A0: "Acknowledgement / Forwarded",
  A1: "Acknowledgement / Receipt",
  A2: "Acknowledgement / Acceptance into adjudication",
  A3: "Acknowledgement / Returned as unprocessable",
  A4: "Acknowledgement / Not Found",
  A5: "Acknowledgement / Split Claim",
  A6: "Acknowledgement / Rejected for missing information",
  A7: "Acknowledgement / Rejected for invalid information",
  A8: "Acknowledgement / Rejected for relational field in error",
};

function splitSegments(raw: string): { segments: string[]; subElementSeparator: string } {
  const trimmed = raw.trim();
  let terminator = "~";
  let subElementSeparator = ":";

  if (/^ISA/.test(trimmed)) {
    const elementSep = trimmed[3];
    let count = 0;
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] === elementSep) {
        count++;
        if (count === 16) {
          if (i + 1 < trimmed.length) {
            const c = trimmed[i + 1];
            if (c && c !== "\r" && c !== "\n") subElementSeparator = c;
          }
          const idx = i + 2;
          if (idx < trimmed.length) {
            terminator = trimmed[idx];
            if (terminator === "\r" || terminator === "\n") terminator = "~";
          }
          break;
        }
      }
    }
  }

  const segments = trimmed
    .split(terminator)
    .map((s) => s.replace(/[\r\n]/g, "").trim())
    .filter((s) => s.length > 0);
  return { segments, subElementSeparator };
}

function parseElements(s: string): string[] { return s.split("*"); }
function toNum(v: string | undefined): number {
  if (!v) return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

export function isValid277CA(content: string): boolean {
  const t = content.trim();
  return t.includes("ISA") && (t.includes("ST*277") || t.includes("BHT*0085"));
}

function categoryToOutcome(cat: string): "accepted" | "rejected" | "forwarded" {
  if (cat === "A0") return "forwarded";
  if (cat === "A1" || cat === "A2") return "accepted";
  // A3, A4, A6, A7, A8 → rejected. A5 (split) treated as accepted for tracking.
  if (cat === "A5") return "accepted";
  return "rejected";
}

export function parseEDI277CA(rawContent: string): ParsedEDI277CA {
  const { segments, subElementSeparator } = splitSegments(rawContent);

  let payerName = "";
  let receiverName = "";
  const traceNumbers: string[] = [];
  const claims: ParsedAck277CAClaim[] = [];

  let cur: ParsedAck277CAClaim | null = null;
  let inClaimLoop = false;

  const flush = () => {
    if (cur) {
      cur.outcome = categoryToOutcome(cur.status_category_code);
      cur.status_label = CATEGORY_LABELS[cur.status_category_code] || `Unknown (${cur.status_category_code})`;
      claims.push(cur);
    }
    cur = null;
  };

  for (const seg of segments) {
    const els = parseElements(seg);
    const id = els[0];

    if (id === "NM1") {
      const ent = els[1];
      if (ent === "PR") payerName = els[3] || payerName;
      else if (ent === "41") receiverName = els[3] || receiverName;
      else if (ent === "QC" && cur) {
        const last = els[3] || "";
        const first = els[4] || "";
        cur.patient_name = `${last}, ${first}`.trim();
      }
    } else if (id === "TRN") {
      const trn = els[2] || "";
      if (!inClaimLoop) {
        if (trn) traceNumbers.push(trn);
      } else if (cur && !cur.patient_control_number) {
        // TRN02 inside claim loop sometimes echoes our patient control number
        cur.patient_control_number = trn;
      }
    } else if (id === "STC") {
      // A new STC starts a new claim ack record
      flush();
      const composite = (els[1] || "").split(subElementSeparator);
      cur = {
        patient_control_number: "",
        payer_claim_control_number: "",
        status_category_code: composite[0] || "",
        status_code: composite[1] || "",
        entity_identifier: composite[2] || "",
        status_label: "",
        free_text: els[3] || "",
        charge_amount: toNum(els[4]),
        outcome: "accepted",
        raw_codes: [],
        patient_name: "",
        raw_segment: seg,
      };
      if (composite[0] && composite[1]) cur.raw_codes.push(`${composite[0]}:${composite[1]}`);
      inClaimLoop = true;
    } else if (id === "REF" && cur) {
      const qual = els[1];
      const val = els[2] || "";
      if (qual === "1K") cur.payer_claim_control_number = val;
      // EJ = Patient Account Number; D9 = Claim Number used by some payers; BLT = Original ICN
      if (qual === "EJ" || qual === "D9" || qual === "BLT") {
        if (!cur.patient_control_number) cur.patient_control_number = val;
      }
    } else if (id === "SE") {
      flush();
      inClaimLoop = false;
    }
  }
  flush();

  return {
    payer_name: payerName,
    receiver_name: receiverName,
    trace_numbers: traceNumbers,
    claims,
  };
}