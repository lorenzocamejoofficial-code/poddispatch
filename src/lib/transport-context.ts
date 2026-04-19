/**
 * Central Transport Context Derivation
 * 
 * The scheduling_legs (run record) is the single source of truth.
 * This module derives all downstream behavior from the run's metadata:
 *   - service_level → HCPCS code, charge master rate lookup, crew requirements
 *   - origin_type → PCS defaults, sending facility visibility, origin modifier
 *   - destination_type → PCR section requirements, destination modifier
 *   - is_unscheduled → biller view tagging, PCS treatment, QA rules
 */

export type ServiceLevel = "BLS" | "ALS1" | "ALS2" | "bariatric";

export interface TransportContext {
  serviceLevel: ServiceLevel;
  isEmergency: boolean;
  isUnscheduled: boolean;
  originType: string | null;
  destinationType: string | null;
  tripType: string;
  /** Derived HCPCS base code */
  hcpcsBaseCode: string;
  /** Whether PCS is typically required for this transport context */
  pcsRequired: boolean;
  /** Whether sending facility section should be visible */
  showSendingFacility: boolean;
  /** Whether transfer of care fields should be visible */
  showTransferOfCare: boolean;
  /** PCR type key for section rules */
  pcrTypeKey: string;
}

/**
 * Derive the service level from trip_type or explicit service_level field.
 * trip_type is the scheduling-level classification (dialysis, ift, emergency, etc.)
 * service_level is the explicit BLS/ALS override.
 */
export function deriveServiceLevel(
  tripType: string | null | undefined,
  explicitServiceLevel: string | null | undefined
): ServiceLevel {
  // Explicit service level takes priority
  if (explicitServiceLevel) {
    const sl = explicitServiceLevel.toUpperCase();
    if (sl === "ALS2") return "ALS2";
    if (sl === "ALS1" || sl.includes("ALS")) return "ALS1";
    if (sl.includes("BARI")) return "bariatric";
    return "BLS";
  }

  // Derive from trip type
  const tt = (tripType ?? "").toLowerCase();
  if (tt === "ift" || tt === "ift_discharge") return "ALS1";
  if (tt === "emergency") return "BLS"; // Emergency BLS is most common NEMT
  if (tt === "psych_transport" || tt.includes("psych") || tt.includes("behavioral")) return "BLS";
  return "BLS";
}

/**
 * Derive HCPCS base code from service level and emergency status
 */
export function deriveHcpcsBaseCode(serviceLevel: ServiceLevel, isEmergency: boolean): string {
  if (isEmergency) {
    if (serviceLevel === "ALS1" || serviceLevel === "ALS2") return "A0427"; // ALS1 Emergency
    return "A0429"; // BLS Emergency
  }
  switch (serviceLevel) {
    case "ALS2": return "A0433";
    case "ALS1": return "A0426";
    default: return "A0428"; // BLS Non-Emergency
  }
}

/**
 * Determine if PCS is required based on transport context.
 * Emergency transports and same-day unscheduled do NOT require PCS.
 * IFT and discharge transports from facilities typically require PCS.
 */
export function derivePcsRequired(
  tripType: string | null | undefined,
  isEmergency: boolean,
  isUnscheduled: boolean,
  originType: string | null | undefined
): boolean {
  if (isEmergency) return false;
  if (isUnscheduled) return false; // Same-day unscheduled treated leniently

  const tt = (tripType ?? "").toLowerCase();
  // IFT and discharge always need PCS
  if (tt === "ift" || tt === "ift_discharge" || tt === "discharge") return true;
  // Dialysis with standing order on file — handled by payer rules, not here
  // Default: check origin — if from a facility, PCS likely needed
  const origin = (originType ?? "").toLowerCase();
  if (origin.includes("hospital") || origin.includes("snf") || origin.includes("nursing")) return true;
  return false;
}

/**
 * Determine if sending facility section should be visible based on origin type
 */
export function shouldShowSendingFacility(
  originType: string | null | undefined,
  tripType: string | null | undefined
): boolean {
  const tt = (tripType ?? "").toLowerCase();
  // IFT and discharge always show sending facility
  if (tt === "ift" || tt === "ift_discharge" || tt === "discharge") return true;
  // If origin is a facility, show it
  const origin = (originType ?? "").toLowerCase();
  if (origin.includes("hospital") || origin.includes("snf") || origin.includes("nursing") ||
      origin.includes("rehab") || origin.includes("assisted")) return true;
  return false;
}

/**
 * Determine if transfer of care fields should be visible
 */
export function shouldShowTransferOfCare(
  destinationType: string | null | undefined,
  tripType: string | null | undefined
): boolean {
  const tt = (tripType ?? "").toLowerCase();
  if (tt === "ift" || tt === "ift_discharge") return true;
  const dest = (destinationType ?? "").toLowerCase();
  if (dest.includes("hospital") || dest.includes("emergency")) return true;
  return false;
}

/**
 * Derive the PCR type key used for section rules from trip_type
 */
export function derivePcrTypeKey(tripType: string | null | undefined): string {
  const tt = (tripType ?? "").toLowerCase();
  if (tt === "ift" || tt === "ift_discharge") return "ift";
  if (tt === "discharge") return "discharge";
  if (tt === "emergency") return "emergency";
  if (tt === "outpatient" || tt === "outpatient_specialty") return "outpatient_specialty";
  if (tt === "private_pay") return "private_pay";
  if (tt.includes("wound")) return "wound_care";
  return "dialysis";
}

/**
 * Build a complete transport context from run data.
 * This should be called once and passed to all downstream systems.
 */
export function buildTransportContext(run: {
  trip_type?: string | null;
  pcr_type?: string | null;
  service_level?: string | null;
  origin_type?: string | null;
  destination_type?: string | null;
  is_unscheduled?: boolean | null;
}): TransportContext {
  const tripType = run.trip_type ?? run.pcr_type ?? "dialysis";
  const isEmergency = (run.pcr_type ?? run.trip_type ?? "").toLowerCase() === "emergency";
  const isUnscheduled = !!run.is_unscheduled;
  const serviceLevel = deriveServiceLevel(tripType, run.service_level);
  const hcpcsBaseCode = deriveHcpcsBaseCode(serviceLevel, isEmergency);
  const pcsRequired = derivePcsRequired(tripType, isEmergency, isUnscheduled, run.origin_type);
  const showSendingFacility = shouldShowSendingFacility(run.origin_type, tripType);
  const showTransferOfCare = shouldShowTransferOfCare(run.destination_type, tripType);
  const pcrTypeKey = derivePcrTypeKey(tripType);

  return {
    serviceLevel,
    isEmergency,
    isUnscheduled,
    originType: run.origin_type ?? null,
    destinationType: run.destination_type ?? null,
    tripType,
    hcpcsBaseCode,
    pcsRequired,
    showSendingFacility,
    showTransferOfCare,
    pcrTypeKey,
  };
}
