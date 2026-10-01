/**
 * cancel-trip — THE single office-side cancel path.
 *
 * Every cancel entry point (Scheduling dialog, Truck Builder, Trips & Clinical
 * flag, Dispatch Board "Confirm Cancel" of a crew request) calls cancelTrip().
 * Do not write trip_records.status = 'cancelled' anywhere else in admin UI.
 *
 * Guarantees:
 *  - A started PCR (in_progress / submitted) becomes 'cancelled_with_pcr', which
 *    forces the crew CancellationDocForm. Already-documented states are never
 *    downgraded.
 *  - Existing claims: not-yet-sent claims are voided; sent claims are flagged to
 *    billers and left untouched.
 *  - Every core write checks its error and throws — no false success.
 *  - Only the day's trip + slot change. The standing scheduling_legs are never touched.
 */
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/audit-logger";

export type CancelSource = "dispatcher" | "trips_clinical" | "truck_builder" | "crew_confirmed";

/** Claims that have not left the building — safe to void at cancel time. */
export const VOIDABLE_CLAIM_STATUSES = [
  "ready_to_bill", "needs_review", "needs_correction", "pending", "blocked_payer_mapping",
] as const;
/** Claims already sent / adjudicated — flag to billers, never silently void. */
export const SENT_CLAIM_STATUSES = ["submitted", "paid", "denied", "forwarded", "reversal"] as const;

export const CLAIM_VOID_NOTE = "Trip was cancelled, claim voided automatically";

/** PCR status rule. Pure — unit tested. */
export function nextPcrStatusOnCancel(current: string | null | undefined): string {
  if (current === "cancelled_with_pcr" || current === "cancelled_documented") return current;
  if (current === "in_progress" || current === "submitted") return "cancelled_with_pcr";
  return current || "not_started";
}

/** Split claims into void / flag buckets. Pure — unit tested. */
export function classifyClaimsForCancel<T extends { status: string | null }>(claims: T[]) {
  const toVoid: T[] = [];
  const toFlag: T[] = [];
  for (const c of claims) {
    const s = c.status ?? "";
    if (s === "voided") continue;
    if ((VOIDABLE_CLAIM_STATUSES as readonly string[]).includes(s)) toVoid.push(c);
    else toFlag.push(c); // sent statuses + anything unknown → human review, never silent void
  }
  return { toVoid, toFlag };
}

export interface ClaimCancelResult { voided: number; flagged: number }

/** Shared void helper — used by cancelTrip() AND the Billing scan. */
export async function voidClaimsForCancelledTrip(
  tripId: string,
  opts: { companyId?: string | null; patientName?: string } = {},
): Promise<ClaimCancelResult> {
  const { data: claims, error } = await supabase
    .from("claim_records" as any)
    .select("id, status, company_id")
    .eq("trip_id", tripId);
  if (error) throw new Error(`Could not load claims for trip: ${error.message}`);
  const { toVoid, toFlag } = classifyClaimsForCancel((claims ?? []) as any[]);

  for (const c of toVoid) {
    const { error: vErr } = await supabase
      .from("claim_records" as any)
      .update({ status: "voided", notes: CLAIM_VOID_NOTE } as any)
      .eq("id", c.id);
    if (vErr) throw new Error(`Could not void claim: ${vErr.message}`);
  }

  if (toFlag.length > 0) {
    const companyId = opts.companyId ?? (toFlag[0] as any).company_id ?? null;
    if (companyId) {
      const { data: billers } = await supabase
        .from("company_memberships")
        .select("user_id")
        .eq("company_id", companyId)
        .in("role", ["biller", "owner"] as any);
      const ids = Array.from(new Set((billers ?? []).map((b: any) => b.user_id).filter(Boolean)));
      if (ids.length > 0) {
        const { error: nErr } = await supabase.from("notifications").insert(
          ids.map((uid) => ({
            user_id: uid,
            message: `Trip cancelled after claim was sent — review${opts.patientName ? ` (${opts.patientName})` : ""}. ${toFlag.length} claim(s) need a payer correction.`,
            notification_type: "billing_review",
            acknowledged: false,
          })) as any,
        );
        if (nErr) throw new Error(`Could not flag sent claim to billers: ${nErr.message}`);
      }
    }
  }
  return { voided: toVoid.length, flagged: toFlag.length };
}

