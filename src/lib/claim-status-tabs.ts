/**
 * Single source of truth for "which billing tab does this claim belong to".
 *
 * The claim_status enum has TEN values, but the Billing & Claims board only
 * renders six tabs. Before this map, membership was a per-tab equality check
 * (`c.status === col.status`), which meant the four extra values —
 * pending, reversal, forwarded, blocked_payer_mapping — matched no tab and
 * rendered nowhere at all. Those claims were invisible.
 *
 * STATUS_TO_TAB is TOTAL: every enum value maps to exactly one tab, so a claim
 * always lands in exactly one bucket and the tab counts always sum to the total.
 * Tabs stay purely status-driven — no blocker-based filtering lives here.
 */

/** Every value of the Postgres `claim_status` enum. */
export type ClaimStatus =
  | "ready_to_bill"
  | "submitted"
  | "paid"
  | "denied"
  | "needs_correction"
  | "needs_review"
  | "pending"
  | "reversal"
  | "forwarded"
  | "blocked_payer_mapping";

/** The six tabs the board renders. Always a subset of ClaimStatus. */
export type ClaimTab =
  | "ready_to_bill"
  | "submitted"
  | "paid"
  | "denied"
  | "needs_correction"
  | "needs_review";

export const CLAIM_TABS: ClaimTab[] = [
  "ready_to_bill",
  "submitted",
  "paid",
  "denied",
  "needs_correction",
  "needs_review",
];

export const STATUS_TO_TAB: Record<ClaimStatus, ClaimTab> = {
  ready_to_bill: "ready_to_bill",
  submitted: "submitted",
  paid: "paid",
  denied: "denied",
  needs_correction: "needs_correction",
  needs_review: "needs_review",
  // Payer-driven in-flight states — the claim is out the door and waiting.
  pending: "submitted",
  forwarded: "submitted",
  // Money came back off the claim — same work as a correction.
  reversal: "needs_correction",
  // Can't be submitted until the payer is mapped — a review task.
  blocked_payer_mapping: "needs_review",
};

/**
 * Extra label shown on the card when a claim sits in a tab under a status
 * that isn't the tab's own name. Null when status === tab.
 */
export const STATUS_SUB_LABEL: Partial<Record<ClaimStatus, string>> = {
  pending: "In process at payer",
  forwarded: "Forwarded to secondary",
  reversal: "Payment reversed",
  blocked_payer_mapping: "Payer not mapped",
};

export function tabForStatus(status: string | null | undefined): ClaimTab {
  return STATUS_TO_TAB[(status ?? "") as ClaimStatus] ?? "needs_review";
}

export function subLabelForStatus(status: string | null | undefined): string | null {
  return STATUS_SUB_LABEL[(status ?? "") as ClaimStatus] ?? null;
}

/** Statuses a biller may set by hand. Payer-driven states stay read-only. */
export const MANUALLY_SETTABLE_STATUSES: ClaimTab[] = CLAIM_TABS;
