import { describe, it, expect, vi } from "vitest";
import { withReturnDropAnchor, toFeasibilityLeg } from "@/hooks/useTruckDayFeasibility";
import { EMPTY_STATS } from "./patient-time-prediction";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const a = { id: "a", patient_id: "synthetic", leg_type: "A", trip_type: "dialysis", pickup_time: "07:00", patient: { chair_time: null }, estimated_duration_minutes: 30 };
const b = { id: "b", patient_id: "synthetic", leg_type: "B", trip_type: "dialysis", pickup_time: null, patient: { chair_time: null } };
describe("B-leg fallback anchor", () => {
  it("uses the A drop estimate when chair time and turnaround history are absent", () => {
    const anchored = withReturnDropAnchor(b, [a,b], new Map(), null);
    expect(anchored.a_leg_drop_time).toBe("07:40");
    expect(toFeasibilityLeg(anchored, 0, new Map([["synthetic", EMPTY_STATS]]), null).predictedReturn).toBe(700);
  });
  it("does not borrow another patient's or transport type's A leg", () => {
    expect(withReturnDropAnchor(b, [{ ...a, patient_id: "other" }], new Map(), null)).toBe(b);
    expect(withReturnDropAnchor(b, [{ ...a, trip_type: "wound_care" }], new Map(), null)).toBe(b);
  });
});
