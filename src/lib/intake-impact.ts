// Pure adapter: one-off intake form + board context → evaluateRunAcceptance.
// Advisory only. Geo is additive: only facility-name-matched ends get coords.
import { evaluatePatientReadiness, type FeasibilityBuffers, type FeasibilityLeg, type GeoPoint, type ReadinessWarning } from "./schedule-feasibility";
import type { PatientTimeStats } from "./patient-time-prediction";
import type { TruckCandidate } from "./truck-suggestion";
import { toSuggestionRun } from "./truck-suggestion-candidates";
import { evaluateRunAcceptance, type RunAcceptance } from "./run-acceptance";
import { deriveRunPriority } from "./run-priority";
import { buildFacilityIndex, resolveLegFacilities, withLegCoords, type FacilityRef } from "./facility-endpoints";
import { travelFloorMinutes } from "./geo-distance";

export const INTAKE_LEG_ID = "__intake__";

export interface IntakeForm {
  pickup_location: string; destination_location: string; trip_type: string;
  service_level: string; weight_lbs: string; mobility: string; oxygen: boolean; chair_time: string;
  pickup_facility_id?: string | null; destination_facility_id?: string | null;
  /** Optional extra safety inputs (regular/patient form). Absent → previous behavior. */
  stairs_required?: string | null; stair_chair_required?: boolean | null; oxygen_lpm?: number | null;
  special_equipment_required?: string | null; bariatric?: boolean | null;
}
export interface LegInfo {
  pickup_location: string | null; destination_location: string | null;
  pickup_facility_id?: string | null; destination_facility_id?: string | null;
  pickup_overridden?: boolean; destination_overridden?: boolean;
  leg_type: string | null; trip_type: string | null; chair_time: string | null;
}

/** Where each segment's estimate came from, for the impact card. */
export interface TimingNote { legId: string; label: string; trip: "history" | "default"; n?: number }
export interface IntakeTimingSummary {
  trips: TimingNote[];
  /** "distance" when at least one gap used the geo floor; otherwise the static default gap. */
  gap: "distance" | "default";
  readiness: ReadinessWarning[];
}

/**
 * Optional prospective-patient path: add that patient's stats to the board map
 * so toFeasibilityLeg can use their history. No patient → the same map back.
 */
export function withProspectiveStats(
  stats: Map<string, PatientTimeStats>, patientId: string | null | undefined, patientStats: PatientTimeStats | null | undefined,
): Map<string, PatientTimeStats> {
  if (!patientId || !patientStats || stats.has(patientId)) return stats;
  const next = new Map(stats); next.set(patientId, patientStats); return next;
}

export function checkIntakeImpact(args: {
  form: IntakeForm;
  legType: "A" | "B";
  timing: FeasibilityLeg;
  candidates: TruckCandidate[];
  buffers: FeasibilityBuffers;
  legInfo: Map<string, LegInfo>;
  facilities: FacilityRef[];
  getCoords: (facilityId: string) => GeoPoint | null;
}): RunAcceptance & { geoPairsSkipped: boolean; timing: IntakeTimingSummary } {
  const { form, legType, legInfo } = args;
  const index = buildFacilityIndex(args.facilities);
  let missing = false;
  const attach = <T extends FeasibilityLeg>(leg: T, info: { pickup_location?: string | null; destination_location?: string | null }) => {
    const ends = resolveLegFacilities(info, index);
    const out = withLegCoords(leg, ends, args.getCoords);
    if ((ends.originFacilityId && !out.originCoord) || (ends.destFacilityId && !out.destCoord)) missing = true;
    return out;
  };
  const baseRun = toSuggestionRun({
    id: INTAKE_LEG_ID,
    patient_weight: form.weight_lbs ? Number(form.weight_lbs) : null,
    service_level: form.service_level,
    patient_mobility: form.mobility,
    patient_oxygen_required: form.oxygen,
    patient_stairs_required: form.stairs_required,
    patient_stair_chair_required: form.stair_chair_required,
    patient_oxygen_lpm: form.oxygen_lpm,
    patient_special_equipment: form.special_equipment_required,
    patient_bariatric: form.bariatric,
  }, { ...args.timing, legId: INTAKE_LEG_ID });
  const run = attach(baseRun, form);
  const candidates = args.candidates.map((c) => ({
    ...c, assignedRuns: c.assignedRuns.map((l) => attach(l, legInfo.get(l.legId) ?? {})),
  }));
  const tierOf = (id: string) => {
    if (id === INTAKE_LEG_ID) {
      return deriveRunPriority({ leg_type: legType, trip_type: form.trip_type, chair_time: form.chair_time || null }).tier;
    }
    const i = legInfo.get(id);
    return deriveRunPriority({ leg_type: i?.leg_type ?? null, trip_type: i?.trip_type ?? null, chair_time: i?.chair_time ?? null }).tier;
  };
  const result = evaluateRunAcceptance({
    run, candidates, tierOf, buffers: { ...args.buffers, travelFloor: travelFloorMinutes },
  });
  const best = result.leastBadTruck
    ? candidates.find((c) => c.truckId === result.leastBadTruck!.truckId)?.assignedRuns ?? [] : [];
  const involved = [run, ...best.filter((l) => l.legId !== INTAKE_LEG_ID)];
  const note = (l: FeasibilityLeg): TimingNote => l.timingSource
    ? { legId: l.legId, label: l.label, trip: "history", n: l.timingSource.n }
    : { legId: l.legId, label: l.label, trip: "default" };
  const usedDistance = involved.some((l) => !!l.destCoord) && involved.some((l) => !!l.originCoord);
  const timing: IntakeTimingSummary = {
    trips: involved.map(note),
    gap: usedDistance ? "distance" : "default",
    readiness: evaluatePatientReadiness(involved, args.buffers),
  };
  return { ...result, geoPairsSkipped: missing, timing };
}