export interface CancelTripParams {
  source: CancelSource;
  reason: string;
  notes?: string;
  patientName: string;
  companyId: string | null;
  runDate: string;
  tripId?: string | null;
  legId?: string | null;
  truckId?: string | null;
  truckName?: string;
  crewNotifiedExternally?: boolean;
  /** Empty string allowed when tripId is given — read from the trip. */
  /** For crew_confirmed: dispatcher verification instead of a new cancel stamp. */
  verification?: { verifiedBy: string | null; dispatcherNote: string };
}

export interface CancelTripResult {
  tripId: string;
  pcrStatus: string;
  claims: ClaimCancelResult;
  documentationRequired: boolean;
}

export async function cancelTrip(p: CancelTripParams): Promise<CancelTripResult> {
  if (!p.reason?.trim()) throw new Error("A cancellation reason is required");
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? null;
  const now = new Date().toISOString();
  const fullReason = `${p.reason}${p.notes ? ` — ${p.notes}` : ""}`;

  // 1. Locate trip
  let tripId = p.tripId ?? null;
  let currentPcr: string | null = null;
  let legId = p.legId ?? null;
  let truckId = p.truckId ?? null;
  let runDate = p.runDate;
  if (!tripId && legId) {
    let q = supabase.from("trip_records" as any).select("id").eq("leg_id", legId).eq("run_date", runDate);
    if (p.companyId) q = q.eq("company_id", p.companyId);
    const { data, error } = await q.maybeSingle();
    if (error) throw new Error(`Could not look up trip: ${error.message}`);
    tripId = (data as any)?.id ?? null;
  }

  const companyId = p.companyId;
  if (tripId) {
    const { data: trip, error } = await supabase
      .from("trip_records" as any)
      .select("pcr_status, leg_id, truck_id, run_date")
      .eq("id", tripId)
      .maybeSingle();
    if (error || !trip) throw new Error(`Could not load trip: ${error?.message ?? "not found"}`);
    currentPcr = (trip as any).pcr_status ?? null;
    legId = legId ?? (trip as any).leg_id ?? null;
    truckId = truckId ?? (trip as any).truck_id ?? null;
    runDate = runDate || (trip as any).run_date || "";
  }

  // 2. PCR documentation rule
  const pcrStatus = nextPcrStatusOnCancel(currentPcr);

  // 3. Write the trip
  if (tripId) {
    const update: Record<string, unknown> = { status: "cancelled", pcr_status: pcrStatus, updated_by: userId };
    if (p.verification) {
      update.cancellation_verified_by = p.verification.verifiedBy;
      update.cancellation_verified_at = now;
      update.cancellation_dispatcher_note = p.verification.dispatcherNote;
      update.cancellation_disputed = false;
    } else {
      update.cancellation_reason = fullReason;
      update.cancelled_by = userId;
      update.cancelled_at = now;
      update.cancellation_source = p.source;
    }
    const { error } = await supabase.from("trip_records" as any).update(update as any).eq("id", tripId);
    if (error) throw new Error(`Could not cancel trip: ${error.message}`);
  } else {
    if (!legId || !companyId) throw new Error("Cannot cancel: no trip or leg found");
    const { data: newTrip, error } = await supabase.from("trip_records" as any).insert({
      leg_id: legId, truck_id: truckId, company_id: companyId, run_date: runDate,
      status: "cancelled", cancellation_reason: fullReason, cancelled_by: userId,
      cancelled_at: now, cancellation_source: p.source, pcr_status: "not_started", trip_type: "dialysis",
    } as any).select("id").single();
    if (error || !newTrip) throw new Error(`Could not record cancellation: ${error?.message ?? "unknown"}`);
    tripId = (newTrip as any).id;
  }

  // 4. Slot for that day only (standing schedule untouched)
  if (legId && runDate) {
    const { error } = await supabase.from("truck_run_slots" as any)
      .update({ status: "cancelled" } as any)
      .eq("leg_id", legId).eq("run_date", runDate);
    if (error) throw new Error(`Trip cancelled but slot not updated: ${error.message}`);
  }

  // 5. Claims
  const claims = await voidClaimsForCancelledTrip(tripId!, { companyId, patientName: p.patientName });

  // 6. Notifications, alert, audit
  if (companyId) {
    if (truckId && runDate) {
      const { data: crewRow } = await supabase.from("crews")
        .select("member1_id, member2_id, member3_id")
        .eq("truck_id", truckId).eq("active_date", runDate).maybeSingle();
      const profileIds = crewRow ? [crewRow.member1_id, crewRow.member2_id, (crewRow as any).member3_id].filter(Boolean) : [];
      if (profileIds.length) {
        const { data: profiles } = await supabase.from("profiles" as any).select("user_id").in("id", profileIds);
        const crewUserIds = (profiles ?? []).map((x: any) => x.user_id).filter(Boolean);
        if (crewUserIds.length) {
          const docLine = pcrStatus === "cancelled_with_pcr" ? " Cancellation documentation required." : "";
          const msg = p.verification
            ? `Your cancellation for ${p.patientName} has been confirmed.${docLine}`
            : `Run cancelled by dispatch, ${p.patientName}, ${p.reason}.${docLine}`;
          const { error } = await supabase.from("notifications").insert(
            crewUserIds.map((uid: string) => ({ user_id: uid, message: msg, notification_type: "cancellation", acknowledged: false })),
          );
          if (error) throw new Error(`Trip cancelled but crew not notified: ${error.message}`);
        }
      }
    }
    const { data: admins } = await supabase.from("company_memberships").select("user_id")
      .eq("company_id", companyId).in("role", ["dispatcher", "owner"] as any);
    const adminIds = (admins ?? []).map((a: any) => a.user_id).filter((u: string) => u && u !== userId);
    if (adminIds.length) {
      const { error } = await supabase.from("notifications").insert(adminIds.map((uid: string) => ({
        user_id: uid,
        message: `Run cancelled, ${p.patientName}${p.truckName ? ` on ${p.truckName}` : ""}, ${fullReason}`,
        notification_type: "cancellation",
      })));
      if (error) throw new Error(`Trip cancelled but office not notified: ${error.message}`);
    }
    if (p.verification) {
      // Crew request already raised a board alert — resolve it.
      await supabase.from("alerts").update({ dismissed: true }).eq("run_id", tripId!).eq("dismissed", false);
    } else {
      const { error: aErr } = await supabase.from("alerts").insert({
        message: `Run cancelled: ${p.patientName}, ${p.reason}`,
        severity: "yellow", truck_id: truckId, run_id: tripId, company_id: companyId, dismissed: false,
      });
      if (aErr) throw new Error(`Trip cancelled but board alert failed: ${aErr.message}`);
    }
  }

  await logAuditEvent({
    action: p.verification ? "cancellation_documented" : "dispatcher_cancellation",
    tableName: "trip_records",
    recordId: tripId!,
    notes: `Cancel via ${p.source} for ${p.patientName}. Reason: ${fullReason}. PCR: ${pcrStatus}. Claims voided ${claims.voided}, flagged ${claims.flagged}${p.crewNotifiedExternally ? ". Crew notified externally" : ""}`,
  });

  return { tripId: tripId!, pcrStatus, claims, documentationRequired: pcrStatus === "cancelled_with_pcr" };
}

/** One plain-English summary line for toasts. */
export function describeCancelResult(patientName: string, r: CancelTripResult): string {
  const parts = [`Run cancelled — ${patientName}`];
  if (r.documentationRequired) parts.push("crew must complete cancellation form");
  if (r.claims.voided) parts.push(`${r.claims.voided} unsent claim(s) voided`);
  if (r.claims.flagged) parts.push(`${r.claims.flagged} sent claim(s) flagged to billing`);
  return parts.join(" · ");
}
