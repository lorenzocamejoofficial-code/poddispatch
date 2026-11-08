import { describe, it, expect } from "vitest";
import { evaluateRunAcceptance } from "./run-acceptance";
import type { FeasibilityBuffers, FeasibilityLeg } from "./schedule-feasibility";
import type { SuggestionRun, TruckCandidate } from "./truck-suggestion";
import type { CrewCapability } from "./safety-rules";
import type { RunTier } from "./run-priority";
import { travelFloorMinutes } from "./geo-distance";

// Synthetic fixtures only — no PHI.
const buffers: FeasibilityBuffers = { loadMinutes: 10, unloadMinutes: 10, graceMinutes: 0, minGapMinutes: 45 };
const crew: CrewCapability = { member1: { sex: "M" }, member2: { sex: "M" } };
const leg = (id: string, pickup: number | null, extra: Partial<FeasibilityLeg> = {}): FeasibilityLeg => ({
  legId: id, label: `Synthetic ${id}`, legKind: "A", scheduledPickup: pickup, predictedReturn: null,
  mustArriveBy: null, tripMinutes: 30, slotOrder: 0, ...extra,
});
const run = (pickup: number, extra: Partial<SuggestionRun> = {}): SuggestionRun => ({
  ...leg("new", pickup), service_level: "BLS", patient: { weight_lbs: 150 }, ...extra,
});
const truck = (id: string, assigned: FeasibilityLeg[], extra: Partial<TruckCandidate> = {}): TruckCandidate => ({
  truckId: id, service_level: "BLS", equipment: {}, crew, assignedRuns: assigned, ...extra,
});
const tiers = (m: Record<string, RunTier>) => (id: string) => m[id] ?? 3;

describe("evaluateRunAcceptance", () => {
  it("clean truck → coverable, no breaks", () => {
    const r = evaluateRunAcceptance({ run: run(600), candidates: [truck("T1", [leg("a", 300)])], buffers });
    expect(r.coverable).toBe(true);
    expect(r.leastBadTruck).toMatchObject({ truckId: "T1", breaks: [] });
  });

  it("no clean truck → least-bad truck with how-late breaks", () => {
    // existing ends 600+50=650; run at 660 → gap 10, needs 45 → 35 short
    const r = evaluateRunAcceptance({ run: run(660), candidates: [truck("T1", [leg("a", 600)])], buffers });
    expect(r.coverable).toBe(false);
    expect(r.leastBadTruck?.truckId).toBe("T1");
    expect(r.leastBadTruck?.breaks).toEqual([{ legId: "a", label: "Synthetic a", kind: "tight-gap", howLateMin: 35, tier: 3 }]);
  });

  it("a truck that would break a Tier 1 run is never least-bad", () => {
    const r = evaluateRunAcceptance({
      run: run(660), candidates: [truck("T1", [leg("t1", 600)])], buffers, tierOf: tiers({ t1: 1 }),
    });
    expect(r.leastBadTruck).toBeNull();
    expect(r.runShouldYield).toBe(true);
  });

  it("fewer Tier 2 breaks beats fewer total minutes", () => {
    const r = evaluateRunAcceptance({
      run: run(660),
      candidates: [truck("T1", [leg("b2", 610)]), truck("T2", [leg("c3", 560)])],
      buffers, tierOf: tiers({ b2: 2 }),
    });
    expect(r.leastBadTruck?.truckId).toBe("T2");
  });

  it("safety/ALS/down blocks are never least-bad", () => {
    const r = evaluateRunAcceptance({
      run: run(660, { service_level: "ALS" }),
      candidates: [truck("BLS", [leg("a", 600)]), truck("DOWN", [], { service_level: "ALS", downForDay: true })],
      buffers,
    });
    expect(r.coverable).toBe(false);
    expect(r.leastBadTruck).toBeNull();
    expect(r.perTruck.every((t) => t.blockedReason)).toBe(true);
  });

  it("no crewed trucks → not coverable, no recommendation", () => {
    const r = evaluateRunAcceptance({ run: run(600), candidates: [], buffers });
    expect(r).toMatchObject({ coverable: false, leastBadTruck: null, runShouldYield: false });
  });

  it("works with no geo at all and adds a travel break only when facility coords exist", () => {
    // existing ends 650; run at 700 → 50-min gap passes time-only
    const far = { lat: 34.15, lng: -84.39 }, here = { lat: 33.75, lng: -84.39 };
    const plain = evaluateRunAcceptance({ run: run(700), candidates: [truck("T1", [leg("a", 600)])], buffers });
    expect(plain.coverable).toBe(true);
    const geo = evaluateRunAcceptance({
      run: run(700, { originCoord: far }),
      candidates: [truck("T1", [leg("a", 600, { destCoord: here })])],
      buffers: { ...buffers, travelFloor: travelFloorMinutes },
    });
    expect(geo.coverable).toBe(false);
    expect(geo.leastBadTruck?.breaks[0]).toMatchObject({ legId: "a", kind: "travel-infeasible" });
    expect(geo.leastBadTruck!.breaks[0].howLateMin).toBeGreaterThan(0);
  });
});
