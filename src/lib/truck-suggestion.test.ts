import { describe, expect, it } from "vitest";
import { suggestTrucksForRun, type SuggestionRun, type TruckCandidate } from "./truck-suggestion";
import { type FeasibilityLeg } from "./schedule-feasibility";

const leg = (id: string, start: number, duration = 30): FeasibilityLeg => ({
  legId: id, label: id, legKind: "A", scheduledPickup: start,
  predictedReturn: null, mustArriveBy: null, tripMinutes: duration, slotOrder: 0,
});
const run: SuggestionRun = { ...leg("new", 600), service_level: "BLS", patient: { weight_lbs: 180 } };
const truck = (truckId: string, overrides: Partial<TruckCandidate> = {}): TruckCandidate => ({
  truckId, service_level: "BLS", equipment: {}, crew: { member1: { sex: "M" }, member2: { sex: "M" } },
  assignedRuns: [], ...overrides,
});
const suggest = (candidates: TruckCandidate[], target = run) => suggestTrucksForRun({
  run: target, candidates, buffers: { loadMinutes: 10, unloadMinutes: 10, graceMinutes: 15, minGapMinutes: 0 },
});

describe("suggestTrucksForRun", () => {
  it("excludes overlapping runs", () => {
    const result = suggest([truck("conflict", { assignedRuns: [leg("old", 620)] })]);
    expect(result.eligible).toEqual([]);
    expect(result.ineligible[0].reason).toMatch(/Time conflict/);
  });
  it("enforces 45 minutes after the complete load/trip/unload window", () => {
    expect(suggest([truck("tight", { assignedRuns: [leg("old", 506)] })]).eligible).toEqual([]);
    expect(suggest([truck("boundary", { assignedRuns: [leg("old", 505)] })]).eligible[0].truckId).toBe("boundary");
  });
  it("excludes wrong service level", () => {
    expect(suggest([truck("bls")], { ...run, service_level: "ALS" }).ineligible[0].reason).toMatch(/requires ALS/);
  });
  it("excludes missing explicitly required equipment", () => {
    expect(suggest([truck("plain")], { ...run, requiredEquipment: ["has_power_stretcher"] }).ineligible[0].reason).toMatch(/Missing required equipment/);
  });
  it("requires stair-chair equipment even though shared safety treats it as advisory", () => {
    expect(suggest([truck("plain")], { ...run, patient: { stair_chair_required: true } }).eligible).toEqual([]);
  });
  it("reuses bariatric mixed-crew blocking", () => {
    const result = suggest([truck("mixed", { crew: { member1: { sex: "M" }, member2: { sex: "F" } } })], { ...run, patient: { weight_lbs: 350 } });
    expect(result.ineligible[0].reason).toMatch(/requires power stretcher with mixed crew/);
  });
  it("preserves shared all-male bariatric warning rather than inventing a block", () => {
    const result = suggest([truck("male")], { ...run, patient: { weight_lbs: 350 } });
    expect(result.eligible).toHaveLength(1);
    expect(result.eligible[0].reasons).toContain("Bariatric patient, power stretcher recommended");
  });
  it("excludes overweight patients using supplied rated capacity", () => {
    expect(suggest([truck("small", { maxPatientWeightLbs: 300 })], { ...run, patient: { weight_lbs: 350 } }).ineligible[0].reason).toMatch(/rated capacity/);
  });
  it.each(["downForDay", "outOfServiceForDay"] as const)("excludes %s", (flag) => {
    expect(suggest([truck("down", { [flag]: true })]).ineligible[0].reason).toMatch(/down or out of service/);
  });
  it("ranks the nearest adjacent slot first", () => {
    const result = suggest([
      truck("far", { assignedRuns: [leg("old", 400)] }),
      truck("near", { assignedRuns: [leg("old", 505)] }),
    ]);
    expect(result.eligible.map((t) => t.truckId)).toEqual(["near", "far"]);
    expect(result.eligible[0].score).toBeGreaterThan(result.eligible[1].score);
  });
  it("preserves specialized capacity for equal-fit basic runs", () => {
    const result = suggest([truck("special", { service_level: "ALS", equipment: { has_power_stretcher: true } }), truck("plain")]);
    expect(result.eligible.map((t) => t.truckId)).toEqual(["plain", "special"]);
  });
  it("schedule fit outranks parsimony", () => {
    const result = suggest([truck("plain"), truck("special", { service_level: "ALS", assignedRuns: [leg("old", 505)] })]);
    expect(result.eligible[0].truckId).toBe("special");
  });
  it("uses load only after equal fit and equipment", () => {
    const result = suggest([truck("busy", { assignedRuns: [leg("first", 300), leg("last", 505)] }), truck("lighter", { assignedRuns: [leg("last", 505)] })]);
    expect(result.eligible[0].truckId).toBe("lighter");
  });
  it("detects nested conflicts hidden behind an intermediate window", () => {
    expect(suggest([truck("nested", { assignedRuns: [leg("long", 400, 300), leg("short", 480, 5)] })]).eligible).toEqual([]);
  });
  it("uses predicted B-leg windows", () => {
    const target = { ...run, legKind: "B" as const, scheduledPickup: null, predictedReturn: 600 };
    expect(suggest([truck("conflict", { assignedRuns: [leg("old", 620)] })], target).eligible).toEqual([]);
  });
  it("ignores a run's old assignment and does not mutate inputs", () => {
    const candidates = [truck("same", { assignedRuns: [run] })];
    const before = JSON.stringify(candidates);
    expect(suggest(candidates).eligible).toHaveLength(1);
    expect(JSON.stringify(candidates)).toBe(before);
  });
  it("fails closed on unknown candidate/run pickup windows", () => {
    expect(suggest([truck("unknown", { assignedRuns: [{ ...leg("old", 0), scheduledPickup: null }] })]).eligible).toEqual([]);
    expect(suggest([truck("plain")], { ...run, scheduledPickup: null }).eligible).toEqual([]);
  });
  it("returns empty lists for no candidates", () => {
    expect(suggest([])).toEqual({ eligible: [], ineligible: [] });
  });
});