import { describe, it, expect } from "vitest";
import { sortSchedulingLegs } from "@/lib/leg-order";
describe("leg order", () => {
  it("A before B even if B dropped first", () => {
    const legs = [
      { id: "b", slot_order: 0, pickup_time: "10:00", patient_id: "p1", leg_type: "b_leg" },
      { id: "a", slot_order: 1, pickup_time: "08:00", patient_id: "p1", leg_type: "a_leg" },
      { id: "x", slot_order: 2, pickup_time: "09:00", patient_id: "p2", leg_type: "a_leg" },
    ];
    expect(sortSchedulingLegs(legs).map(l => l.id)).toEqual(["a", "b", "x"]);
  });
});
