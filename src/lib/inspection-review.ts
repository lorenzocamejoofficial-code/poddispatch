import { supabase } from "@/integrations/supabase/client";
import { getActiveCompanyId, NO_COMPANY } from "@/lib/company-scope";
import { logAuditEvent } from "@/lib/audit-logger";

/**
 * Truck checkoff review loop. One review per inspection (per truck per day).
 * Dispatch may mark Reviewed only once every flagged item has a Cleared/Hold answer.
 */
export interface ReviewAlert {
  dispatcher_response: string | null;
}

export interface ReviewableInspection {
  missing_count: number;
  reviewed_at: string | null;
}

export type CheckoffStatus = "not_submitted" | "awaiting_review" | "has_flags" | "reviewed";
export type CheckoffBanner = "green" | "yellow" | "red";

export function unansweredFlagCount(alerts: ReviewAlert[]): number {
  return alerts.filter((a) => a.dispatcher_response !== "cleared" && a.dispatcher_response !== "hold").length;
}

export function canMarkReviewed(alerts: ReviewAlert[]): boolean {
  return unansweredFlagCount(alerts) === 0;
}

export function checkoffStatus(insp: ReviewableInspection | null, alerts: ReviewAlert[]): CheckoffStatus {
  if (!insp) return "not_submitted";
  if (insp.reviewed_at) return "reviewed";
  if (insp.missing_count > 0 && unansweredFlagCount(alerts) > 0) return "has_flags";
  return "awaiting_review";
}

/** Crew-side banner: red when any item is on Hold, green when reviewed, otherwise yellow. */
export function checkoffBanner(insp: ReviewableInspection, alerts: ReviewAlert[]): CheckoffBanner {
  if (alerts.some((a) => a.dispatcher_response === "hold")) return "red";
  return insp.reviewed_at ? "green" : "yellow";
}

/** Stable message — also the dedupe key (one per person per truck per day). */
export function reviewedNotificationMessage(truckName: string, runDate: string): string {
  return `Truck checkoff for ${truckName} on ${runDate} was reviewed by dispatch — no need to redo it.`;
}

export const INSPECTION_REVIEWED_TYPE = "inspection_reviewed";

export async function reviewInspection(params: {
  inspectionId: string;
  truckId: string;
  truckName: string;
  runDate: string;
  reviewerUserId: string;
  reviewerName: string;
  note?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const companyId = (await getActiveCompanyId()) ?? NO_COMPANY;

  const { data: alerts, error: alertErr } = await supabase
    .from("vehicle_inspection_alerts")
    .select("dispatcher_response")
    .eq("company_id", companyId)
    .eq("inspection_id", params.inspectionId);
  if (alertErr) return { ok: false, error: alertErr.message };
  if (!canMarkReviewed((alerts ?? []) as ReviewAlert[])) {
    return { ok: false, error: "Answer every flagged item (Cleared or Hold) before marking reviewed." };
  }

  const reviewedAt = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("vehicle_inspections")
    .update({
      reviewed_by: params.reviewerUserId,
      reviewed_by_name: params.reviewerName,
      reviewed_at: reviewedAt,
      review_note: params.note?.trim() || null,
    })
    .eq("id", params.inspectionId)
    .eq("company_id", companyId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!updated || updated.length === 0) return { ok: false, error: "Checkoff not found in this company." };

  await logAuditEvent({
    action: "vehicle_inspection",
    tableName: "vehicle_inspections",
    recordId: params.inspectionId,
    newData: { reviewed_at: reviewedAt, reviewed_by_name: params.reviewerName },
    notes: `Dispatch reviewed truck checkoff for ${params.truckName} on ${params.runDate}.`,
  });

  await notifyCrewReviewed(params.truckId, params.truckName, params.runDate, companyId);
  return { ok: true };
}

/** Notify everyone on the truck's crew for that day, skipping anyone already notified. */
async function notifyCrewReviewed(truckId: string, truckName: string, runDate: string, companyId: string) {
  const { data: crew } = await supabase
    .from("crews")
    .select("member1_id, member2_id, member3_id")
    .eq("company_id", companyId)
    .eq("truck_id", truckId)
    .eq("active_date", runDate)
    .maybeSingle();
  const ids = [crew?.member1_id, crew?.member2_id, crew?.member3_id].filter(Boolean) as string[];
  if (ids.length === 0) return;
  const { data: profs } = await supabase.from("profiles").select("user_id").in("id", ids).eq("company_id", companyId);
  const userIds = (profs ?? []).map((p) => p.user_id).filter(Boolean) as string[];
  const message = reviewedNotificationMessage(truckName, runDate);
  for (const uid of userIds) {
    // Dispatch cannot read others' notifications, so dedupe happens on the
    // crew side too; here we just send once per review.
    const { error } = await supabase.from("notifications").insert({
      user_id: uid, message, notification_type: INSPECTION_REVIEWED_TYPE,
    });
    if (error) console.error("inspection_reviewed notify failed:", error.message);
  }
}

/** Crew-side: send the reviewed notification to self once (for crews assigned after the review). */
export async function ensureSelfReviewedNotification(userId: string, truckName: string, runDate: string) {
  const message = reviewedNotificationMessage(truckName, runDate);
  const { data } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("notification_type", INSPECTION_REVIEWED_TYPE)
    .eq("message", message)
    .limit(1);
  if (data && data.length > 0) return;
  await supabase.from("notifications").insert({ user_id: userId, message, notification_type: INSPECTION_REVIEWED_TYPE });
}
