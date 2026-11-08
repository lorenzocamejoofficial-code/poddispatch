// Coarse-geo travel-time floor.
//
// This is a LOWER BOUND, not a drive estimate: great-circle (straight-line)
// distance scaled by a road-circuity factor at a flat average speed. No traffic,
// no turns, no road network, no elevation. Its only job is to catch runs that are
// physically impossible across cities (e.g. two stops 40 miles apart with a
// 5-minute gap), never to predict an actual drive. Callers that need real
// routing must use a routing API; this module deliberately does not.
//
// Pure: no network, no database, no imports from feasibility/safety/suggestion
// modules, no mutation of inputs.

export interface Coord {
  lat: number;
  lng: number;
}

/** Mean Earth radius in miles (IUGG mean radius). */
const EARTH_RADIUS_MILES = 3958.8;

/** Flat average speed used for the floor. Deliberately optimistic. */
const DEFAULT_SPEED_MPH = 30;

/** Real road distance is roughly 1.3x straight-line in mixed urban/suburban terrain. */
const DEFAULT_CIRCUITY_FACTOR = 1.3;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** lat -90..90, lng -180..180, finite. Anything else counts as missing. */
function isValidCoord(value: Coord | null | undefined): value is Coord {
  if (!value || typeof value !== "object") return false;
  const { lat, lng } = value;
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** A positive finite override is honored; anything else falls back to the default. */
function positiveOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Great-circle distance in miles between two coordinates.
 * Returns NaN for invalid coordinates instead of throwing; use travelFloorMinutes
 * for the null-returning, degrade-gracefully variant.
 */
export function haversineMiles(a: Coord, b: Coord): number {
  if (!isValidCoord(a) || !isValidCoord(b)) return NaN;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Minimum plausible minutes to travel from `a` to `b`: round(haversineMiles *
 * circuityFactor / speedMph * 60). This is a floor — real travel always takes at
 * least this long, usually more.
 *
 * Returns null when either coordinate is missing or invalid (NaN, out of range),
 * so callers can fall back to time-only feasibility instead of guessing a distance.
 */
export function travelFloorMinutes(
  a: Coord | null | undefined,
  b: Coord | null | undefined,
  opts?: { speedMph?: number; circuityFactor?: number },
): number | null {
  if (!isValidCoord(a) || !isValidCoord(b)) return null;
  const speedMph = positiveOr(opts?.speedMph, DEFAULT_SPEED_MPH);
  const circuityFactor = positiveOr(opts?.circuityFactor, DEFAULT_CIRCUITY_FACTOR);
  const miles = haversineMiles(a, b);
  return Math.round((miles * circuityFactor * 60) / speedMph);
}
