import { describe, it, expect } from "vitest";
import {
  filterTrips, turnaroundSamples, tripDurationSamples, summarize, confidenceFor,
  suggestReturnPickup, suggestTripDuration, MIN_SAMPLES, type TripSample,
} from "./patient-time-prediction";

const iso = (date: string, hhmm: string) => `${date}T${hhmm}:00Z`;
function day(date: string, chairMin: number, tripMin = 30, pid = "p1"): TripSample[] {
  const aDrop = Date.parse(iso(date, "06:00"));
  const bPick = new Date(aDrop + chairMin * 60000).toISOString();
  return [
    { patient_id: pid, run_date: date, leg_type: "A", status: "completed",
      at_scene_time: new Date(aDrop - tripMin * 60000).toISOString(), dropped_at: iso(date, "06:00") },
    { patient_id: pid, run_date: date, leg_type: "B", status: "ready_for_billing",
      at_scene_time: bPick, patient_contact_time: bPick, dropped_at: new Date(Date.parse(bPick) + tripMin * 60000).toISOString() },
  ];
}
const dates = (n: number) => Array.from({ length: n }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);

describe("min-5 rule", () => {
  it("4 samples gives no number", () => {
    const s = summarize([200, 210, 220, 230]);
    expect(s.median).toBeNull();
    expect(s.confidence).toBe("none");
    expect(MIN_SAMPLES).toBe(5);
  });
  it("5 samples gives a median", () => {
    expect(summarize([200, 210, 220, 230, 240]).median).toBe(220);
  });
  it("a single trip never yields a suggestion from history", () => {
    const stats = summarize(turnaroundSamples(day("2026-09-01", 240)));
    const s = suggestReturnPickup({ chairTime: "06:00", turnaround: stats, plannedChairMinutes: 210 });
    expect(s.source).toBe("plan");
  });
});

describe("outlier filtering", () => {
  it("drops turnaround outside 60–480 and trips outside 5–240", () => {
    const trips = [...day("2026-09-01", 30), ...day("2026-09-02", 500), ...day("2026-09-03", 240)];
    expect(turnaroundSamples(trips)).toEqual([240]);
    const durations = tripDurationSamples([...day("2026-09-04", 240, 3), ...day("2026-09-05", 240, 45)]);
    expect(durations).toEqual([45, 45]);
  });
  it("drops cancelled, emergency-upgraded, and out-of-order stamps", () => {
    const rows: TripSample[] = [
      { patient_id: "p1", run_date: "2026-09-01", leg_type: "A", status: "cancelled", at_scene_time: iso("2026-09-01", "05:00"), dropped_at: iso("2026-09-01", "05:30") },
      { patient_id: "p1", run_date: "2026-09-01", leg_type: "A", status: "completed", emergency_upgrade_at: iso("2026-09-01", "05:10"), at_scene_time: iso("2026-09-01", "05:00"), dropped_at: iso("2026-09-01", "05:30") },
    ];
    expect(filterTrips(rows, { includeSimulated: false, today: "2026-10-10" })).toHaveLength(0);
    expect(tripDurationSamples([{ patient_id: "p1", run_date: "2026-09-01", leg_type: "A", status: "completed", at_scene_time: iso("2026-09-01", "06:00"), dropped_at: iso("2026-09-01", "05:00") }])).toEqual([]);
  });
  it("simulated trips count only when allowed; 180-day lookback", () => {
    const sim = day("2026-09-01", 240).map((t) => ({ ...t, is_simulated: true }));
    expect(filterTrips(sim, { includeSimulated: false, today: "2026-10-10" })).toHaveLength(0);
    expect(filterTrips(sim, { includeSimulated: true, today: "2026-10-10" })).toHaveLength(2);
    expect(filterTrips(day("2026-03-01", 240), { includeSimulated: false, today: "2026-10-10" })).toHaveLength(0);
  });
});

describe("A/B same-day pairing", () => {
  it("pairs only A and B on the same date for the same patient", () => {
    const a = day("2026-09-01", 240)[0];
    const bOtherDay = { ...day("2026-09-02", 240)[1] };
    const bOtherPatient = { ...day("2026-09-01", 240, 30, "p2")[1] };
    expect(turnaroundSamples([a, bOtherDay, bOtherPatient])).toEqual([]);
    expect(turnaroundSamples(day("2026-09-01", 225))).toEqual([225]);
  });
});

describe("fallback order", () => {
  const none = summarize([]);
  it("return pickup: history → plan (chair + buffer) → none", () => {
    const hist = summarize(dates(5).flatMap((d) => turnaroundSamples(day(d, 240))));
    expect(suggestReturnPickup({ chairTime: "06:00", turnaround: hist, plannedChairMinutes: 210 })).toMatchObject({ value: "10:00", source: "history" });
    expect(suggestReturnPickup({ chairTime: "06:00", turnaround: none, plannedChairMinutes: 210 })).toMatchObject({ value: "09:45", source: "plan" });
    expect(suggestReturnPickup({ chairTime: null, turnaround: none, plannedChairMinutes: 210 }).source).toBe("none");
  });
  it("duration: history → patient run duration → 30", () => {
    expect(suggestTripDuration({ stats: summarize([40, 42, 44, 46, 48]), plannedMinutes: 25 })).toMatchObject({ value: 44, source: "history" });
    expect(suggestTripDuration({ stats: none, plannedMinutes: 25 })).toMatchObject({ value: 25, source: "plan" });
    expect(suggestTripDuration({ stats: none, plannedMinutes: null })).toMatchObject({ value: 30, source: "default" });
  });
});

describe("confidence tiers", () => {
  it("none <5, low 5–9, medium 10–19, high ≥20 with IQR ≤30", () => {
    expect(confidenceFor(4, 0)).toBe("none");
    expect(confidenceFor(5, 0)).toBe("low");
    expect(confidenceFor(9, 0)).toBe("low");
    expect(confidenceFor(10, 0)).toBe("medium");
    expect(confidenceFor(20, 30)).toBe("high");
    expect(confidenceFor(20, 31)).toBe("medium");
  });
});
