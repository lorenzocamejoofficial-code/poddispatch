/**
 * Honest denial classifier.
 *
 * Reads CARC codes (from claim.denial_code and/or rejection_codes/CAS) and
 * returns a structured verdict the UI can render without lying to the
 * customer. The goal: never tell a biller "Start recovery" on a CO-45
 * contractual adjustment, and never tell them "Mark closed" on something
 * they could actually appeal.
 *
 * This wraps `denial-code-translations` and adds:
 *   • recoverable: hard yes/no/maybe verdict
 *   • plainEnglish: one-sentence reason a non-biller can understand
 *   • nextAction: the single button label to show on the row
 *   • nextActionKind: which action handler to invoke
 */
import { getDenialTranslation, type DenialTranslation } from "./denial-code-translations";

export type DenialRecoverability = "yes" | "no" | "maybe";

export type NextActionKind =
  | "start_recovery"        // open Denial Recovery Engine
  | "bill_secondary"        // spawn secondary claim (COB)
  | "check_for_secondary"   // deep-link to patient chart to add coverage
  | "bill_patient"          // PR-* → patient statement
  | "mark_closed"           // contractual / non-appealable → write off
  | "call_payer"            // aged, no movement
  | "review"                // needs_correction etc.
  | "none";

export interface DenialVerdict {
  recoverable: DenialRecoverability;
  /** Short label, e.g. "Contractual adjustment — no action" */
  headline: string;
  /** One-sentence plain-English explanation. */
  plainEnglish: string;
  /** Single CTA label that should appear on the row. */
  nextAction: string;
  nextActionKind: NextActionKind;
  /** Backing CARC entry, if recognized. */
  carc?: DenialTranslation;
}

export interface ClassifyInput {
  status: string;                    // "denied" | "paid" | "submitted" | ...
  denial_code?: string | null;       // primary CARC
  rejection_codes?: string[] | null; // extra CARC from CAS / 835 detail
  is_partial_paid?: boolean;
  has_secondary_on_file?: boolean;
  secondary_already_generated?: boolean;
  days_outstanding?: number;
}

/** Pick the first CARC we recognize, preferring denial_code. */
function pickPrimaryCarc(input: ClassifyInput): DenialTranslation | undefined {
  const candidates = [input.denial_code, ...(input.rejection_codes ?? [])]
    .filter((c): c is string => !!c);
  for (const c of candidates) {
    const t = getDenialTranslation(c);
    if (t) return t;
  }
  return undefined;
}

/**
 * Classify a claim row into a single, honest next-step verdict.
 */
