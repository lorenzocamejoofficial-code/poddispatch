import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildRegularIntake } from "./intake-impact-regular";
import { checkIntakeImpact } from "./intake-impact";
import { EMPTY_STATS, summarize, type PatientTimeStats } from "./patient-time-prediction";
import { IntakeImpactCard } from "@/components/scheduling/IntakeImpactCard";
import type { TruckCandidate } from "./truck-suggestion";

// Synthetic fixtures only — no PHI.
const buffers = { loadMinutes: 10, unloadMinutes: 10, graceMinutes: 15, minGapMinutes: 45 };
const truck: TruckCandidate = { truckId: "T1", service_level: "BLS", equipment: {}, crew: { member1: { sex: "M" }, member2: { sex: "M" } }, assignedRuns: [] };
const patient = { id: "P1", first_name: "Synthetic", last_name: "Rider", weight_lbs: 150, chair_time: "07:00", run_duration_minutes: 40 };
const form = (over = {}) => ({
  patient_id: "P1", pickup_time: "06:00", chair_time: "07:00", pickup_location: "1 Test Ln",
  destination_location: "Test Center", trip_type: "dialysis", estimated_duration_minutes: "", service_level: "BLS", ...over,
});
const withHistory: PatientTimeStats = {
  ...EMPTY_STATS, durationA: summarize([20, 22, 24, 26, 28]), durationB: summarize([20, 22, 24, 26, 28]),
  durationAll: summarize([20, 22, 24, 26, 28]), turnaround: summarize([300, 300, 300, 300, 300]),
};
const run = (legType: "A" | "B", stats: PatientTimeStats | null, over = {}) => {
  const b = buildRegularIntake({ form: form(over), legType, patient, boardStats: new Map(), patientStats: stats, settings: null });
  return { b, r: checkIntakeImpact({ form: b.form, legType, timing: b.timing, candidates: [truck], buffers, legInfo: new Map(), facilities: [], getCoords: () => null }) };
};
const card = (r: any) => render(<IntakeImpactCard result={r} truckName={() => "Truck 1"} onClose={() => {}} />);

describe("regular-form impact check", () => {
  it("patient with >=5 trips uses the learned median and says so", () => {
    const { b, r } = run("A", withHistory);
    expect(b.timing.tripMinutes).toBe(24);
    card(r);
    expect(screen.getByText(/from this patient's history \(5 trips\)/)).toBeTruthy();
  });
  it("history readiness note shows for an early return", () => {
    const { r } = run("B", withHistory, { pickup_time: "10:00" });
    expect(r.timing.readiness.map((w) => w.kind)).toEqual(["early-return"]);
  });
  it("no history falls back to planned length and hides readiness", () => {
    const { b, r } = run("B", null, { pickup_time: "10:00" });
    expect(b.timing.tripMinutes).toBe(40);
    expect(b.timing.timingSource).toBeUndefined();
    expect(r.timing.readiness).toEqual([]);
    card(r);
    expect(screen.queryByText(/usually ready/)).toBeNull();
    expect(screen.getByText(/planned or default trip length/)).toBeTruthy();
  });
});

describe("regular-form safety inputs", () => {
  const legType = "A" as const;
  const check = (p: any, equipment = {}) => {
    const b = buildRegularIntake({ form: form(), legType, patient: { ...patient, ...p }, boardStats: new Map(), patientStats: null, settings: null });
    return checkIntakeImpact({ form: b.form, legType, timing: b.timing, candidates: [{ ...truck, equipment }], buffers, legInfo: new Map(), facilities: [], getCoords: () => null });
  };
  it("flags a stair-chair need on a truck without one", () => {
    const r = check({ stairs_required: "full_flight" });
    expect(r.coverable).toBe(false);
    expect(r.perTruck[0].blockedReason).toMatch(/stair chair/i);
    expect(check({ stairs_required: "full_flight" }, { has_stair_chair: true }).coverable).toBe(true);
  });
  it("flags an oxygen need on a truck without a mount", () => {
    const r = check({ oxygen_required: true });
    expect(r.coverable).toBe(false);
    expect(r.perTruck[0].blockedReason).toMatch(/oxygen/i);
  });
  it("reads the board's `weight` field", () => {
    expect(buildRegularIntake({ form: form(), legType, patient: { id: "P1", weight: 210 }, boardStats: new Map(), patientStats: null, settings: null }).form.weight_lbs).toBe("210");
  });
});
