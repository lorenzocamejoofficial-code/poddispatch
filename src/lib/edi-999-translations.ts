/**
 * EDI 999 Implementation Acknowledgement — IK error code translations.
 *
 * Kept SEPARATE from src/lib/denial-code-translations.ts because IK codes
 * are EDI structural rejections (envelope/segment/element syntax) emitted
 * by the clearinghouse, not adjudication denials emitted by the payer.
 * They need an `example_fix` field, don't fit the CARC `is_recoverable` /
 * `typical_resolution` model, and target a different audience (biller /
 * developer diagnosing 837P emission vs AR poster working a denied claim).
 *
 * Storage format (see src/lib/edi-999-parser.ts): rejection_codes is
 * stored as ["SEG-<n>", "ELE-<n>"] where <n> is the IK3-04 / IK4 element
 * error code. The "IK304", "IK403*1" style is the X12 spec alias for the
 * same numeric values. translateIKCode() accepts both forms.
 */

export type IKCategory =
  | "segment_error" // IK3 / AK3 — segment-level
  | "element_error" // IK4 / AK4 — element-level
  | "transaction_ack" // IK5 / AK9 — transaction-set / functional group
  | "unknown";

export interface IKTranslation {
  code: string;
  category: IKCategory;
  plain_english_explanation: string;
  action_required: string;
  example_fix: string;
}

/**
 * Source map keyed by the canonical X12 alias (IK3<n>, IK4*<n>, IK5/AK9
 * with status letter). translateIKCode() also matches the SEG-<n> /
 * ELE-<n> storage format and bare status letters.
 */