export function classifyDenial(input: ClassifyInput): DenialVerdict {
  const carc = pickPrimaryCarc(input);

  // --- Partial-pay branch: usually NOT a denial; it's coordination of benefits
  //     or a contractual adjustment. Don't show "Start recovery" here.
  if (input.is_partial_paid) {
    // Patient-responsibility CARCs → bill patient (the carrier paid what it owed)
    if (carc?.category === "patient_responsibility") {
      return {
        recoverable: "yes",
        headline: "Patient owes the balance",
        plainEnglish: `${carc.plain_english_explanation} The payer paid their portion in full — the remainder is patient responsibility.`,
        nextAction: "Bill patient",
        nextActionKind: "bill_patient",
        carc,
      };
    }
    // Contractual write-off (CO-45 / CO-97 etc.) → not recoverable, close it
    if (carc?.category === "contractual" && !carc.is_recoverable) {
      return {
        recoverable: "no",
        headline: "Contractual adjustment — no action",
        plainEnglish: `${carc.plain_english_explanation} ${carc.action_required}`,
        nextAction: "Mark closed",
        nextActionKind: "mark_closed",
        carc,
      };
    }
    // COB indicators → secondary
    if (carc?.typical_resolution === "bill_secondary" || (input.has_secondary_on_file && !input.secondary_already_generated)) {
      return {
        recoverable: "yes",
        headline: input.has_secondary_on_file ? "Secondary insurance on file" : "Check for secondary coverage",
        plainEnglish: input.has_secondary_on_file
          ? "Primary paid their share. Submit a coordination-of-benefits claim to the secondary payer for the remaining balance."
          : "The primary payer paid only part of the charge. Verify whether the patient has secondary insurance that could cover the remainder.",
        nextAction: input.secondary_already_generated
          ? "View secondary"
          : input.has_secondary_on_file
            ? "Bill secondary"
            : "Check for secondary",
        nextActionKind: input.secondary_already_generated
          ? "review"
          : input.has_secondary_on_file
            ? "bill_secondary"
            : "check_for_secondary",
        carc,
      };
    }
    // Unknown partial-pay scenario — be honest, push to review
    return {
      recoverable: "maybe",
      headline: "Partial payment — review required",
      plainEnglish: "The payer paid less than the billed amount and the reason code isn't recognized. Open the claim to review the EOB.",
      nextAction: "Review",
      nextActionKind: "review",
      carc,
    };
  }

  // --- Denied branch
  if (input.status === "denied") {
    if (carc) {
      // Hard no-recovery cases
      if (!carc.is_recoverable) {
        const isPR = carc.category === "patient_responsibility";
        return {
          recoverable: "no",
          headline: isPR ? "Patient responsibility" : "Closed — no recovery available",
          plainEnglish: `${carc.plain_english_explanation} ${carc.action_required}`,
          nextAction: isPR ? "Bill patient" : "Mark closed",
          nextActionKind: isPR ? "bill_patient" : "mark_closed",
          carc,
        };
      }
      // Recoverable — route by typical resolution
      switch (carc.typical_resolution) {
        case "appeal":
          return {
            recoverable: "yes",
            headline: "Appealable denial",
            plainEnglish: `${carc.plain_english_explanation} ${carc.action_required}`,
            nextAction: "Start recovery",
            nextActionKind: "start_recovery",
            carc,
          };
        case "fix_and_resubmit":
          return {
            recoverable: "yes",
            headline: "Fix and resubmit",
            plainEnglish: `${carc.plain_english_explanation} ${carc.action_required}`,
            nextAction: "Start recovery",
            nextActionKind: "start_recovery",
            carc,
          };
        case "bill_secondary":
          return {
            recoverable: "yes",
            headline: "Wrong payer or COB",
            plainEnglish: `${carc.plain_english_explanation} ${carc.action_required}`,
            nextAction: input.has_secondary_on_file ? "Bill secondary" : "Check for secondary",
            nextActionKind: input.has_secondary_on_file ? "bill_secondary" : "check_for_secondary",
            carc,
          };
        case "bill_patient":
          return {
            recoverable: "yes",
            headline: "Patient responsibility",
            plainEnglish: `${carc.plain_english_explanation} ${carc.action_required}`,
            nextAction: "Bill patient",
            nextActionKind: "bill_patient",
            carc,
          };
        default:
          return {
            recoverable: "maybe",
            headline: "Review denial",
            plainEnglish: `${carc.plain_english_explanation} ${carc.action_required}`,
            nextAction: "Start recovery",
            nextActionKind: "start_recovery",
            carc,
          };
      }
    }
    // Denied but no recognized CARC → biller has to look at the EOB
    return {
      recoverable: "maybe",
      headline: "Unrecognized denial code",
      plainEnglish: "The denial code on this claim isn't in our reference table. Open the claim to review the remittance advice and decide on the next step.",
      nextAction: "Review",
      nextActionKind: "review",
    };
  }

  // --- Submitted / aging branch
  if (input.status === "submitted" && (input.days_outstanding ?? 0) > 30) {
    return {
      recoverable: "maybe",
      headline: "No payer response",
      plainEnglish: "The payer has not responded in more than 30 days. Call payer support to verify the claim was received and is in process.",
      nextAction: "Call payer",
      nextActionKind: "call_payer",
    };
  }

  if (input.status === "needs_correction") {
    return {
      recoverable: "yes",
      headline: "Correction needed before resubmit",
      plainEnglish: "This claim was flagged for a correction. Open it to see which field needs to change.",
      nextAction: "Review",
      nextActionKind: "review",
    };
  }

  return {
    recoverable: "maybe",
    headline: "No action required",
    plainEnglish: "Claim is pending at the payer.",
    nextAction: "",
    nextActionKind: "none",
  };
}