import { describe, expect, it } from "vitest";
import { deriveRunPriority, type RunTier } from "./run-priority";

describe("deriveRunPriority (synthetic runs)", () => {
  it("prioritizes a dialysis A-leg with chair time", () => {
    expect(deriveRunPriority({ leg_type: "A", transport_kind: "dialysis", chair_time: "08:30" }))
      .toMatchObject({ tier: 1, label: "Hard arrive-by (clinical)", hardArriveBy: 510 });
  });

  it("prioritizes an explicit deadline regardless of transport or leg", () => {
    expect(deriveRunPriority({ leg_type: "B", trip_type: "discharge", must_arrive_by: "14:15:00" }))
      .toMatchObject({ tier: 1, hardArriveBy: 855 });
  });

  it("ranks a dialysis return second, ignoring the outbound chair time", () => {
    expect(deriveRunPriority({ leg_type: "B", trip_type: "dialysis", chair_time: "08:30" }))
      .toMatchObject({ tier: 2, label: "Return leg — patient waiting", hardArriveBy: null });
  });

  it("leaves an anytime discharge flexible", () => {
    expect(deriveRunPriority({ leg_type: null, trip_type: "discharge" }))
      .toMatchObject({ tier: 3, label: "Flexible", hardArriveBy: null });
  });

  it("does not promote a non-dialysis A-leg without a hard time", () => {
    expect(deriveRunPriority({ leg_type: "A", transport_kind: "outpatient" }).tier).toBe(3);
  });

  it.each([1, 2, 3] as RunTier[])("manual override %i wins", (overrideTier) => {
    const result = deriveRunPriority({ leg_type: "A", trip_type: "dialysis", chair_time: "09:00", overrideTier });
    expect(result).toMatchObject({ tier: overrideTier, rationale: "manual override", hardArriveBy: 540 });
  });

  it("allows an override to promote an otherwise flexible run", () => {
    expect(deriveRunPriority({ leg_type: null, overrideTier: 1 }))
      .toMatchObject({ tier: 1, rationale: "manual override", hardArriveBy: null });
  });

  it.each(["outpatient_specialty", "nemt_dialysis"])("normalizes appointment alias %s", (trip_type) => {
    expect(deriveRunPriority({ leg_type: " a ", trip_type, chair_time: "10:20" }))
      .toMatchObject({ tier: 1, hardArriveBy: 620 });
  });

  it("prefers the canonical transport kind over a conflicting legacy kind", () => {
    expect(deriveRunPriority({ leg_type: "A", transport_kind: "discharge", trip_type: "dialysis", chair_time: "08:00" }).tier)
      .toBe(3);
  });

  it("prefers an explicit deadline over chair time", () => {
    expect(deriveRunPriority({ leg_type: "A", trip_type: "dialysis", chair_time: "09:00", must_arrive_by: "08:45" }).hardArriveBy)
      .toBe(525);
  });

  it("treats midnight as a real clinical time", () => {
    expect(deriveRunPriority({ leg_type: "A", trip_type: "dialysis", chair_time: "00:00" }))
      .toMatchObject({ tier: 1, hardArriveBy: 0 });
  });

  it.each(["", " ", "24:00", "12:60", "garbage", "12:00:99"])("never invents a chair time for %j", (chair_time) => {
    expect(deriveRunPriority({ leg_type: "A", trip_type: "dialysis", chair_time }))
      .toMatchObject({ tier: 3, hardArriveBy: null });
  });

  it("keeps a declared invalid deadline high priority without inventing minutes", () => {
    expect(deriveRunPriority({ leg_type: "B", must_arrive_by: "invalid" }))
      .toMatchObject({ tier: 1, hardArriveBy: null });
  });

  it("does not mutate frozen input", () => {
    const run = Object.freeze({ leg_type: "B", trip_type: "dialysis", overrideTier: null });
    expect(deriveRunPriority(run).tier).toBe(2);
    expect(run).toEqual({ leg_type: "B", trip_type: "dialysis", overrideTier: null });
  });
});