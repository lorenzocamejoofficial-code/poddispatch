// Pure helpers for FACILITY-address geocoding via the US Census geocoder.
// HIPAA: never pass patient/residential addresses here (see AGENTS.md).
// No Deno APIs so Vitest can import this file too.

const SUFFIXES: Record<string, string> = {
  STREET: "ST", AVENUE: "AVE", ROAD: "RD", DRIVE: "DR", BOULEVARD: "BLVD",
  LANE: "LN", COURT: "CT", PLACE: "PL", PARKWAY: "PKWY", HIGHWAY: "HWY",
  CIRCLE: "CIR", TRAIL: "TRL", SUITE: "STE", APARTMENT: "APT", BUILDING: "BLDG",
  NORTH: "N", SOUTH: "S", EAST: "E", WEST: "W",
  NORTHEAST: "NE", NORTHWEST: "NW", SOUTHEAST: "SE", SOUTHWEST: "SW",
};

/** Normalize a facility address into a stable cache key, or null if it can't be geocoded. */
export function normalizeAddress(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.toUpperCase().replace(/#\s*/g, " STE ").replace(/[.,;:()"']/g, " ");
  const tokens = s.split(/\s+/).filter(Boolean).map((t) => SUFFIXES[t] ?? t);
  while (tokens.length && ["USA", "US"].includes(tokens[tokens.length - 1])) tokens.pop();
  s = tokens.join(" ");
  if (tokens.length < 3 || !/\d/.test(s) || s.length > 300) return null;
  return s;
}

export type GeocodeStatus = "matched" | "no_match" | "error";
export interface GeocodeResult {
  status: GeocodeStatus;
  lat: number | null;
  lng: number | null;
  match_quality: string | null;
}

export const CENSUS_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";

/** Parse a Census onelineaddress JSON body; prefers Exact over Non_Exact. */
export function parseCensusResponse(body: unknown): GeocodeResult {
  // deno-lint-ignore no-explicit-any
  const matches: any[] = (body as any)?.result?.addressMatches ?? [];
  if (!Array.isArray(matches) || matches.length === 0) {
    return { status: "no_match", lat: null, lng: null, match_quality: null };
  }
  const best = matches.find((m) => m?.matchedAddress && m?.tigerLine && m?.coordinates && String(m?.matchType ?? "").toLowerCase() === "exact")
    ?? matches.find((m) => String(m?.matchType ?? "").toLowerCase() === "exact")
    ?? matches[0];
  const lng = Number(best?.coordinates?.x);
  const lat = Number(best?.coordinates?.y);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { status: "no_match", lat: null, lng: null, match_quality: null };
  }
  return { status: "matched", lat, lng, match_quality: best?.matchType ?? null };
}

/** Call Census with a timeout. Network/timeout/non-200 → status "error" (never throws). */
export async function geocodeWithCensus(
  normalized: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 5000,
): Promise<GeocodeResult> {
  const url = `${CENSUS_URL}?address=${encodeURIComponent(normalized)}&benchmark=Public_AR_Current&format=json`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal });
    if (!res.ok) {
      await res.text().catch(() => "");
      return { status: "error", lat: null, lng: null, match_quality: null };
    }
    return parseCensusResponse(await res.json());
  } catch {
    return { status: "error", lat: null, lng: null, match_quality: null };
  } finally {
    clearTimeout(timer);
  }
}

/** Backoff for transient errors: 1h, 6h, 24h (cap). */
export function nextRetryAt(attempts: number, now = Date.now()): string {
  const hours = attempts <= 1 ? 1 : attempts === 2 ? 6 : 24;
  return new Date(now + hours * 3600_000).toISOString();
}

/** HMAC-SHA256(secret, company|normalized) as hex. */
export async function addressHash(secret: string, companyId: string, normalized: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${companyId}|${normalized}`));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
