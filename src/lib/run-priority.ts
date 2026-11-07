import { normalizeTransportKind } from "./transport-vocabulary";

export type RunTier = 1 | 2 | 3;

export interface RunPriority {
  tier: RunTier;
  label: string;
  rationale: string;
  /** Minutes since midnight for earliest-first ordering; null if unavailable. */
  hardArriveBy: number | null;
}

export interface RunPriorityInput {
  leg_type: string | null;
  transport_kind?: string | null;
  trip_type?: string | null;
  must_arrive_by?: string | null;
  chair_time?: string | null;
  overrideTier?: RunTier | null;
}

const LABELS: Record<RunTier, string> = {
  1: "Hard arrive-by (clinical)",
  2: "Return leg — patient waiting",
  3: "Flexible",
};

// Existing minutes-of-day parsers are private; accept clock times, not dates.
function minutesOfDay(time: string | null | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time?.trim() ?? "");
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? 0);
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return hours * 60 + minutes;
}

/** Advisory derivation only: never assigns, persists, or mutates a run. */
export function deriveRunPriority(run: RunPriorityInput): RunPriority {
  const leg = run.leg_type?.trim().toUpperCase();
  const kind = normalizeTransportKind(run.transport_kind) ?? normalizeTransportKind(run.trip_type);
  // Matches the clinical-time axes in intake: dialysis and outpatient appointments.
  const appointmentAnchored = leg === "A" && (kind === "dialysis" || kind === "outpatient");
  const explicitDeadline = Boolean(run.must_arrive_by?.trim());
  const chairMinutes = appointmentAnchored ? minutesOfDay(run.chair_time) : null;
  const hardArriveBy = explicitDeadline ? minutesOfDay(run.must_arrive_by) : chairMinutes;

  if (run.overrideTier != null) {
    return { tier: run.overrideTier, label: LABELS[run.overrideTier], rationale: "manual override", hardArriveBy };
  }
  // An explicit but malformed deadline remains high priority, without a fake time.
  if (explicitDeadline || chairMinutes !== null) {
    return { tier: 1, label: LABELS[1], rationale: explicitDeadline
      ? "Explicit must-arrive-by deadline" : "A-leg clinical appointment time", hardArriveBy };
  }
  if (leg === "B") {
    return { tier: 2, label: LABELS[2], rationale: "Return B-leg; patient waiting", hardArriveBy: null };
  }
  return { tier: 3, label: LABELS[3], rationale: "No hard arrive-by time or waiting return leg", hardArriveBy: null };
}