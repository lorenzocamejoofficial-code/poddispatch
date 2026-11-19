import { supabase } from "@/integrations/supabase/client";
import { planReviewAction, type CoverageCheckRow, type ReviewAction } from "@/lib/coverage/review-actions";

/**
 * Applies one user-clicked review action. Patient write first (scoped to the
 * active company), then the check row (guarded by reviewed=false so a second
 * click can't double-apply). Errors are returned without PHI.
 */
export async function applyCoverageReview(opts: {
  row: CoverageCheckRow & { patient_id: string };
  action: ReviewAction;
  userId: string;
  companyId: string;
  client?: typeof supabase;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = opts.client ?? supabase;
  let plan;
  try {
    plan = planReviewAction(opts.row, opts.action, opts.userId, new Date().toISOString());
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Cannot review this result" };
  }
  if (plan.patientUpdate) {
    const { error } = await db.from("patients").update(plan.patientUpdate as any)
      .eq("id", opts.row.patient_id).eq("company_id", opts.companyId);
    if (error) return { ok: false, error: "Could not update the patient's insurance" };
  }
  const { data, error } = await db.from("coverage_checks" as any).update(plan.checkUpdate as any)
    .eq("id", opts.row.id).eq("company_id", opts.companyId).eq("reviewed", false).select("id");
  if (error || !data || (data as any[]).length === 0) return { ok: false, error: "Could not mark the result reviewed" };
  return { ok: true };
}
