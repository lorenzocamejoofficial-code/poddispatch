/**
 * Origin/destination location types for scheduled legs.
 *
 * CMS ambulance origin/destination modifiers (Medicare Claims Processing
 * Manual, Pub. 100-04, Ch. 15 §30.A) must describe the ACTUAL pickup and
 * drop-off sites (R residence, D/G/J dialysis, H hospital, N SNF, P physician
 * office, ...). A wrong letter is a wrong claim, so these helpers never guess:
 * when a site cannot be identified they return null and the claim readiness
 * gate blocks on the missing type instead of billing a wrong modifier.
 */
import { inferLocationType } from "@/lib/billing-utils";
import { normalizeTransportKind } from "@/lib/transport-vocabulary";

const isDialysisType = (t: string | null | undefined) => !!t && t.toLowerCase().includes("dialysis");

/** Destination of a recurring patient's A-leg (the facility they are taken to). */
export function deriveFacilityLocationType(
  location: string | null | undefined,
  transportType: string | null | undefined,
  facilityTypeMap: Map<string, string>,
): string | null {
  const inferred = inferLocationType(location ?? null, facilityTypeMap);
  // The "Home" heuristic (address starts with a number) cannot describe a
  // treatment facility, so it is never accepted for the facility end.
  if (inferred && inferred !== "Home") {
    if (isDialysisType(inferred) && normalizeTransportKind(transportType ?? "") !== "dialysis") {
      // Only trust a dialysis type for a non-dialysis run when the site is a
      // registered dialysis facility, never from a name substring alone.
      return matchesDialysisFacility(location, facilityTypeMap) ? inferred : null;
    }
    return inferred;
  }
  // A dialysis run's treatment site is by definition a dialysis facility (D;
  // G/J are resolved later from facility metadata). Every other kind stays
  // blank so the gate asks for the real type.
  return normalizeTransportKind(transportType ?? "") === "dialysis" ? "Dialysis Facility" : null;
}

function matchesDialysisFacility(location: string | null | undefined, map: Map<string, string>) {
  const loc = (location ?? "").toLowerCase().trim();
  if (!loc) return false;
  for (const [name, type] of map) if (type === "dialysis" && loc.includes(name.toLowerCase())) return true;
  return false;
}

/** A-leg origin/destination for a recurring patient; the B-leg swaps them. */
export function deriveRecurringLegTypes(input: {
  transportType: string | null | undefined;
  patientLocationType: string | null | undefined;
  pickupAddress: string | null | undefined;
  dropoffFacility: string | null | undefined;
  facilityTypeMap: Map<string, string>;
}): { aOrigin: string | null; aDestination: string | null; bOrigin: string | null; bDestination: string | null } {
  const origin =
    (input.patientLocationType && input.patientLocationType.trim()) ||
    inferLocationType(input.pickupAddress ?? null, input.facilityTypeMap) ||
    null;
  const destination = deriveFacilityLocationType(input.dropoffFacility, input.transportType, input.facilityTypeMap);
  return { aOrigin: origin, aDestination: destination, bOrigin: destination, bDestination: origin };
}

/**
 * Trip origin/destination when a trip is created from a scheduled leg. The
 * leg's stored value wins unless it is the legacy hard-coded dialysis default
 * on a non-dialysis run that does not actually go to a dialysis facility.
 */
export function resolveTripLocationType(
  legValue: string | null | undefined,
  location: string | null | undefined,
  tripType: string | null | undefined,
  facilityTypeMap: Map<string, string>,
): string | null {
  const v = legValue && legValue.trim() ? legValue : null;
  const nonDialysis = normalizeTransportKind(tripType ?? "") !== "dialysis";
  if (v && !(isDialysisType(v) && nonDialysis && !matchesDialysisFacility(location, facilityTypeMap))) return v;
  const inferred = inferLocationType(location ?? null, facilityTypeMap);
  if (inferred && isDialysisType(inferred) && nonDialysis && !matchesDialysisFacility(location, facilityTypeMap)) return null;
  return inferred;
}
