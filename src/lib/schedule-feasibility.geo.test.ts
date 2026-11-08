import { describe, it, expect } from "vitest";
import { evaluateTruckDay, type FeasibilityBuffers, type FeasibilityLeg } from "./schedule-feasibility";
import { travelFloorMinutes } from "./geo-distance";
import { buildFacilityIndex, resolveLegFacilities, withLegCoords } from "./facility-endpoints";

const B: FeasibilityBuffers = { loadMinutes: 10, unloadMinutes: 10, graceMinutes: 0, minGapMinutes: 0 };
const GEO: FeasibilityBuffers = { ...B, travelFloor: travelFloorMinutes };
const NEAR_A = { lat: 33.75, lng: -84.39 };
const NEAR_B = { lat: 33.751, lng: -84.391 };
const FAR = { lat: 34.15, lng: -84.39 }; // ~27.6 mi north → ~72 min floor

const leg = (id: string, pickup: number, extra: Partial<FeasibilityLeg> = {}): FeasibilityLeg => ({
  legId: id, label: `Run ${id}`, legKind: "A", scheduledPickup: pickup, predictedReturn: null,
  mustArriveBy: null, tripMinutes: 20, slotOrder: 0, ...extra,
});
// first leg: 480 + 10 + 20 + 10 = ends 520; second starts 540 → 20-min gap
const pair = (dest: any, origin: any) => [leg("x", 480, { destCoord: dest }), leg("y", 540, { originCoord: origin })];

describe("geo-aware feasibility (additive)", () => {
  it("no coords: output deep-equals the time-only result", () => {
    const legs = [leg("x", 480), leg("y", 540), leg("z", 500)];
    expect(evaluateTruckDay(legs, GEO)).toEqual(evaluateTruckDay(legs, B));
  });
  it("coords present but no travelFloor: identical to today", () => {
    const legs = pair(NEAR_A, FAR);
    expect(evaluateTruckDay(legs, B)).toEqual(evaluateTruckDay([leg("x", 480), leg("y", 540)], B));
  });
  it("far facilities with a 20-min gap → travel-infeasible", () => {
    const r = evaluateTruckDay(pair(NEAR_A, FAR), GEO);
    expect(r.conflicts.map((c) => c.kind)).toEqual(["travel-infeasible"]);
    expect(r.clear).toBe(false);
  });
  it("nearby facilities → no travel conflict", () => {
    expect(evaluateTruckDay(pair(NEAR_A, NEAR_B), GEO).clear).toBe(true);
  });
  it("residence end (null coord) → no geo check", () => {
    expect(evaluateTruckDay(pair(NEAR_A, null), GEO).clear).toBe(true);
    expect(evaluateTruckDay(pair(null, FAR), GEO).clear).toBe(true);
  });
  it("travelFloor returning null → no geo check", () => {
    expect(evaluateTruckDay(pair(NEAR_A, FAR), { ...B, travelFloor: () => null }).clear).toBe(true);
  });
  it("tight-gap still fires alongside travel-infeasible", () => {
    const r = evaluateTruckDay(pair(NEAR_A, FAR), { ...GEO, minGapMinutes: 45 });
    expect(r.conflicts.map((c) => c.kind)).toEqual(["tight-gap", "travel-infeasible"]);
  });
});

describe("facility endpoint resolution (exact name only)", () => {
  const idx = buildFacilityIndex([{ id: "f1", name: "Sample Dialysis North" }, { id: "f2", name: "Test Hospital" }]);
  it("matches exact names ignoring case and outer spaces", () => {
    expect(resolveLegFacilities({ pickup_location: "  test hospital ", destination_location: "SAMPLE DIALYSIS NORTH" }, idx))
      .toEqual({ originFacilityId: "f2", destFacilityId: "f1" });
  });
  it("no partial or fuzzy matches; residential text returns null", () => {
    expect(resolveLegFacilities({ pickup_location: "Sample Dialysis", destination_location: "123 Fake St" }, idx))
      .toEqual({ originFacilityId: null, destFacilityId: null });
  });
  it("withLegCoords only looks up resolved facility ids", () => {
    const asked: string[] = [];
    const out = withLegCoords(leg("q", 480), { originFacilityId: null, destFacilityId: "f1" }, (id) => { asked.push(id); return NEAR_A; });
    expect(asked).toEqual(["f1"]);
    expect(out.originCoord).toBeNull();
    expect(out.destCoord).toEqual(NEAR_A);
  });
});

import { applyEndpointChoice, swapEndpointsForReturn } from "./facility-endpoints";

describe("facility id links (preferred over name match)", () => {
  const idx = buildFacilityIndex([{ id: "f1", name: "Sample Dialysis North" }, { id: "f2", name: "Test Hospital" }]);
  it("id wins over a mismatched name", () => {
    expect(resolveLegFacilities({ pickup_location: "Test Hospital", pickup_facility_id: "f1" }, idx).originFacilityId).toBe("f1");
  });
  it("exception text override beats the id", () => {
    expect(resolveLegFacilities({ destination_location: "Test Hospital", destination_facility_id: "f1", destination_overridden: true }, idx).destFacilityId).toBe("f2");
    expect(resolveLegFacilities({ destination_location: "9 Synthetic Ln", destination_facility_id: "f1", destination_overridden: true }, idx).destFacilityId).toBeNull();
  });
  it("null id falls back to exact-name match", () => {
    expect(resolveLegFacilities({ pickup_location: "test hospital", pickup_facility_id: null }, idx).originFacilityId).toBe("f2");
  });
  it("unknown id with no name match → null", () => {
    expect(resolveLegFacilities({ pickup_location: "9 Synthetic Ln", pickup_facility_id: "gone" }, idx).originFacilityId).toBeNull();
  });
  it("picking sets id + name; typing clears the id", () => {
    expect(applyEndpointChoice({ kind: "facility", facility: { id: "f2", name: "Test Hospital" } })).toEqual({ text: "Test Hospital", facilityId: "f2" });
    expect(applyEndpointChoice({ kind: "text", text: "Test Hospita" })).toEqual({ text: "Test Hospita", facilityId: null });
  });
  it("B-leg swaps facility ids with the text", () => {
    expect(swapEndpointsForReturn({ pickup_location: "9 Synthetic Ln", destination_location: "Test Hospital", pickup_facility_id: null, destination_facility_id: "f2" }))
      .toEqual({ pickup_location: "Test Hospital", destination_location: "9 Synthetic Ln", pickup_facility_id: "f2", destination_facility_id: null });
  });
});
