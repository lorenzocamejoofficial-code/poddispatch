/**
 * Advisory per-truck schedule feasibility — pure functions, never writes.
 * Given a truck's legs for one day plus the company's own buffers and the
 * learned per-patient durations, estimate each leg's time window and flag the
 * days that physically can't happen. Travel/deadhead distance is intentionally
 * NOT modeled here (addresses aren't geocoded yet); this is time-feasibility only.
 */

export type LegKind = "A" | "B" | null;

/** Company-configured buffers (company_settings). All minutes. */
export interface FeasibilityBuffers {
  loadMinutes: number;      // load_time_minutes
  unloadMinutes: number;    // unload_time_minutes
  graceMinutes: number;     // grace_window_minutes (allowed lateness to appointment)
  minGapMinutes: number;    // enforce_run_gap_minutes ? the configured gap : 0
}

export const DEFAULT_TRIP_MINUTES = 30;

export interface FeasibilityLeg {
  legId: string;
  label: string;                 // patient/oneoff name for messages
  legKind: LegKind;
  /** minutes-from-midnight anchors; null when unknown */
  scheduledPickup: number | null;   // when the truck is due to pick up
  predictedReturn: number | null;   // B-leg: predicted ready time (suggestReturnPickup)
  mustArriveBy: number | null;      // A-leg: appointment/chair time to beat
  tripMinutes: number;              // in-vehicle minutes (learned ?? estimated ?? default)
  slotOrder: number;
}

export interface LegWindow {
  legId: string;
  label: string;
  start: number | null;   // minutes from midnight
  end: number | null;     // start + load + trip + unload
  basis: "scheduled" | "predicted-return" | "unknown";
}

export type ConflictKind = "overlap" | "late-to-appointment" | "tight-gap";
export interface Conflict {
  kind: ConflictKind;
  severity: "error" | "warning";
  legIds: string[];
  message: string;
}

export interface TruckDayFeasibility {
  windows: LegWindow[];
  conflicts: Conflict[];
  /** true when there are zero conflicts — the "stay silent" signal. */
  clear: boolean;
}

function legStartMinutes(leg: FeasibilityLeg): { start: number | null; basis: LegWindow["basis"] } {
  if (leg.legKind === "B") {
    if (leg.scheduledPickup != null) return { start: leg.scheduledPickup, basis: "scheduled" };
    if (leg.predictedReturn != null) return { start: leg.predictedReturn, basis: "predicted-return" };
    return { start: null, basis: "unknown" };
  }
  if (leg.scheduledPickup != null) return { start: leg.scheduledPickup, basis: "scheduled" };
  return { start: null, basis: "unknown" };
}

export function computeWindow(leg: FeasibilityLeg, b: FeasibilityBuffers): LegWindow {
  const { start, basis } = legStartMinutes(leg);
  if (start == null) return { legId: leg.legId, label: leg.label, start: null, end: null, basis: "unknown" };
  const end = start + b.loadMinutes + Math.max(leg.tripMinutes, 0) + b.unloadMinutes;
  return { legId: leg.legId, label: leg.label, start, end, basis };
}

function fmt(mins: number): string {
  const c = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(c / 60), m = c % 60;
  const ap = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

/** Evaluate one truck's day. legs need not be pre-sorted. */
export function evaluateTruckDay(legs: FeasibilityLeg[], b: FeasibilityBuffers): TruckDayFeasibility {
  const windows = legs.map((l) => computeWindow(l, b));
  const conflicts: Conflict[] = [];

  // late-to-appointment (A legs): arrival = start + load + trip must be <= mustArriveBy + grace
  for (const leg of legs) {
    if (leg.legKind !== "A" || leg.mustArriveBy == null) continue;
    const w = windows.find((x) => x.legId === leg.legId);
    if (!w || w.start == null) continue;
    const arrival = w.start + b.loadMinutes + Math.max(leg.tripMinutes, 0);
    if (arrival > leg.mustArriveBy + b.graceMinutes) {
      conflicts.push({
        kind: "late-to-appointment", severity: "error", legIds: [leg.legId],
        message: `${leg.label} is set to arrive around ${fmt(arrival)}, after the ${fmt(leg.mustArriveBy)} appointment.`,
      });
    }
  }

  // overlap / tight-gap between consecutive windows (only those with known times)
  const timed = windows.filter((w) => w.start != null && w.end != null)
    .sort((a, c) => (a.start! - c.start!));
  for (let i = 0; i < timed.length - 1; i++) {
    const cur = timed[i], nxt = timed[i + 1];
    if (cur.end! > nxt.start!) {
      conflicts.push({
        kind: "overlap", severity: "error", legIds: [cur.legId, nxt.legId],
        message: `${cur.label} runs until ~${fmt(cur.end!)} but ${nxt.label} needs this truck at ${fmt(nxt.start!)}. One truck can't do both.`,
      });
    } else if (b.minGapMinutes > 0 && nxt.start! - cur.end! < b.minGapMinutes) {
      conflicts.push({
        kind: "tight-gap", severity: "warning", legIds: [cur.legId, nxt.legId],
        message: `Only ${nxt.start! - cur.end!} min between ${cur.label} and ${nxt.label} — under the ${b.minGapMinutes}-min gap, and no travel time counted yet.`,
      });
    }
  }

  return { windows, conflicts, clear: conflicts.length === 0 };
}
