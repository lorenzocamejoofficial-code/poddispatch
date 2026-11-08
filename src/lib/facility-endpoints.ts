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

export function resolveLegFacilities(
  leg: { pickup_location?: string | null; destination_location?: string | null },
  index: Map<string, string>,
): { originFacilityId: string | null; destFacilityId: string | null } {
  return {
    originFacilityId: index.get(key(leg.pickup_location)) ?? null,
    destFacilityId: index.get(key(leg.destination_location)) ?? null,
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
