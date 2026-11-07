import { describe, expect, it } from "vitest";
import { buildTruckCandidates, toServiceLevel, toSuggestionRun, type BoardRunInfo } from "./truck-suggestion-candidates";
import { suggestTrucksForRun } from "./truck-suggestion";
import type { FeasibilityBuffers, FeasibilityLeg } from "./schedule-feasibility";
import type { CrewCapability } from "./safety-rules";

// Synthetic fixtures only — no PHI.
const buffers: FeasibilityBuffers = { loadMinutes: 10, unloadMinutes: 10, graceMinutes: 15, minGapMinutes: 45 };
const timing = (legId: string, pickup: number, slotOrder = 0): FeasibilityLeg => ({
  legId, label: `Synthetic ${legId}`, legKind: "A", scheduledPickup: pickup,
  predictedReturn: null, mustArriveBy: null, tripMinutes: 30, slotOrder,
});
const trained = { sex: "M", stair_chair_trained: true, bariatric_trained: true, oxygen_handling_trained: true, lift_assist_ok: true };
const mfCrew: CrewCapability = { member1: { sex: "M" }, member2: { sex: "F" } };
const strongCrew: CrewCapability = { member1: trained, member2: trained };
const run = (over: Partial<BoardRunInfo> = {}): BoardRunInfo => ({ id: "run-1", patient_weight: 150, ...over });

function build(over: Partial<Parameters<typeof buildTruckCandidates>[0]> = {}) {
  return buildTruckCandidates({
    trucks: [
      { truckId: "T-A", service_level: "BLS", equipment: {} },
      { truckId: "T-B", service_level: "ALS", equipment: { has_power_stretcher: true } },
      { truckId: "T-NOCREW", service_level: "BLS", equipment: {} },
    ],
    crewedTruckIds: new Set(["T-A", "T-B"]),
    crewCapability: () => strongCrew,
    downTruckIds: new Set(),
    legsByTruck: new Map(),
    ...over,
  });
}

describe("truck suggestion candidate adapter", () => {
  it("excludes un-crewed trucks from candidates", () => {
    const { candidates, skippedNoCrew } = build();
    expect(candidates.map((c) => c.truckId)).toEqual(["T-A", "T-B"]);
    expect(skippedNoCrew).toEqual(["T-NOCREW"]);
  });

  it("maps ALS truck level and defaults a missing run level to BLS", () => {
    expect(build().candidates.find((c) => c.truckId === "T-B")!.service_level).toBe("ALS");
    expect(toSuggestionRun(run({ service_level: null }), timing("run-1", 600)).service_level).toBe("BLS");
    expect(toServiceLevel("als")).toBe("ALS");
  });

  it("marks a down truck and the engine rejects it", () => {
    const { candidates } = build({ downTruckIds: new Set(["T-A"]) });
    expect(candidates.find((c) => c.truckId === "T-A")!.downForDay).toBe(true);
    const res = suggestTrucksForRun({ run: toSuggestionRun(run(), timing("run-1", 600)), candidates, buffers });
    expect(res.ineligible.find((i) => i.truckId === "T-A")!.reason).toBe("Truck is down or out of service for this day.");
  });

  it("blocks a 320 lb patient with an MF crew and no power stretcher; allows trained crew with stretcher", () => {
    const heavy = toSuggestionRun(run({ patient_weight: 320 }), timing("run-1", 600));
    const blocked = build({
      trucks: [{ truckId: "T-A", service_level: "BLS", equipment: {} }],
      crewedTruckIds: new Set(["T-A"]), crewCapability: () => mfCrew,
    });
    expect(suggestTrucksForRun({ run: heavy, candidates: blocked.candidates, buffers }).ineligible.map((i) => i.truckId)).toEqual(["T-A"]);
    const ok = build({
      trucks: [{ truckId: "T-B", service_level: "BLS", equipment: { has_power_stretcher: true } }],
      crewedTruckIds: new Set(["T-B"]),
    });
    expect(suggestTrucksForRun({ run: heavy, candidates: ok.candidates, buffers }).eligible.map((e) => e.truckId)).toEqual(["T-B"]);
  });

  it("rejects a truck with a run 20 minutes after the candidate window (45-min rule)", () => {
    // Run: pickup 10:00, 10+30+10 → ends 10:50. Existing run picks up 11:10 (20 min later).
    const { candidates } = build({
      trucks: [{ truckId: "T-A", service_level: "BLS", equipment: {} }],
      crewedTruckIds: new Set(["T-A"]),
      legsByTruck: new Map([["T-A", [timing("other", 670)]]]),
    });
    const res = suggestTrucksForRun({ run: toSuggestionRun(run(), timing("run-1", 600)), candidates, buffers });
    expect(res.eligible).toEqual([]);
    expect(res.ineligible[0].reason).toMatch(/^Time conflict/);
  });

  it("ignores the run's own slot when it is already on the truck", () => {
    const { candidates } = build({
      trucks: [{ truckId: "T-A", service_level: "BLS", equipment: {} }],
      crewedTruckIds: new Set(["T-A"]),
      legsByTruck: new Map([["T-A", [timing("run-1", 600)]]]),
    });
    const res = suggestTrucksForRun({ run: toSuggestionRun(run(), timing("run-1", 600)), candidates, buffers });
    expect(res.eligible.map((e) => e.truckId)).toEqual(["T-A"]);
  });

  it("never invents a rated weight capacity", () => {
    for (const c of build().candidates) expect(c.maxPatientWeightLbs).toBeUndefined();
  });
});
