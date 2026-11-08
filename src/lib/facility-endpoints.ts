// Resolve a leg's free-text pickup/destination to a FACILITY by exact name
// (trim + case-insensitive). No fuzzy matching. Residential text never matches.
import type { FeasibilityLeg, GeoPoint } from "./schedule-feasibility";

export interface FacilityRef { id: string; name: string }

const key = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export function buildFacilityIndex(facilities: FacilityRef[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const f of facilities) { const k = key(f.name); if (k && !m.has(k)) m.set(k, f.id); }
  return m;
}

export interface LegEndpoints {
  pickup_location?: string | null;
  destination_location?: string | null;
  /** Linked facility ids (preferred over name match). */
  pickup_facility_id?: string | null;
  destination_facility_id?: string | null;
  /** True when a leg exception overrides that end's text for the day — text then wins. */
  pickup_overridden?: boolean;
  destination_overridden?: boolean;
}

/**
 * Prefer the facility-id link; fall back to exact-name match. A leg-exception
 * text override always wins (the leg goes somewhere else that day). Ids are
 * only accepted if they're in the company's facility index.
 */
export function resolveLegFacilities(
  leg: LegEndpoints,
  index: Map<string, string>,
): { originFacilityId: string | null; destFacilityId: string | null } {
  const known = new Set(index.values());
  const pick = (id: string | null | undefined, overridden: boolean | undefined, text: string | null | undefined) =>
    (!overridden && id && known.has(id)) ? id : (index.get(key(text)) ?? null);
  return {
    originFacilityId: pick(leg.pickup_facility_id, leg.pickup_overridden, leg.pickup_location),
    destFacilityId: pick(leg.destination_facility_id, leg.destination_overridden, leg.destination_location),
  };
}

/** Endpoint-input state helper: picking sets id+name; typing clears the id. */
export function applyEndpointChoice(
  choice: { kind: "facility"; facility: FacilityRef } | { kind: "text"; text: string },
): { text: string; facilityId: string | null } {
  return choice.kind === "facility"
    ? { text: choice.facility.name, facilityId: choice.facility.id }
    : { text: choice.text, facilityId: null };
}

/** B-leg mirrors the A-leg: both text and facility ids swap ends. */
export function swapEndpointsForReturn<T extends { pickup_location: string; destination_location: string; pickup_facility_id: string | null; destination_facility_id: string | null }>(a: T) {
  return {
    pickup_location: a.destination_location, destination_location: a.pickup_location,
    pickup_facility_id: a.destination_facility_id, destination_facility_id: a.pickup_facility_id,
  };
}

/** Attach facility coords (or null) to a feasibility leg. Only facility IDs are looked up. */
export function withLegCoords<T extends FeasibilityLeg>(
  leg: T,
  ends: { originFacilityId: string | null; destFacilityId: string | null },
  getCoords: (facilityId: string) => GeoPoint | null,
): T {
  return {
    ...leg,
    originCoord: ends.originFacilityId ? getCoords(ends.originFacilityId) : null,
    destCoord: ends.destFacilityId ? getCoords(ends.destFacilityId) : null,
  };
}
