/**
 * Claim Probability Score — advisory score (0–100) predicting
 * the likelihood of first-pass acceptance.
 */

export interface ScoreDeduction {
  points: number;
  reason: string;
}

export interface ClaimScoreResult {
  score: number;
  deductions: ScoreDeduction[];
  label: string;
  color: string; // tailwind-compatible color token
}

/**
 * Accepts trip-like and patient-like objects with loose typing so it
 * can work with the various shapes used across the billing queue,
 * PCR page, and pre-submit checklist.
 */
export function computeClaimScore(
  trip: Record<string, any>,
  patient: Record<string, any> | null,
  payerRules: Record<string, any> | null,
): ClaimScoreResult {
  let score = 100;
  const deductions: ScoreDeduction[] = [];

  function deduct(points: number, reason: string) {
    deductions.push({ points, reason });
    score -= points;
  }

  // --- Timestamps ---
  if (!trip.dispatch_time) deduct(10, "Dispatch time not recorded.");
  if (!trip.at_scene_time) deduct(10, "At scene time not recorded.");
  if (!trip.left_scene_time) deduct(10, "Left scene time not recorded.");
  if (!trip.arrived_dropoff_at) deduct(10, "Arrival at destination not recorded.");
  if (!trip.in_service_time) deduct(5, "In service time not recorded.");

  // --- Medical necessity ---
  const hasNecessity = !!(
    trip.bed_confined ||
    trip.cannot_transfer_safely ||
    trip.requires_monitoring ||
    trip.oxygen_during_transport
  );
  if (!hasNecessity) deduct(20, "No medical necessity criteria — highest denial risk.");

  // --- Crew signature ---
  const hasSig =
    (trip.signatures_json && Array.isArray(trip.signatures_json) && trip.signatures_json.length > 0) ||
    trip.signature_obtained;
  if (!hasSig) deduct(15, "No crew signature on PCR.");

  // --- Loaded miles ---
  const loadedMiles = trip.loaded_miles != null ? Number(trip.loaded_miles) : null;
  if (loadedMiles == null || loadedMiles <= 0) {
    deduct(10, "Loaded miles not recorded.");
  }

  // --- Odometer ---
  const odomScene = trip.odometer_at_scene != null ? Number(trip.odometer_at_scene) : null;
  const odomDest = trip.odometer_at_destination != null ? Number(trip.odometer_at_destination) : null;

  if (odomScene == null && odomDest == null) {
    deduct(5, "Odometer readings not recorded.");
  } else if (odomScene != null && odomDest != null) {
    if (odomDest <= odomScene) {
      deduct(5, "Odometer readings appear reversed.");
    } else if (loadedMiles != null && loadedMiles > 0) {
      const odomCalc = odomDest - odomScene;
      if (Math.abs(odomCalc - loadedMiles) > 2) {
        deduct(5, "Mileage discrepancy between odometer and loaded miles.");
      }
    }
  }

  // --- PCS ---
  const isEmergency = (trip.pcr_type ?? "").toLowerCase() === "emergency";
  if (!isEmergency) {
    const pcsRequired = payerRules?.requires_pcs !== false; // default true
    if (pcsRequired) {
      const tripPcsAttached = !!trip.pcs_attached;
      const patientPcsExpired = !!(
        patient?.pcs_expiration_date &&
        trip.run_date &&
        new Date(patient.pcs_expiration_date) < new Date(trip.run_date)
      );
      const patientHasValidPcs = !!patient?.pcs_on_file && !patientPcsExpired;

      if (!tripPcsAttached && !patientHasValidPcs) {
        deduct(15, "PCS missing or expired — required by this payer.");
      }
    }
  }

  // --- Timestamp sequence check ---
  const orderedFields = [
    "dispatch_time",
    "at_scene_time",
    "left_scene_time",
    "arrived_dropoff_at",
    "in_service_time",
  ];
  const timestamps = orderedFields
    .map(f => (trip[f] ? new Date(trip[f]).getTime() : null))
    .filter((t): t is number => t != null);

  if (timestamps.length >= 2) {
    let outOfOrder = false;
    for (let i = 1; i < timestamps.length; i++) {
      if (timestamps[i] < timestamps[i - 1]) {
        outOfOrder = true;
        break;
      }
    }
    if (outOfOrder) {
      deduct(5, "Timestamps out of sequence.");
    }

    // All within 60 seconds
    const spread = Math.max(...timestamps) - Math.min(...timestamps);
    if (spread <= 60_000 && timestamps.length >= 3) {
      deduct(5, "Timestamps appear simultaneously entered.");
    }
  }

  // Clamp
  score = Math.max(0, score);

  return {
    score,
    deductions,
    ...getScoreAppearance(score),
  };
}

export function getScoreAppearance(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Strong", color: "text-[hsl(var(--status-green))]" };
  if (score >= 70) return { label: "Review", color: "text-amber-600" };
  if (score >= 50) return { label: "At Risk", color: "text-orange-600" };
  return { label: "High Risk", color: "text-destructive" };
}

export function getScoreBgClass(score: number): string {
  if (score >= 90) return "bg-[hsl(var(--status-green))]/10 border-[hsl(var(--status-green))]/30";
  if (score >= 70) return "bg-amber-500/10 border-amber-500/30";
  if (score >= 50) return "bg-orange-500/10 border-orange-500/30";
  return "bg-destructive/10 border-destructive/30";
}
