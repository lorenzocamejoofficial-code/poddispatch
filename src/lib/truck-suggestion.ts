/**
 * Geographic deadhead/mileage is NOT modeled: no pickup/dropoff coordinates
 * exist in the schema. Ranking is schedule-fit + capability only.
 * Future extension point: a coordinate-backed distance term, not an estimate.
 */
import { computeWindow, evaluateTruckDay, type FeasibilityBuffers, type FeasibilityLeg } from "./schedule-feasibility";
import { MIN_GAP_MINUTES } from "./time-conflict";
import { evaluateSafetyRules, type CrewCapability, type PatientNeeds, type TruckEquipment } from "./safety-rules";

export interface SuggestionRun extends FeasibilityLeg {
  service_level: "BLS" | "ALS";
  patient: PatientNeeds;
  requiredEquipment?: (keyof TruckEquipment)[];
}
export interface TruckCandidate {
  truckId: string;
  service_level: "BLS" | "ALS";
  equipment: TruckEquipment;
  crew: CrewCapability;
  /** Manufacturer/operator-supplied capacity, not a derived bariatric threshold. */
  maxPatientWeightLbs?: number;
  downForDay?: boolean;
  outOfServiceForDay?: boolean;
  assignedRuns: FeasibilityLeg[];
}
export interface RankedTruck { truckId: string; score: number; reasons: string[] }
export interface TruckSuggestionInput {
  run: SuggestionRun;
  candidates: TruckCandidate[];
  buffers: FeasibilityBuffers;
}

const equipmentLabels: Record<keyof TruckEquipment, string> = {
  has_power_stretcher: "power stretcher",
  has_stair_chair: "stair chair",
  has_oxygen_mount: "oxygen mount",
  has_bariatric_kit: "bariatric kit",
  has_bariatric_stretcher: "bariatric stretcher",
};

export function suggestTrucksForRun(input: TruckSuggestionInput): {
  eligible: RankedTruck[]; ineligible: { truckId: string; reason: string }[];
} {
  const { run, candidates } = input;
  // Optimizer hard-filters the shared minimum even when advisory settings disable it.
  const buffers = { ...input.buffers, minGapMinutes: Math.max(MIN_GAP_MINUTES, input.buffers.minGapMinutes) };
  const eligible: RankedTruck[] = [];
  const ineligible: { truckId: string; reason: string }[] = [];
  const window = computeWindow(run, buffers);
  for (const truck of candidates) {
    const reject = (reason: string) => ineligible.push({ truckId: truck.truckId, reason });
    if (truck.downForDay || truck.outOfServiceForDay) {
      reject("Truck is down or out of service for this day."); continue;
    }
    if (run.service_level === "ALS" && truck.service_level !== "ALS") {
      reject("Run requires ALS service; truck provides BLS."); continue;
    }
    // The shared engine owns bariatric/crew classification and safety warnings.
    const safety = evaluateSafetyRules(run.patient, truck.crew, truck.equipment);
    if (safety.status === "BLOCKED") { reject(safety.reasons.join("; ")); continue; }
    // No shared export handles explicit capability requirements or rated capacity.
    // These comparisons complement (never replace) the shared safety matrix.
    const required = new Set(run.requiredEquipment ?? []);
    if (run.patient.stair_chair_required || run.patient.stairs_required === "full_flight") required.add("has_stair_chair");
    if (run.patient.oxygen_required) required.add("has_oxygen_mount");
    const missing = [...required].filter((key) => !truck.equipment[key]);
    if (missing.length) { reject(`Missing required equipment: ${missing.map((key) => equipmentLabels[key]).join(", ")}.`); continue; }
    if (run.patient.weight_lbs != null && truck.maxPatientWeightLbs != null && run.patient.weight_lbs > truck.maxPatientWeightLbs) {
      reject(`Patient weight exceeds truck's ${truck.maxPatientWeightLbs}-lb rated capacity.`); continue;
    }
    if (window.start == null || window.end == null) {
      reject("Time conflict cannot be evaluated: run pickup time is unknown."); continue;
    }
    // Ignore this run's old assignment when suggesting a reassignment to the same truck.
    const existing = truck.assignedRuns.filter((leg) => leg.legId !== run.legId);
    const day = evaluateTruckDay([...existing, run], buffers);
    const conflicts = day.conflicts.filter((conflict) => conflict.legIds.includes(run.legId));
    // Pairwise shared evaluation also catches nested windows/non-adjacent overlaps.
    for (const leg of existing) {
      if (computeWindow(leg, buffers).start == null) {
        conflicts.push({ kind: "overlap", severity: "error", legIds: [leg.legId, run.legId], message: `${leg.label} has an unknown pickup time; conflict cannot be ruled out.` });
      } else {
        conflicts.push(...evaluateTruckDay([leg, run], buffers).conflicts.filter((conflict) => conflict.legIds.length === 2));
      }
    }
    if (conflicts.length) { reject(`Time conflict: ${[...new Set(conflicts.map((conflict) => conflict.message))].join("; ")}`); continue; }
    const gaps: number[] = [];
    for (const leg of existing) {
      const other = computeWindow(leg, buffers);
      if (other.start == null || other.end == null) continue;
      if (other.end <= window.start) gaps.push(window.start - other.end);
      if (other.start >= window.end) gaps.push(other.start - window.end);
    }
    // Nearest adjacent slot = least unused time beyond the required buffer.
    // No neighbours gets a full-day idle penalty; this is time, NOT distance.
    const idle = gaps.length ? Math.max(0, Math.min(...gaps) - buffers.minGapMinutes) : 24 * 60;
    const specialized = Number(truck.service_level === "ALS" && run.service_level === "BLS")
      + Number(Boolean(truck.equipment.has_power_stretcher || truck.equipment.has_bariatric_stretcher || truck.equipment.has_bariatric_kit)
        && !run.patient.bariatric && run.patient.weight_lbs == null && !required.has("has_power_stretcher")
        && !required.has("has_bariatric_stretcher") && !required.has("has_bariatric_kit"));
    // Minute-resolution fit dominates; parsimony (<1) then load (<0.01).
    const score = -Math.ceil(idle) - specialized * 0.1 - (existing.length / (existing.length + 1)) * 0.01;
    eligible.push({ truckId: truck.truckId, score, reasons: [
      gaps.length ? `Schedule fit: ${Math.ceil(idle)} idle minutes beyond the minimum gap to the nearest run.` : "Schedule fit: empty day, no adjacent run.",
      `Equipment parsimony: ${specialized} unused specialized capabilities.`,
      `Load balance: ${existing.length} assigned runs.`,
      ...safety.reasons,
    ] });
  }
  eligible.sort((a, b) => b.score - a.score || a.truckId.localeCompare(b.truckId));
  return { eligible, ineligible };
}