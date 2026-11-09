import { describe, it, expect } from "vitest";
import { toFeasibilityLeg } from "@/hooks/useTruckDayFeasibility";
import { evaluateTruckDay, evaluatePatientReadiness, type FeasibilityBuffers } from "./schedule-feasibility";
import { EMPTY_STATS, summarize, type PatientTimeStats } from "./patient-time-prediction";
import { withProspectiveStats } from "./intake-impact";

const B: FeasibilityBuffers = { loadMinutes: 10, unloadMinutes: 10, graceMinutes: 15, minGapMinutes: 45 };
const stats = (dur: number[], turn: number[] = []): PatientTimeStats => ({
  ...EMPTY_STATS, durationA: summarize(dur), durationB: summarize(dur), durationAll: summarize(dur), turnaround: summarize(turn),
});
const legRow = (over: any = {}) => ({
  id: "L1", leg_type: "A", pickup_time: "08:00", patient_id: "P1", estimated_duration_minutes: null,
  patient: { first_name: "Test", last_name: "One", chair_time: "09:00", run_duration_minutes: 40 }, ...over,
});

describe("history-first timing", () => {
  it("no history: legacy output unchanged (no new keys)", () => {
    const l = toFeasibilityLeg(legRow(), 0, new Map(), null);
    expect(l.tripMinutes).toBe(40);
    expect("timingSource" in l).toBe(false);
    expect("predictedReady" in l).toBe(false);
  });
  it("4 samples are ignored (MIN_SAMPLES)", () => {
    const l = toFeasibilityLeg(legRow(), 0, new Map([["P1", stats([20, 20, 20, 20])]]), null);
    expect(l.tripMinutes).toBe(40);
    expect(l.timingSource).toBeUndefined();
  });
  it("5 samples: learned median used and source tagged", () => {
    const l = toFeasibilityLeg(legRow(), 0, new Map([["P1", stats([20, 22, 24, 26, 28])]]), null);
    expect(l.tripMinutes).toBe(24);
    expect(l.timingSource).toEqual({ trip: "history", n: 5, confidence: "low" });
  });
  it("early-return fires only with turnaround history", () => {
    const row = legRow({ id: "B1", leg_type: "B", pickup_time: "10:00" });
    const none = toFeasibilityLeg(row, 0, new Map(), null);
    expect(evaluatePatientReadiness([none], B)).toEqual([]);
    const hist = toFeasibilityLeg(row, 0, new Map([["P1", stats([], [240, 240, 240, 240, 240])]]), null);
    expect(hist.predictedReady).toBe(13 * 60);
    const w = evaluatePatientReadiness([hist], B);
    expect(w.map((x) => x.kind)).toEqual(["early-return"]);
    // readiness is not a truck conflict
    expect(evaluateTruckDay([hist], B).conflicts).toEqual([]);
  });
  it("travel-infeasible carries gapSource distance; tight-gap without coords does not", () => {
    const a = { legId: "a", label: "A", legKind: "A" as const, scheduledPickup: 480, predictedReturn: null, mustArriveBy: null, tripMinutes: 30, slotOrder: 0, destCoord: { lat: 33.7, lng: -84.4 } };
    const b = { legId: "b", label: "B", legKind: "A" as const, scheduledPickup: 535, predictedReturn: null, mustArriveBy: null, tripMinutes: 30, slotOrder: 1, originCoord: { lat: 34.7, lng: -84.4 } };
    const r = evaluateTruckDay([a, b], { ...B, travelFloor: () => 120 });
    expect(r.conflicts.find((c) => c.kind === "travel-infeasible")?.gapSource).toBe("distance");
    expect(r.conflicts.find((c) => c.kind === "tight-gap")?.gapSource).toBeUndefined();
  });
  it("prospective patient stats merge only when a patient is given", () => {
    const m = new Map<string, PatientTimeStats>();
    expect(withProspectiveStats(m, null, stats([1]))).toBe(m);
    expect(withProspectiveStats(m, "P9", stats([20, 22, 24, 26, 28])).get("P9")?.durationA.median).toBe(24);
  });
});
