import { describe, it, expect } from "vitest";
import { checkIntakeImpact, INTAKE_LEG_ID, type IntakeForm, type LegInfo } from "./intake-impact";
import type { FeasibilityBuffers, FeasibilityLeg } from "./schedule-feasibility";
import type { TruckCandidate } from "./truck-suggestion";

// Synthetic fixtures only — no PHI.
const buffers: FeasibilityBuffers = { loadMinutes: 10, unloadMinutes: 10, graceMinutes: 0, minGapMinutes: 45 };
const leg = (id: string, pickup: number): FeasibilityLeg => ({
  legId: id, label: `Synthetic ${id}`, legKind: "A", scheduledPickup: pickup, predictedReturn: null,
  mustArriveBy: null, tripMinutes: 30, slotOrder: 0,
});
const form: IntakeForm = {
  pickup_location: "123 Synthetic Rd", destination_location: "Test Center East", trip_type: "outpatient",
  service_level: "BLS", weight_lbs: "150", mobility: "ambulatory", oxygen: false, chair_time: "",
};
const truck = (assigned: FeasibilityLeg[]): TruckCandidate => ({
  truckId: "T1", service_level: "BLS", equipment: {}, crew: { member1: { sex: "M" }, member2: { sex: "M" } }, assignedRuns: assigned,
});
const facilities = [{ id: "fE", name: "Test Center East" }, { id: "fN", name: "Test Center North" }];
const coords: Record<string, { lat: number; lng: number }> = { fE: { lat: 33.75, lng: -84.39 }, fN: { lat: 34.15, lng: -84.39 } };

const base = (assigned: FeasibilityLeg[], legInfo: Map<string, LegInfo>, getCoords = (id: string) => coords[id] ?? null) =>
  checkIntakeImpact({ form, legType: "A", timing: leg(INTAKE_LEG_ID, 600), candidates: [truck(assigned)], buffers, legInfo, facilities, getCoords });

describe("checkIntakeImpact", () => {
  it("time-only triage works with no facility matches", () => {
    const r = base([leg("a", 400)], new Map([["a", { pickup_location: "1 Home Ln", destination_location: "2 Home Ln", leg_type: "A", trip_type: "outpatient", chair_time: null }]]));
    expect(r.coverable).toBe(true);
    expect(r.geoPairsSkipped).toBe(false);
  });
  it("adds a travel break only on a facility-to-facility hop", () => {
    // run 600 ends 650 at Test Center East; next pickup 700 at Test Center North (~72 min away)
    const info = new Map<string, LegInfo>([["b", { pickup_location: "test center north", destination_location: "9 Home Ln", leg_type: "B", trip_type: "outpatient", chair_time: null }]]);
    const r = base([leg("b", 700)], info);
    expect(r.coverable).toBe(false);
    expect(r.leastBadTruck?.breaks[0]).toMatchObject({ legId: "b", kind: "travel-infeasible", tier: 2 });
  });
  it("missing facility coords → time-only and flagged as not yet counted", () => {
    const info = new Map<string, LegInfo>([["b", { pickup_location: "Test Center North", destination_location: null, leg_type: "B", trip_type: "outpatient", chair_time: null }]]);
    const r = base([leg("b", 700)], info, () => null);
    expect(r.coverable).toBe(true);
    expect(r.geoPairsSkipped).toBe(true);
  });
});

describe("checkIntakeImpact with facility id links", () => {
  it("id-linked run with non-matching text still gets a travel break", () => {
    const linkedForm = { ...form, destination_location: "East campus (typed)", destination_facility_id: "fE" };
    const info = new Map<string, LegInfo>([["b", { pickup_location: "North (typed)", pickup_facility_id: "fN", destination_location: null, leg_type: "B", trip_type: "outpatient", chair_time: null }]]);
    const r = checkIntakeImpact({ form: linkedForm, legType: "A", timing: leg(INTAKE_LEG_ID, 600), candidates: [truck([leg("b", 700)])], buffers, legInfo: info, facilities, getCoords: (id) => coords[id] ?? null });
    expect(r.leastBadTruck?.breaks[0]).toMatchObject({ legId: "b", kind: "travel-infeasible" });
  });
});
