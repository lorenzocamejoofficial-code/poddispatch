import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFeasibilityRefreshKey, useTruckDayFeasibility } from "./useTruckDayFeasibility";

const mocks = vi.hoisted(() => ({
  slots: [] as any[], isSim: false,
  select: vi.fn(), eq: vi.fn(), from: vi.fn(),
}));
vi.mock("@/lib/company-scope", () => ({ getActiveCompanyId: async () => "company-a", NO_COMPANY: "none" }));
vi.mock("@/hooks/useIsSimulationCompany", () => ({ useSimulationCompanyState: () => ({ isSim: mocks.isSim, resolved: true }) }));
vi.mock("@/hooks/usePatientTimeStats", () => ({ usePatientTimeStats: () => new Map() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

function slot(id: string, status = "pending", pickup = "08:00", simulated = false) {
  return { truck_id: "truck-a", slot_order: 0, status, leg: {
    id, leg_type: "A", pickup_time: pickup, estimated_duration_minutes: 30,
    oneoff_name: id, is_simulated: simulated, patient_id: null,
    patient: null,
  } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isSim = false;
  mocks.slots = [];
  mocks.from.mockImplementation((table: string) => {
    const query = {
      select: (fields: string) => { mocks.select(fields); return query; },
      eq: (field: string, value: string) => { mocks.eq(field, value); return query; },
      maybeSingle: async () => ({ data: null, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === "truck_run_slots" ? mocks.slots : null, error: null }).then(resolve),
    };
    return query;
  });
});

describe("cancelled runs in truck feasibility", () => {
  it.each(["cancelled", "pending_cancellation"])("ignores %s overlaps and late appointments", async (status) => {
    const cancelled = slot("cancelled-run", status);
    const lateCancelled = { ...cancelled, leg: { ...cancelled.leg, patient: { first_name: "Test", last_name: "Patient", must_arrive_by: "08:00" } } };
    mocks.slots = [lateCancelled, slot("replacement", "pending", "08:15")];
    const { result } = renderHook(() => useTruckDayFeasibility("2026-10-23"));
    await waitFor(() => expect(result.current.get("truck-a")?.clear).toBe(true));
    expect(result.current.get("truck-a")?.windows.map((w) => w.legId)).toEqual(["replacement"]);
    expect(mocks.select).toHaveBeenCalledWith(expect.stringContaining("slot_order, status,"));
    expect(mocks.eq).toHaveBeenCalledWith("company_id", "company-a");
    expect(mocks.eq).toHaveBeenCalledWith("run_date", "2026-10-23");
  });

  it("recomputes when only slot status changes, and flags a restored overlap", async () => {
    const legs = [{ id: "original", assigned_truck_id: "truck-a", pickup_time: "08:00", slot_order: 0, slot_status: "pending" }];
    mocks.slots = [slot("original"), slot("replacement", "pending", "08:15")];
    const { result, rerender } = renderHook(({ refreshKey }) => useTruckDayFeasibility("2026-10-23", refreshKey), {
      initialProps: { refreshKey: getFeasibilityRefreshKey(legs) },
    });
    await waitFor(() => expect(result.current.get("truck-a")?.conflicts).toHaveLength(1));
    expect(result.current.get("truck-a")?.conflicts[0].kind).toBe("overlap");
    const cancelledKey = getFeasibilityRefreshKey([{ ...legs[0], slot_status: "cancelled" }]);
    expect(cancelledKey).not.toBe(getFeasibilityRefreshKey(legs));
    mocks.slots = [slot("original", "cancelled"), slot("replacement", "pending", "08:15")];
    rerender({ refreshKey: cancelledKey });
    await waitFor(() => expect(result.current.get("truck-a")?.clear).toBe(true));
    mocks.slots = [slot("original"), slot("replacement", "pending", "08:15")];
    rerender({ refreshKey: getFeasibilityRefreshKey(legs) });
    await waitFor(() => expect(result.current.get("truck-a")?.clear).toBe(false));
  });

  it("returns no truck flags when every run is cancelled", async () => {
    mocks.slots = [slot("original", "cancelled")];
    const { result } = renderHook(() => useTruckDayFeasibility("2026-10-23"));
    await waitFor(() => expect(mocks.select).toHaveBeenCalled());
    expect(result.current.size).toBe(0);
  });

  it.each([false, true])("preserves simulation filtering (sandbox=%s)", async (isSim) => {
    mocks.isSim = isSim;
    mocks.slots = [slot("real"), slot("simulated", "pending", "08:15", true)];
    const { result } = renderHook(() => useTruckDayFeasibility("2026-10-23"));
    await waitFor(() => expect(result.current.has("truck-a")).toBe(true));
    expect(result.current.get("truck-a")?.clear).toBe(!isSim);
  });
});