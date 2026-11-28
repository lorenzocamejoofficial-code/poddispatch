import { describe, it, expect, vi, beforeEach } from "vitest";
import { patientTripWindow, windowsOverlap, recordedWindowMinute } from "./patient-trip-window";
import { checkDuplicateTrip } from "./duplicate-trip-check";
const mocks = vi.hoisted(() => ({ rows: {} as Record<string, any>, eq: vi.fn() }));
vi.mock("./company-scope", () => ({ getActiveCompanyId: async () => "company-a", NO_COMPANY: "none" }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  const q = { select: () => q, eq: (k: string, v: unknown) => { mocks.eq(k, v); return q; }, in: () => q, maybeSingle: () => Promise.resolve({ data: mocks.rows[table] ?? null, error: null }), then: (resolve: any) => Promise.resolve({ data: mocks.rows[table] ?? [], error: null }).then(resolve) }; return q;
} } }));
beforeEach(() => { mocks.eq.mockClear(); mocks.rows = {}; });
describe("same-patient windows", () => {
  it("allows adjacent and non-overlapping same-day A/B/chained trips", () => {
    expect(windowsOverlap({ start: 480, end: 530 }, { start: 530, end: 580 })).toBe(false);
    expect(windowsOverlap({ start: 480, end: 530 }, { start: 720, end: 770 })).toBe(false);
  });
  it("rejects partial and nested overlap without a truck gap", () => {
    expect(windowsOverlap({ start: 480, end: 530 }, { start: 520, end: 570 })).toBe(true);
    expect(windowsOverlap({ start: 480, end: 600 }, { start: 500, end: 550 })).toBe(true);
  });
  it("supports explicit end times and midnight", () => {
    expect(patientTripWindow("23:40", "00:20")).toEqual({ start: 1420, end: 1460 });
    expect(patientTripWindow("08:00", null, 60)).toEqual({ start: 480, end: 560 });
  });
  it("uses recorded PCR windows instead of phantom planned overlaps", async () => {
    mocks.rows.trip_records = [{ id: "trip-a", leg_id: null, run_date: "2026-11-28", scheduled_pickup_time: "08:00", scheduled_dropoff_time: null, at_scene_time: "2026-11-28T13:00:00Z", dropped_at: "2026-11-28T13:20:00Z", status: "completed" }];
    expect((await checkDuplicateTrip("synthetic", "2026-11-28", "08:25")).isDuplicate).toBe(false);
    expect((await checkDuplicateTrip("synthetic", "2026-11-28", "08:15")).isDuplicate).toBe(true);
    expect(recordedWindowMinute("2026-11-29T05:20:00Z", "2026-11-28")).toBe(1460);
  });
  it("checks scheduled legs as well as trips, excludes the edited leg, and scopes every query", async () => {
    mocks.rows.scheduling_legs = [{ id: "leg-a", run_date: "2026-11-28", pickup_time: "08:00", estimated_duration_minutes: 60 }];
    expect((await checkDuplicateTrip("synthetic", "2026-11-28", "08:45")).isDuplicate).toBe(true);
    expect((await checkDuplicateTrip("synthetic", "2026-11-28", "09:20")).isDuplicate).toBe(false);
    expect((await checkDuplicateTrip("synthetic", "2026-11-28", "08:45", { excludeLegId: "leg-a" })).isDuplicate).toBe(false);
    expect(mocks.eq.mock.calls.filter(([k]) => k === "company_id").every(([, v]) => v === "company-a")).toBe(true);
  });
  it("uses exception times and ignores cancellations", async () => {
    mocks.rows.scheduling_legs = [{ id: "leg-a", run_date: "2026-11-28", pickup_time: "08:00", estimated_duration_minutes: 30 }];
    mocks.rows.leg_exceptions = [{ scheduling_leg_id: "leg-a", run_date: "2026-11-28", pickup_time: "10:00" }];
    expect((await checkDuplicateTrip("synthetic", "2026-11-28", "08:00")).isDuplicate).toBe(false);
    expect((await checkDuplicateTrip("synthetic", "2026-11-28", "10:00")).isDuplicate).toBe(true);
    mocks.rows.truck_run_slots = [{ leg_id: "leg-a", run_date: "2026-11-28", status: "cancelled" }];
    expect((await checkDuplicateTrip("synthetic", "2026-11-28", "10:00")).isDuplicate).toBe(false);
  });
});
