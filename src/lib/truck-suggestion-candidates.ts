/**
 * Pure, read-only adapter: board data → suggestTrucksForRun inputs.
 * Never writes, never assigns. Rated capacity is intentionally left undefined
 * (no schema column exists; we do not invent one).
 */
import type { FeasibilityLeg } from "./schedule-feasibility";
import type { CrewCapability, PatientNeeds, TruckEquipment } from "./safety-rules";
import type { SuggestionRun, TruckCandidate } from "./truck-suggestion";

export interface BoardTruckInfo {
  truckId: string;
  service_level?: string | null;
  equipment?: TruckEquipment;
}

export interface BoardRunInfo {
  id: string;
  patient_weight: number | null;
  service_level?: string | null;
  patient_mobility?: string | null;
  patient_stairs_required?: string | null;
  patient_stair_chair_required?: boolean | null;
  patient_oxygen_required?: boolean | null;
  patient_oxygen_lpm?: number | null;
  patient_special_equipment?: string | null;
  patient_bariatric?: boolean | null;
}

export const toServiceLevel = (v: string | null | undefined): "BLS" | "ALS" =>
  String(v ?? "").trim().toUpperCase() === "ALS" ? "ALS" : "BLS";

export function toPatientNeeds(run: BoardRunInfo): PatientNeeds {
  return {
    weight_lbs: run.patient_weight,
    mobility: run.patient_mobility ?? null,
    stairs_required: run.patient_stairs_required ?? null,
    stair_chair_required: run.patient_stair_chair_required ?? null,
    oxygen_required: run.patient_oxygen_required ?? null,
    oxygen_lpm: run.patient_oxygen_lpm ?? null,
    special_equipment_required: run.patient_special_equipment ?? null,
    bariatric: run.patient_bariatric ?? null,
  };
}

export function toSuggestionRun(run: BoardRunInfo, timing: FeasibilityLeg): SuggestionRun {
  return { ...timing, legId: run.id, service_level: toServiceLevel(run.service_level), patient: toPatientNeeds(run) };
}

/** Only trucks with a crew for the day are candidates. */
export function buildTruckCandidates(args: {
  trucks: BoardTruckInfo[];
  crewedTruckIds: Set<string>;
  crewCapability: (truckId: string) => CrewCapability;
  downTruckIds: Set<string>;
  legsByTruck: Map<string, FeasibilityLeg[]>;
}): { candidates: TruckCandidate[]; skippedNoCrew: string[] } {
  const candidates: TruckCandidate[] = [];
  const skippedNoCrew: string[] = [];
  for (const t of args.trucks) {
    if (!args.crewedTruckIds.has(t.truckId)) { skippedNoCrew.push(t.truckId); continue; }
    candidates.push({
      truckId: t.truckId,
      service_level: toServiceLevel(t.service_level),
      equipment: t.equipment ?? {},
      crew: args.crewCapability(t.truckId),
      maxPatientWeightLbs: undefined,
      downForDay: args.downTruckIds.has(t.truckId),
      assignedRuns: args.legsByTruck.get(t.truckId) ?? [],
    });
  }
  return { candidates, skippedNoCrew };
}
