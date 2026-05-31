/**
 * Pre-trip billing readiness check for SCHEDULED / not-yet-completed runs.
 *
 * SEPARATE from the completed-claim billability path
 * (deriveBillingStatus / computeCleanTripStatus). Do NOT merge these:
 * - This function answers "will this run be billable when it rolls?"
 * - The completed-claim path answers "is the finished trip clean to bill?"
 *
 * One function, one meaning.
 */

export type PreTripReadiness = "ready" | "needs_attention";

export interface PreTripReadinessResult {
  level: PreTripReadiness;
  reasons: string[];
}

export interface PreTripReadinessInput {
  /** patients.pcs_on_file */
  pcs_on_file?: boolean | null;
  /** patients.auth_required */
  auth_required?: boolean | null;
  /** patients.auth_expiration (YYYY-MM-DD or ISO) */
  auth_expiration?: string | null;
  /** Scheduled pickup time — ISO timestamp OR HH:mm string. Used with runDate for HH:mm. */
  pickup_time?: string | null;
  /** Run date (YYYY-MM-DD) used when pickup_time is HH:mm. Optional. */
  run_date?: string | null;
  /** Transport type — used to skip PCS requirement for emergencies / private pay. */
  trip_type?: string | null;
  /** Set true for one-off runs — patient record may not exist; skip PCS/auth gates. */
  is_oneoff?: boolean | null;
}

/**
 * Resolve a pickup Date from either a full ISO timestamp or an HH:mm + run_date pair.
 */
function resolvePickup(pickup: string | null | undefined, runDate: string | null | undefined): Date | null {
  if (!pickup) return null;
  // ISO timestamp
  if (pickup.includes("T") || pickup.includes("-")) {
    const d = new Date(pickup);
    if (!isNaN(d.getTime())) return d;
  }
  // HH:mm
  const m = pickup.match(/^(\d{1,2}):(\d{2})/);
  if (m && runDate) {
    const d = new Date(`${runDate}T${m[1].padStart(2, "0")}:${m[2]}:00`);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Evaluate billing readiness BEFORE a trip rolls. Returns plain-language reasons.
 */
export function derivePreTripReadiness(input: PreTripReadinessInput): PreTripReadinessResult {
  const reasons: string[] = [];

  // One-off runs and emergencies have different billing paths — don't pre-flag.
  if (input.is_oneoff) return { level: "ready", reasons };
  const tripType = (input.trip_type ?? "").toLowerCase();
  const skipPcs = tripType === "emergency" || tripType === "private_pay";

  // PCS on file — required for non-emergency, non-private-pay transports.
  if (!skipPcs && !input.pcs_on_file) {
    reasons.push("PCS not on file");
  }

  // Authorization required but missing
  if (input.auth_required && !input.auth_expiration) {
    reasons.push("Auth missing");
  }

  // Authorization expires before pickup
  if (input.auth_required && input.auth_expiration) {
    const expDate = new Date(input.auth_expiration);
    const pickup = resolvePickup(input.pickup_time, input.run_date);
    if (!isNaN(expDate.getTime())) {
      if (pickup && expDate.getTime() < pickup.getTime()) {
        reasons.push("Auth expires before pickup");
      } else if (!pickup && expDate.getTime() < Date.now()) {
        reasons.push("Auth expired");
      }
    }
  }

  return { level: reasons.length === 0 ? "ready" : "needs_attention", reasons };
}