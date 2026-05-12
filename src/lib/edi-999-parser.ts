/**
 * EDI 999 (Implementation Acknowledgement) Parser
 * Conventions mirror src/lib/edi-835-parser.ts: ISA-derived terminator/sub-element
 * detection, linear segment iteration with a small state machine, tolerant
 * parsing that never throws on malformed segments.
 *
 * The 999 reports syntactic acceptance/rejection of a previously submitted
 * functional group (typically the 837P claim batch). At the file level we
 * surface AK9 (group-level overall result) and capture any AK3/IK3 segment
 * errors and AK4/IK4 element errors so we can attach actionable rejection
 * codes to every claim in the rejected functional group.
 */

export interface EDI999SegmentError {
  segment_id_code: string;     // AK3-01 / IK3-01
  segment_position: string;    // AK3-02 / IK3-02
  loop_id: string;             // AK3-03 / IK3-03
  syntax_error_code: string;   // AK3-04 / IK3-04
  element_errors: string[];    // AK4/IK4 codes
}

export interface ParsedEDI999 {
  control_number: string;             // AK1-02 (group control number being ack'd)
  functional_id_code: string;         // AK1-01 (e.g. "HC")
  ak9_overall_status: string;         // A, E, P, R, X
  ak9_label: string;
  groups_received: number;            // AK9-02
  groups_accepted: number;            // AK9-03
  transactions_received: number;      // AK9-04
  transactions_accepted: number;      // AK9-05
  segment_errors: EDI999SegmentError[];
  raw_codes: string[];                // flat list of all error codes for badge display
}

const AK9_STATUS_MAP: Record<string, string> = {
  A: "Accepted",
  E: "Accepted with Errors",
  P: "Partially Accepted",
  R: "Rejected",
  X: "Rejected — Content Decryption Error",
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
            const candidate = trimmed[i + 1];
            if (candidate && candidate !== "\r" && candidate !== "\n") {
              subElementSeparator = candidate;
            }
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

function parseElements(segment: string, sep = "*"): string[] {
  return segment.split(sep);
}

function toInt(v: string | undefined): number {
  if (!v) return 0;
  const n = parseInt(v, 10);
  return isNaN(n) ? 0 : n;
}

export function isValid999(content: string): boolean {
  const t = content.trim();
  // 999 transactions are ST*999. Some vendors still emit 997 — accept both.
  return t.includes("ISA") && (t.includes("ST*999") || t.includes("ST*997"));
}

export function parseEDI999(rawContent: string): ParsedEDI999 {
  const { segments } = splitSegments(rawContent);

  let controlNumber = "";
  let functionalIdCode = "";
  let ak9 = "";
  let groupsReceived = 0;
  let groupsAccepted = 0;
  let txReceived = 0;
  let txAccepted = 0;
  const segmentErrors: EDI999SegmentError[] = [];
  let currentErr: EDI999SegmentError | null = null;

  for (const seg of segments) {
    const els = parseElements(seg);
    const id = els[0];

    if (id === "AK1") {
      functionalIdCode = els[1] || "";
      controlNumber = els[2] || "";
    } else if (id === "AK3" || id === "IK3") {
      currentErr = {
        segment_id_code: els[1] || "",
        segment_position: els[2] || "",
        loop_id: els[3] || "",
        syntax_error_code: els[4] || "",
        element_errors: [],
      };
      segmentErrors.push(currentErr);
    } else if (id === "AK4" || id === "IK4") {
      // AK4-03 carries the syntax error code
      const code = els[3] || els[4] || "";
      if (code && currentErr) currentErr.element_errors.push(code);
    } else if (id === "AK9" || id === "IK5") {
      // IK5 is the transaction-set ack in 005010 999; AK9 in legacy 997.
      ak9 = els[1] || ak9;
      if (id === "AK9") {
        groupsReceived = toInt(els[2]);
        groupsAccepted = toInt(els[3]);
        txReceived = toInt(els[4]);
        txAccepted = toInt(els[5]);
      }
    } else if (id === "SE" || id === "GE" || id === "IEA") {
      currentErr = null;
    }
  }

  // Flatten codes for badge display
  const rawCodes: string[] = [];
  segmentErrors.forEach((e) => {
    if (e.syntax_error_code) rawCodes.push(`SEG-${e.syntax_error_code}`);
    e.element_errors.forEach((c) => rawCodes.push(`ELE-${c}`));
  });

  return {
    control_number: controlNumber,
    functional_id_code: functionalIdCode,
    ak9_overall_status: ak9,
    ak9_label: AK9_STATUS_MAP[ak9] || `Unknown (${ak9 || "?"})`,
    groups_received: groupsReceived,
    groups_accepted: groupsAccepted,
    transactions_received: txReceived,
    transactions_accepted: txAccepted,
    segment_errors: segmentErrors,
    raw_codes: [...new Set(rawCodes)],
  };
}

/** Map AK9/IK5 status to the acknowledgment outcome we store on the claim. */
export function map999Outcome(status: string): "accepted" | "rejected" {
  // A=Accepted, E=Accepted with errors, P=Partially Accepted → treat as accepted at the file level.
  // R=Rejected, X=decrypt error → rejected.
  return status === "R" || status === "X" ? "rejected" : "accepted";
}