import { describe, it, expect } from "vitest";
import { evaluateTruckDay, type FeasibilityBuffers, type FeasibilityLeg } from "./schedule-feasibility";

const buf: FeasibilityBuffers = { loadMinutes: 10, unloadMinutes: 10, graceMinutes: 15, minGapMinutes: 0 };
const leg = (o: Partial<FeasibilityLeg> & { legId: string }): FeasibilityLeg => ({
  label: o.legId, legKind: "A", scheduledPickup: null, predictedReturn: null,
  mustArriveBy: null, tripMinutes: 30, slotOrder: 0, ...o,
});

describe("evaluateTruckDay", () => {
  it("is clear (silent) for a feasible day", () => {
    const r = evaluateTruckDay([
      leg({ legId: "a", scheduledPickup: 6 * 60, mustArriveBy: 7 * 60 }),
      leg({ legId: "b", legKind: "B", scheduledPickup: 11 * 60 }),
    ], buf);
    expect(r.clear).toBe(true);
    expect(r.conflicts).toEqual([]);
  });

  it("flags one overlap when two windows on one truck cross", () => {
    // 8:00 + 10 + 30 + 10 = 8:50 end, next starts 8:30
    const r = evaluateTruckDay([
      leg({ legId: "x", scheduledPickup: 8 * 60 }),
      leg({ legId: "y", scheduledPickup: 8 * 60 + 30 }),
    ], buf);
    expect(r.clear).toBe(false);
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0]).toMatchObject({ kind: "overlap", severity: "error", legIds: ["x", "y"] });
  });

  it("flags late-to-appointment when arrival exceeds mustArriveBy + grace", () => {
    // pickup 6:30 + 10 load + 30 trip = 7:10 arrival; appt 6:50 + 15 grace = 7:05
    const r = evaluateTruckDay([leg({ legId: "a", scheduledPickup: 6 * 60 + 30, mustArriveBy: 6 * 60 + 50 })], buf);
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0]).toMatchObject({ kind: "late-to-appointment", severity: "error" });
  });

  it("warns on a tight gap only when a min gap is enforced", () => {
    const legs = [leg({ legId: "x", scheduledPickup: 8 * 60 }), leg({ legId: "y", scheduledPickup: 9 * 60 })];
    expect(evaluateTruckDay(legs, buf).clear).toBe(true);
    const r = evaluateTruckDay(legs, { ...buf, minGapMinutes: 45 });
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0]).toMatchObject({ kind: "tight-gap", severity: "warning" });
  });
});
