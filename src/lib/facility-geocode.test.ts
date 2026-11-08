import { describe, it, expect, beforeEach, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
import * as mod from "./facility-geocode";
import { getFacilityCoords, primeFacilityCoords, __testing } from "./facility-geocode";
import {
  normalizeAddress, parseCensusResponse, geocodeWithCensus, addressHash, nextRetryAt,
} from "../../supabase/functions/_shared/geocode-census";

beforeEach(() => { __testing.reset(); __testing.setInvoker(null); });

describe("normalizeAddress", () => {
  it("folds case, punctuation and suffixes", () => {
    expect(normalizeAddress(" 100  Main Street, Suite 2, Atlanta GA 30303, USA "))
      .toBe("100 MAIN ST STE 2 ATLANTA GA 30303");
  });
  it("is idempotent", () => {
    const a = normalizeAddress("12 North Oak Avenue Macon GA")!;
    expect(normalizeAddress(a)).toBe(a);
  });
  it("rejects empty, short, or name-only input", () => {
    expect(normalizeAddress("")).toBeNull();
    expect(normalizeAddress(null)).toBeNull();
    expect(normalizeAddress("Sample Dialysis Center")).toBeNull();
    expect(normalizeAddress("12 Main")).toBeNull();
  });
});

describe("Census parsing", () => {
  const m = (type: string, x: number, y: number) => ({ matchType: type, coordinates: { x, y } });
  it("prefers Exact and maps x→lng, y→lat", () => {
    const r = parseCensusResponse({ result: { addressMatches: [m("Non_Exact", -80, 30), m("Exact", -84.39, 33.75)] } });
    expect(r).toEqual({ status: "matched", lat: 33.75, lng: -84.39, match_quality: "Exact" });
  });
  it("empty matches → no_match", () => {
    expect(parseCensusResponse({ result: { addressMatches: [] } }).status).toBe("no_match");
  });
  it("out-of-range coords → no_match", () => {
    expect(parseCensusResponse({ result: { addressMatches: [m("Exact", 500, 33)] } }).status).toBe("no_match");
  });
  it("500 and network failure → error, never throws", async () => {
    const f500 = vi.fn(async () => new Response("x", { status: 500 })) as unknown as typeof fetch;
    expect((await geocodeWithCensus("1 A ST X GA", f500)).status).toBe("error");
    const boom = vi.fn(async () => { throw new Error("down"); }) as unknown as typeof fetch;
    expect((await geocodeWithCensus("1 A ST X GA", boom)).status).toBe("error");
  });
  it("timeout → error", async () => {
    const hang = ((_u: string, init: RequestInit) => new Promise((_, rej) => {
      init.signal?.addEventListener("abort", () => rej(new Error("aborted")));
    })) as unknown as typeof fetch;
    expect((await geocodeWithCensus("1 A ST X GA", hang, 10)).status).toBe("error");
  });
  it("calls the Census onelineaddress endpoint with Public_AR_Current", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ result: { addressMatches: [] } }))) as unknown as typeof fetch;
    await geocodeWithCensus("1 A ST X GA", f);
    const url = String((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(url).toContain("geocoding.geo.census.gov/geocoder/locations/onelineaddress");
    expect(url).toContain("benchmark=Public_AR_Current");
  });
  it("backoff is 1h, 6h, then 24h", () => {
    expect(nextRetryAt(1, 0)).toBe(new Date(3600_000).toISOString());
    expect(nextRetryAt(2, 0)).toBe(new Date(6 * 3600_000).toISOString());
    expect(nextRetryAt(9, 0)).toBe(new Date(24 * 3600_000).toISOString());
  });
  it("hash differs per company for the same address", async () => {
    const a = await addressHash("s", "co-a", "1 A ST X GA");
    const b = await addressHash("s", "co-b", "1 A ST X GA");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("facility-geocode client helper", () => {
  it("exposes no generic address-geocoding entry point", () => {
    expect(Object.keys(mod).sort()).toEqual(["__testing", "getFacilityCoords", "primeFacilityCoords"]);
  });
  it("miss returns null synchronously and fetches once in background", async () => {
    const inv = vi.fn(async (ids: string[]) => Object.fromEntries(ids.map((id) => [id, { lat: 1, lng: 2 }])));
    __testing.setInvoker(inv);
    expect(getFacilityCoords("f1")).toBeNull();
    expect(getFacilityCoords("f1")).toBeNull();
    await new Promise((r) => setTimeout(r, 80));
    expect(inv).toHaveBeenCalledTimes(1);
    expect(getFacilityCoords("f1")).toEqual({ lat: 1, lng: 2 });
  });
  it("caches no_match as null without refetching", async () => {
    const inv = vi.fn(async () => ({ f2: null }));
    __testing.setInvoker(inv);
    await primeFacilityCoords(["f2"]);
    expect(getFacilityCoords("f2")).toBeNull();
    await primeFacilityCoords(["f2"]);
    expect(inv).toHaveBeenCalledTimes(1);
  });
  it("edge error resolves to null and does not throw", async () => {
    __testing.setInvoker(async () => { throw new Error("down"); });
    await expect(primeFacilityCoords(["f3"])).resolves.toBeUndefined();
    expect(getFacilityCoords("f3")).toBeNull();
  });
  it("batches in chunks of 50", async () => {
    const inv = vi.fn(async (_ids: string[]) => ({}));
    __testing.setInvoker(inv);
    await primeFacilityCoords(Array.from({ length: 120 }, (_, i) => `f${i}`));
    expect(inv.mock.calls.map((c) => c[0].length)).toEqual([50, 50, 20]);
  });
});
