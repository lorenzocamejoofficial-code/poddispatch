import type { suggestTrucksForRun } from "./truck-suggestion";
import type { FeasibilityLeg } from "./schedule-feasibility";

export type TruckSuggestionView =
  | { kind: "eligible"; rank: number; reasons: string[] }
  | { kind: "timing-advisory"; rank: number; reason: string; verified: boolean }
  | { kind: "ineligible"; reason: string };

/** Display-only projection. Never changes engine results or assignment rules. */
export function presentTruckSuggestions(result: ReturnType<typeof suggestTrucksForRun>, run: FeasibilityLeg, legsByTruck: Map<string, FeasibilityLeg[]>) {
  const views = new Map<string, TruckSuggestionView>();
  result.eligible.forEach((e, i) => views.set(e.truckId, { kind: "eligible", rank: i + 1, reasons: e.reasons }));
  let placeableCount = result.eligible.length;
  for (const r of result.ineligible) {
    if (!r.reason.startsWith("Time conflict:")) {
      views.set(r.truckId, { kind: "ineligible", reason: r.reason });
      continue;
    }
    // Conservative: all durations behind this truck's timing diagnosis must be learned.
    const learned = (l: FeasibilityLeg) => l.timingSource?.trip === "history" &&
      (l.timingSource.confidence === "medium" || l.timingSource.confidence === "high");
    const verified = learned(run) && (legsByTruck.get(r.truckId) ?? []).every(learned);
    views.set(r.truckId, { kind: "timing-advisory", rank: ++placeableCount, reason: r.reason.slice("Time conflict:".length).trim(), verified });
  }
  return { views, placeableCount };
}
