// Consequence check at intake — pure, advisory. Composes the shared engines;
// never assigns or writes. Priority tiers decide who absorbs lateness.
import { computeWindow, evaluateTruckDay, type Conflict, type FeasibilityBuffers } from "./schedule-feasibility";
import { suggestTrucksForRun, type SuggestionRun, type TruckCandidate } from "./truck-suggestion";
import { MIN_GAP_MINUTES } from "./time-conflict";
import type { RunTier } from "./run-priority";

export interface RunBreak {
  legId: string;
  label: string;
  kind: Conflict["kind"] | "unknown-time";
  /** Minutes short / late; null when it can't be computed (unknown time). */
  howLateMin: number | null;
  tier: RunTier;
}
export interface TruckImpact { truckId: string; clean: boolean; breaks: RunBreak[]; blockedReason?: string }
export interface RunAcceptance {
  /** true when at least one crewed truck takes the run with no conflicts. */
  coverable: boolean;
  leastBadTruck: { truckId: string; breaks: RunBreak[]; reasons: string[] } | null;
  /** Tier 3 run whose only placements would delay a Tier 1/2 run. */
  runShouldYield: boolean;
  perTruck: TruckImpact[];
}
export interface RunAcceptanceInput {
  run: SuggestionRun;
  candidates: TruckCandidate[];
  buffers: FeasibilityBuffers;
  /** Tier for any leg id (incl. the run itself). Defaults to 3. */
  tierOf?: (legId: string) => RunTier;
}

const TIME_PREFIX = "Time conflict";

export function evaluateRunAcceptance(input: RunAcceptanceInput): RunAcceptance {
  const { run, candidates } = input;
  const tierOf = input.tierOf ?? (() => 3 as RunTier);
  const buffers = { ...input.buffers, minGapMinutes: Math.max(MIN_GAP_MINUTES, input.buffers.minGapMinutes) };
  const sugg = suggestTrucksForRun({ run, candidates, buffers: input.buffers });
  const rejected = new Map(sugg.ineligible.map((r) => [r.truckId, r.reason]));
  const window = computeWindow(run, buffers);

  const perTruck: TruckImpact[] = [];
  for (const truck of candidates) {
    const reason = rejected.get(truck.truckId);
    if (reason === undefined) { perTruck.push({ truckId: truck.truckId, clean: true, breaks: [] }); continue; }
    // Only time conflicts can be "absorbed"; safety/ALS/down/equipment stay hard blocks.
    if (!reason.startsWith(TIME_PREFIX) || window.start == null) {
      perTruck.push({ truckId: truck.truckId, clean: false, breaks: [], blockedReason: reason }); continue;
    }
    const breaks = new Map<string, RunBreak>();
    const add = (b: RunBreak) => {
      const prev = breaks.get(b.legId);
      if (!prev || (b.howLateMin ?? 0) > (prev.howLateMin ?? 0)) breaks.set(b.legId, b);
    };
    const existing = truck.assignedRuns.filter((l) => l.legId !== run.legId);
    for (const c of evaluateTruckDay([run], buffers).conflicts) {
      add({ legId: run.legId, label: run.label, kind: c.kind, howLateMin: lateToAppt(run, buffers), tier: tierOf(run.legId) });
    }
    for (const leg of existing) {
      const w = computeWindow(leg, buffers);
      if (w.start == null || w.end == null) {
        add({ legId: leg.legId, label: leg.label, kind: "unknown-time", howLateMin: null, tier: tierOf(leg.legId) }); continue;
      }
      for (const c of evaluateTruckDay([leg, run], buffers).conflicts) {
        if (c.legIds.length !== 2) continue;
        const [first, second] = w.start <= window.start ? [w, window] : [window, w];
        const gap = second.start! - first.end!;
        let need = 0;
        if (c.kind === "tight-gap") need = buffers.minGapMinutes;
        if (c.kind === "travel-infeasible") {
          const a = first === w ? leg : run, b = first === w ? run : leg;
          need = (a.destCoord && b.originCoord && buffers.travelFloor?.(a.destCoord, b.originCoord)) || 0;
        }
        add({ legId: leg.legId, label: leg.label, kind: c.kind, howLateMin: Math.max(0, need - gap), tier: tierOf(leg.legId) });
      }
    }
    perTruck.push({ truckId: truck.truckId, clean: false, breaks: [...breaks.values()] });
  }

  const top = sugg.eligible[0];
  if (top) {
    return { coverable: true, runShouldYield: false, perTruck,
      leastBadTruck: { truckId: top.truckId, breaks: [], reasons: top.reasons } };
  }
  const order = new Map(candidates.map((c, i) => [c.truckId, i]));
  const options = perTruck
    .filter((t) => !t.blockedReason && t.breaks.length && !t.breaks.some((b) => b.tier === 1 && b.legId !== run.legId))
    .map((t) => ({
      t,
      tier2: t.breaks.filter((b) => b.tier === 2).length,
      late: t.breaks.reduce((s, b) => s + (b.howLateMin ?? 60), 0),
    }))
    .sort((a, b) => a.tier2 - b.tier2 || a.late - b.late || order.get(a.t.truckId)! - order.get(b.t.truckId)!);
  const best = options[0]?.t ?? null;
  const runTier = tierOf(run.legId);
  const othersHit = (t: TruckImpact) => t.breaks.some((b) => b.legId !== run.legId && b.tier <= 2);
  const runShouldYield = runTier === 3 && perTruck.some((t) => !t.blockedReason && t.breaks.length) &&
    perTruck.filter((t) => !t.blockedReason && t.breaks.length).every(othersHit);
  return {
    coverable: false, runShouldYield, perTruck,
    leastBadTruck: best ? { truckId: best.truckId, breaks: best.breaks, reasons: [`Delays ${best.breaks.length} run(s).`] } : null,
  };
}

function lateToAppt(run: SuggestionRun, b: FeasibilityBuffers): number | null {
  const w = computeWindow(run, b);
  if (w.start == null || run.mustArriveBy == null) return null;
  return Math.max(0, w.start + b.loadMinutes + Math.max(run.tripMinutes, 0) - (run.mustArriveBy + b.graceMinutes));
}
