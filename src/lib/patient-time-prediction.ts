/**
 * Advisory patient time prediction, computed from existing PCR/status stamps.
 * Pure functions only — never writes anything. Callers show suggestions; the
 * user decides whether to apply them through the normal save path.
 */

export const MIN_SAMPLES = 5;
export const LOOKBACK_DAYS = 180;
export const MAX_TRIPS = 20;
export const TURNAROUND_BOUNDS = { min: 60, max: 480 } as const;
export const TRIP_BOUNDS = { min: 5, max: 240 } as const;
export const DEFAULT_TRIP_MINUTES = 30;
export const DEFAULT_B_LEG_BUFFER_MINUTES = 15;

export type LegKind = "A" | "B" | null;

export interface TripSample {
  patient_id: string | null;
  run_date: string | null;
  leg_type: LegKind;
  status: string | null;
  is_simulated?: boolean | null;
  emergency_upgrade_at?: string | null;
  at_scene_time?: string | null;
  in_service_time?: string | null;
  patient_contact_time?: string | null;
  left_scene_time?: string | null;
  arrived_dropoff_at?: string | null;
  dropped_at?: string | null;
}

export type Confidence = "none" | "low" | "medium" | "high";

export interface SampleStats {
  n: number;
  median: number | null;
  p25: number | null;
  p75: number | null;
  confidence: Confidence;
}

const VALID_STATUSES = new Set(["completed", "ready_for_billing"]);

export function normalizeLegType(raw: string | null | undefined): LegKind {
  if (raw === "A" || raw === "a_leg" || raw === "a") return "A";
  if (raw === "B" || raw === "b_leg" || raw === "b") return "B";
  return null;
}

/** Keep only usable history: valid status, no emergency upgrade, sim rule, lookback, newest N. */
export function filterTrips(
  rows: TripSample[],
  opts: { includeSimulated: boolean; today: string; lookbackDays?: number; limit?: number },
): TripSample[] {
  const lookback = opts.lookbackDays ?? LOOKBACK_DAYS;
  const cutoff = new Date(`${opts.today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - lookback);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return rows
    .filter((r) =>
      r.status != null && VALID_STATUSES.has(r.status) &&
      !r.emergency_upgrade_at &&
      (opts.includeSimulated || !r.is_simulated) &&
      !!r.run_date && r.run_date >= cutoffStr && r.run_date <= opts.today,
    )
    .sort((a, b) => (b.run_date ?? "").localeCompare(a.run_date ?? ""))
    .slice(0, opts.limit ?? MAX_TRIPS * 2); // A+B legs per day
}

function diffMinutes(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const s = Date.parse(start), e = Date.parse(end);
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return null;
  return Math.round((e - s) / 60000);
}

const within = (v: number, b: { min: number; max: number }) => v >= b.min && v <= b.max;

/** A-leg drop (chair start) → same-day B-leg actual pickup, per patient. */
export function turnaroundSamples(trips: TripSample[]): number[] {
  const byDay = new Map<string, { A?: TripSample; B?: TripSample }>();
  for (const t of trips) {
    if (!t.patient_id || !t.run_date || !t.leg_type) continue;
    const key = `${t.patient_id}|${t.run_date}`;
    const entry = byDay.get(key) ?? {};
    if (!entry[t.leg_type]) entry[t.leg_type] = t;
    byDay.set(key, entry);
  }
  const out: number[] = [];
  for (const { A, B } of byDay.values()) {
    if (!A || !B) continue;
    const m = diffMinutes(A.dropped_at ?? A.arrived_dropoff_at, B.patient_contact_time ?? B.left_scene_time);
    if (m != null && within(m, TURNAROUND_BOUNDS)) out.push(m);
  }
  return out.slice(0, MAX_TRIPS);
}

/** Pickup arrival → patient dropped, optionally for one leg type. */
export function tripDurationSamples(trips: TripSample[], legType?: "A" | "B"): number[] {
  const out: number[] = [];
  for (const t of trips) {
    if (legType && t.leg_type !== legType) continue;
    const m = diffMinutes(t.at_scene_time ?? t.in_service_time, t.dropped_at ?? t.arrived_dropoff_at);
    if (m != null && within(m, TRIP_BOUNDS)) out.push(m);
  }
  return out.slice(0, MAX_TRIPS);
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function confidenceFor(n: number, iqr: number | null): Confidence {
  if (n < MIN_SAMPLES) return "none";
  if (n < 10) return "low";
  if (n >= 20 && iqr != null && iqr <= 30) return "high";
  return "medium";
}

export function summarize(samples: number[]): SampleStats {
  const n = samples.length;
  if (n < MIN_SAMPLES) return { n, median: null, p25: null, p75: null, confidence: "none" };
  const s = [...samples].sort((a, b) => a - b);
  const p25 = Math.round(quantile(s, 0.25));
  const p75 = Math.round(quantile(s, 0.75));
  return { n, median: Math.round(quantile(s, 0.5)), p25, p75, confidence: confidenceFor(n, p75 - p25) };
}

export interface Suggestion {
  /** HH:MM for return pickup, minutes for duration. null = nothing to suggest. */
  value: string | number | null;
  source: "history" | "plan" | "default" | "none";
  n: number;
  confidence: Confidence;
}

function toMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}
function toHHMM(total: number): string {
  const c = Math.max(0, Math.min(total, 24 * 60 - 1));
  return `${String(Math.floor(c / 60)).padStart(2, "0")}:${String(c % 60).padStart(2, "0")}`;
}

/** Return pickup: chair time + median turnaround → else chair time + planned chair duration + buffer. */
export function suggestReturnPickup(input: {
  chairTime: string | null | undefined;
  turnaround: SampleStats;
  plannedChairMinutes: number;
  bufferMinutes?: number;
}): Suggestion {
  const start = toMinutes(input.chairTime);
  const { n, confidence, median } = input.turnaround;
  if (start == null) return { value: null, source: "none", n, confidence };
  if (median != null) return { value: toHHMM(start + median), source: "history", n, confidence };
  if (input.plannedChairMinutes > 0) {
    const buf = input.bufferMinutes ?? DEFAULT_B_LEG_BUFFER_MINUTES;
    return { value: toHHMM(start + input.plannedChairMinutes + buf), source: "plan", n, confidence: "none" };
  }
  return { value: null, source: "none", n, confidence: "none" };
}

/** Trip duration: median actual → else patient run_duration_minutes → else 30. */
export function suggestTripDuration(input: { stats: SampleStats; plannedMinutes: number | null | undefined }): Suggestion {
  const { n, confidence, median } = input.stats;
  if (median != null) return { value: median, source: "history", n, confidence };
  if (input.plannedMinutes && input.plannedMinutes > 0) return { value: input.plannedMinutes, source: "plan", n, confidence: "none" };
  return { value: DEFAULT_TRIP_MINUTES, source: "default", n, confidence: "none" };
}

export interface PatientTimeStats {
  turnaround: SampleStats;
  durationA: SampleStats;
  durationB: SampleStats;
  durationAll: SampleStats;
}

export const EMPTY_STATS: PatientTimeStats = {
  turnaround: summarize([]), durationA: summarize([]), durationB: summarize([]), durationAll: summarize([]),
};

export function computePatientStats(trips: TripSample[]): PatientTimeStats {
  return {
    turnaround: summarize(turnaroundSamples(trips)),
    durationA: summarize(tripDurationSamples(trips, "A")),
    durationB: summarize(tripDurationSamples(trips, "B")),
    durationAll: summarize(tripDurationSamples(trips)),
  };
}