const IK_CODES: Record<string, IKTranslation> = {
  // ── IK3 / AK3 — Segment Syntax Error Code (positions 1-8) ──
  IK301: {
    code: "IK301",
    category: "segment_error",
    plain_english_explanation: "Unrecognized segment ID.",
    action_required:
      "The segment name sent isn't part of the 837P implementation guide.",
    example_fix:
      "Remove the unrecognized segment or fix the typo in the segment ID.",
  },
  IK302: {
    code: "IK302",
    category: "segment_error",
    plain_english_explanation:
      "Unexpected segment, segment appeared where it isn't allowed.",
    action_required:
      "Either the segment was sent in the wrong loop, or a parent segment that should precede it is missing.",
    example_fix:
      "Verify loop boundaries (e.g. NM1 starting a new 2310 loop before all 2400 segments closed).",
  },
  IK303: {
    code: "IK303",
    category: "segment_error",
    plain_english_explanation: "A required segment is missing.",
    action_required:
      "The implementation guide requires this segment for the loop/situation but it wasn't sent.",
    example_fix:
      "Add the missing segment (commonly REF for prior auth, DTP for service dates, or SBR for secondary payers).",
  },
  IK304: {
    code: "IK304",
    category: "segment_error",
    plain_english_explanation: "Segment has data element errors.",
    action_required:
      "The segment was recognized but one or more of its elements failed validation. See the accompanying ELE-/IK4 codes for the specific element problems.",
    example_fix:
      "Read the paired ELE-<n> codes, those identify which element inside this segment is wrong.",
  },
  IK305: {
    code: "IK305",
    category: "segment_error",
    plain_english_explanation:
      "Segment was repeated more times than the implementation guide allows.",
    action_required:
      "A segment that has a usage cap (e.g. max 5 ICD pointers) was sent more times than permitted.",
    example_fix:
      "Collapse duplicate segments or trim down to the max allowed occurrences.",
  },
  IK306: {
    code: "IK306",
    category: "segment_error",
    plain_english_explanation: "Loop occurs over maximum times.",
    action_required:
      "A loop (e.g. 2400 service-line loop) was sent more times than the implementation guide allows.",
    example_fix:
      "Split the claim across multiple submissions if you genuinely have that many lines.",
  },
  IK307: {
    code: "IK307",
    category: "segment_error",
    plain_english_explanation:
      "Segment not in proper sequence within the loop.",
    action_required:
      "Segments inside a loop must appear in the order specified by the implementation guide.",
    example_fix:
      "Reorder segments, e.g. CLM must precede DTP*472 inside loop 2300.",
  },
  IK308: {
    code: "IK308",
    category: "segment_error",
    plain_english_explanation:
      "Segment violates a syntax rule (paired/conditional element rule failed).",
    action_required:
      "Two elements have a relationship (one requires the other, or they're mutually exclusive) and that rule was broken.",
    example_fix:
      "Inspect the segment's syntax rules in the IG, usually means a conditionally required companion element is missing.",
  },

  // ── IK4 / AK4 — Element Syntax Error Code ──
  "IK403*1": {
    code: "IK403*1",
    category: "element_error",
    plain_english_explanation: "Required data element is missing.",
    action_required:
      "A field the payer/IG marks as required for this situation was sent empty.",
    example_fix:
      "Populate the field, commonly missing: rendering provider NPI, member ID, prior auth number, ambulance condition codes.",
  },
  "IK403*2": {
    code: "IK403*2",
    category: "element_error",
    plain_english_explanation:
      "Conditional required data element missing.",
    action_required:
      "Element is required because another field has a specific value (e.g. if secondary payer, secondary member ID required).",
    example_fix:
      "Check the conditional rule and populate the dependent field.",
  },
  "IK403*3": {
    code: "IK403*3",
    category: "element_error",
    plain_english_explanation: "Too many data elements in segment.",
    action_required:
      "More elements were sent than the segment defines.",
    example_fix:
      "Trim trailing element separators or extra components.",
  },
  "IK403*4": {
    code: "IK403*4",
    category: "element_error",
    plain_english_explanation: "Data element too short.",
    action_required:
      "Value sent is shorter than the minimum length defined by the IG.",
    example_fix:
      "Pad or correct the value (e.g. NPIs must be exactly 10 digits, ICD-10 codes at least 3 chars).",
  },
  "IK403*5": {
    code: "IK403*5",
    category: "element_error",
    plain_english_explanation: "Data element too long.",
    action_required:
      "Value sent exceeds the maximum length defined by the IG.",
    example_fix:
      "Truncate to the allowed max, common offenders: patient name, address line, payer name.",
  },
  "IK403*6": {
    code: "IK403*6",
    category: "element_error",
    plain_english_explanation: "Invalid character in data element.",
    action_required:
      "Element contains a character outside the allowed character set (alpha/numeric/AN).",
    example_fix:
      "Strip special characters, commas, ampersands, apostrophes, accented letters often cause this.",
  },
  "IK403*7": {
    code: "IK403*7",
    category: "element_error",
    plain_english_explanation: "Invalid code value.",
    action_required:
      "Value sent isn't part of the allowed code list for this element.",
    example_fix:
      "Re-check the IG code list, common offenders: HCPCS modifier, place-of-service code, claim filing indicator, condition code.",
  },
  "IK403*8": {
    code: "IK403*8",
    category: "element_error",
    plain_english_explanation: "Invalid date.",
    action_required:
      "Date doesn't conform to CCYYMMDD format or represents an impossible calendar date.",
    example_fix:
      "Verify the date is real (not 20260230) and uses the expected format (CCYYMMDD for DTP, CCYYMMDD-CCYYMMDD for ranges).",
  },
  "IK403*9": {
    code: "IK403*9",
    category: "element_error",
    plain_english_explanation: "Invalid time.",
    action_required:
      "Time doesn't conform to HHMM/HHMMSS format.",
    example_fix:
      "Use 24-hour HHMM (e.g. 0930, 1745).",
  },
  "IK403*10": {
    code: "IK403*10",
    category: "element_error",
    plain_english_explanation: "Exclusion condition violated.",
    action_required:
      "Element sent that is mutually exclusive with another element already present.",
    example_fix:
      "Remove one of the two conflicting elements per the IG's exclusion rule.",
  },
  "IK403*12": {
    code: "IK403*12",
    category: "element_error",
    plain_english_explanation: "Too many repetitions.",
    action_required:
      "A repeating composite element exceeded its max repeat count.",
    example_fix:
      "Reduce the number of repetitions, e.g. max 4 diagnosis code pointers per service line.",
  },
  "IK403*I6": {
    code: "IK403*I6",
    category: "element_error",
    plain_english_explanation: "Code value not used in implementation.",
    action_required:
      "Value sent is valid X12 but isn't permitted by the 837P implementation guide.",
    example_fix:
      "Use only IG-approved values, e.g. some claim filing indicators are reserved/unused.",
  },
  "IK403*I9": {
    code: "IK403*I9",
    category: "element_error",
    plain_english_explanation:
      "Implementation-dependent data element missing.",
    action_required:
      "The IG marks this element required under the situational rule that applies here, but it wasn't sent.",
    example_fix:
      "Add the missing element, frequently the rendering provider NPI in loop 2310B for ambulance claims, or the ambulance pick-up address ZIP in HSD.",
  },
  "IK403*I10": {
    code: "IK403*I10",
    category: "element_error",
    plain_english_explanation:
      "Implementation 'not used' element was present.",
    action_required:
      "An element the IG marks as 'not used' was sent.",
    example_fix: "Remove the disallowed element from the segment.",
  },
  "IK403*I12": {
    code: "IK403*I12",
    category: "element_error",
    plain_english_explanation:
      "Implementation pattern match failure.",
    action_required:
      "Element matched the base X12 type but failed an implementation-specific regex (e.g. ICN format).",
    example_fix:
      "Match the IG-specified pattern, e.g. payer claim control numbers often require a specific prefix/length.",
  },

  // ── IK5 / AK9 — Transaction Set / Functional Group Acknowledgment ──
  IK501A: {
    code: "IK501 (A)",
    category: "transaction_ack",
    plain_english_explanation: "Transaction set accepted.",
    action_required: "No action, the transaction was accepted.",
    example_fix: "—",
  },
  IK501E: {
    code: "IK501 (E)",
    category: "transaction_ack",
    plain_english_explanation:
      "Transaction set accepted but with errors.",
    action_required:
      "Claim made it through, but the noted errors should be fixed before next submission to avoid future hard rejections.",
    example_fix:
      "Review paired IK3/IK4 codes and correct in 837P emission.",
  },
  IK501R: {
    code: "IK501 (R)",
    category: "transaction_ack",
    plain_english_explanation: "Transaction set rejected.",
    action_required:
      "Claim was not accepted. Fix the errors flagged by paired IK3/IK4 codes and resubmit.",
    example_fix: "Correct structural errors and resubmit the 837P.",
  },
  IK501M: {
    code: "IK501 (M)",
    category: "transaction_ack",
    plain_english_explanation:
      "Transaction set rejected, message authentication code failure.",
    action_required:
      "Authentication/integrity check failed. Almost always a clearinghouse infrastructure issue.",
    example_fix: "Contact Office Ally support.",
  },
  IK501W: {
    code: "IK501 (W)",
    category: "transaction_ack",
    plain_english_explanation:
      "Transaction set rejected, assurance failed validity tests.",
    action_required:
      "Envelope or trailer counts don't match content. Indicates an emission bug.",
    example_fix:
      "Verify SE01 segment count matches actual segments in transaction.",
  },
  IK501X: {
    code: "IK501 (X)",
    category: "transaction_ack",
    plain_english_explanation:
      "Transaction set rejected, content after decryption could not be analyzed.",
    action_required:
      "Clearinghouse couldn't decrypt the file. Infrastructure issue.",
    example_fix: "Contact Office Ally support.",
  },
  AK9A: {
    code: "AK9 (A)",
    category: "transaction_ack",
    plain_english_explanation:
      "Functional group accepted, all transactions cleared.",
    action_required: "No action.",
    example_fix: "—",
  },
  AK9E: {
    code: "AK9 (E)",
    category: "transaction_ack",
    plain_english_explanation:
      "Functional group accepted with errors.",
    action_required:
      "Group was accepted but at least one transaction has errors.",
    example_fix: "Review individual IK5 transaction outcomes.",
  },
  AK9P: {
    code: "AK9 (P)",
    category: "transaction_ack",
    plain_english_explanation:
      "Functional group partially accepted, some transactions rejected.",
    action_required:
      "Some claims were accepted; others were rejected. Resubmit rejected transactions only after fixing.",
    example_fix:
      "Look at IK5 for each rejected transaction inside the group.",
  },
  AK9R: {
    code: "AK9 (R)",
    category: "transaction_ack",
    plain_english_explanation:
      "Functional group rejected, no transactions processed.",
    action_required:
      "Entire batch failed at the envelope level. Fix the structural error and resubmit.",
    example_fix:
      "Common cause: GS/GE control number mismatch or invalid receiver ID.",
  },
};

