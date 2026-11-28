import { describe, it, expect } from "vitest";
import { presentTruckSuggestions } from "./truck-suggestion-presentation";
import type { FeasibilityLeg } from "./schedule-feasibility";
const leg: FeasibilityLeg = { legId: "synthetic", label: "Synthetic", legKind: "A", scheduledPickup: 600, predictedReturn: null, mustArriveBy: null, tripMinutes: 30, slotOrder: 0 };
const result = { eligible: [], ineligible: [{ truckId: "time", reason: "Time conflict: overlaps Synthetic" }, { truckId: "safety", reason: "Missing required equipment" }] };
describe("presentation-only timing reminders", () => {
  it("places reminders below clean trucks without changing eligible rank or reasons", () => {
    const clean = { ...result, eligible: [{ truckId: "clean", score: 42, reasons: ["Original reason"] }] };
    const shown = presentTruckSuggestions(clean, leg, new Map());
    expect(shown.views.get("clean")).toEqual({ kind: "eligible", rank: 1, reasons: ["Original reason"] });
    expect(shown.views.get("time")).toMatchObject({ kind: "timing-advisory", rank: 2 });
    expect(shown.placeableCount).toBe(2);
  });
  it("counts timing conflicts as placeable but preserves hard exclusions and engine output", () => {
    const before = JSON.stringify(result);
    const shown = presentTruckSuggestions(result, leg, new Map());
    expect(shown.placeableCount).toBe(1);
    expect(shown.views.get("time")).toMatchObject({ kind: "timing-advisory", rank: 1, verified: false });
    expect(shown.views.get("safety")).toMatchObject({ kind: "ineligible" });
    expect(JSON.stringify(result)).toBe(before);
  });
  it("requires learned medium/high durations for firm overlap wording", () => {
    const learned = { ...leg, timingSource: { trip: "history" as const, n: 10, confidence: "medium" as const } };
    expect(presentTruckSuggestions(result, learned, new Map([["time", [learned]]])).views.get("time")).toMatchObject({ verified: true });
    expect(presentTruckSuggestions(result, learned, new Map([["time", [leg]]])).views.get("time")).toMatchObject({ verified: false });
  });
});
