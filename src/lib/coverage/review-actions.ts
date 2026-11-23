/**
 * Pure review-action state transitions for coverage_checks rows. A result is
 * only ever applied to a patient by an explicit user click; this module
 * computes what that click writes. No I/O, no PHI logging.
 */
export type ReviewAction = "confirmed_primary" | "confirmed_secondary" | "confirmed_tertiary" | "dismissed";

export interface CoverageCheckRow {
  id: string;
  check_type: "eligibility" | "discovery";
  status: string;
  payer_name: string | null;
  payer_member_id: string | null;
  group_number?: string | null;
  payer_id?: string | null;
  reviewed: boolean;
  review_action: ReviewAction | null;
}

export interface ReviewPlan {
  checkUpdate: { reviewed: true; review_action: ReviewAction; reviewed_by: string; reviewed_at: string };
  patientUpdate: Record<string, string> | null;
}

export function planReviewAction(
  row: CoverageCheckRow,
  action: ReviewAction,
  userId: string,
  nowIso: string,
): ReviewPlan {
  if (row.reviewed) throw new Error("Coverage result already reviewed");
  const usable =
    (row.check_type === "discovery" && row.status === "coverage_found") ||
    (row.check_type === "eligibility" && row.status === "active");
  if (action !== "dismissed" && (!usable || !row.payer_name)) {
    throw new Error("Only a found/active result with a payer can be confirmed");
  }
  const checkUpdate = { reviewed: true as const, review_action: action, reviewed_by: userId, reviewed_at: nowIso };
  if (action === "dismissed") return { checkUpdate, patientUpdate: null };
  const payerName = row.payer_name;
  if (!payerName) throw new Error("A payer is required");
  const slot = action === "confirmed_secondary" ? "secondary" : action === "confirmed_tertiary" ? "tertiary" : "primary";
  const patientUpdate: Record<string, string> = { [`${slot}_payer`]: payerName };
  if (row.payer_member_id) patientUpdate[slot === "primary" ? "member_id" : `${slot}_member_id`] = row.payer_member_id;
  // Older results have no identifiers: preserve existing values when absent.
  if (row.group_number) patientUpdate[`${slot}_group_number`] = row.group_number;
  if (row.payer_id) patientUpdate[`${slot}_payer_id`] = row.payer_id;
  return { checkUpdate, patientUpdate };
}

/** Unreviewed discovery result implying an un-billed secondary (Missing Money tie-in input). */
export function isSecondaryOpportunity(row: CoverageCheckRow & { implied_cob_order: string }): boolean {
  return !row.reviewed && row.check_type === "discovery" && row.status === "coverage_found" && row.implied_cob_order === "secondary";
}