/**
 * Normalize a raw code from any of the three forms we see in the wild:
 *   - "IK304", "IK403*1", "IK501A", "AK9R"   (X12 spec alias)
 *   - "SEG-4", "ELE-1", "ELE-I9"             (our edi-999-parser storage format)
 *   - "A", "E", "P", "R", "X"                (bare AK9/IK5 status letter)
 */
function normalizeIKCode(raw: string): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();

  // Already a canonical form
  if (IK_CODES[code]) return code;

  // Storage format: SEG-<n> → IK30<n>
  const segMatch = code.match(/^SEG-(\w+)$/);
  if (segMatch) {
    const candidate = `IK30${segMatch[1]}`;
    return IK_CODES[candidate] ? candidate : null;
  }

  // Storage format: ELE-<n> → IK403*<n>
  const eleMatch = code.match(/^ELE-(\w+)$/);
  if (eleMatch) {
    const candidate = `IK403*${eleMatch[1]}`;
    return IK_CODES[candidate] ? candidate : null;
  }

  // Bare AK9/IK5 status letter
  if (/^[AEPRMWX]$/.test(code)) {
    const candidate = `IK501${code}`;
    return IK_CODES[candidate] ? candidate : null;
  }

  return null;
}

export function translateIKCode(raw: string): IKTranslation | null {
  const normalized = normalizeIKCode(raw);
  return normalized ? IK_CODES[normalized] : null;
}

/**
 * Translate a list of raw codes (mixed formats accepted), dedupe by
 * canonical code, and return both the unrecognized originals and the
 * resolved translations.
 */
export function translateIKCodes(rawCodes: string[]): {
  translated: IKTranslation[];
  unrecognized: string[];
} {
  const translated: IKTranslation[] = [];
  const seen = new Set<string>();
  const unrecognized: string[] = [];
  for (const raw of rawCodes) {
    const norm = normalizeIKCode(raw);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      translated.push(IK_CODES[norm]);
    } else if (!norm) {
      unrecognized.push(raw);
    }
  }
  return { translated, unrecognized };
}

/**
 * Render a single raw code as a compact "RAW — plain english" string
 * suitable for inline display next to the raw code.
 */
export function glossIKCode(raw: string): string {
  const t = translateIKCode(raw);
  if (!t) return raw;
  return `${raw}, ${t.plain_english_explanation}`;
}